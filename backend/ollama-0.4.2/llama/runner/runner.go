package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/sync/semaphore"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/llama"
)

func LogToFile(message string) error {
	// Open the file in append mode, create it if it doesn't exist, and set appropriate permissions
	file, err := os.OpenFile("./log.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return err
	}
	defer file.Close()

	// Create a new logger that writes to the file
	logger := log.New(file, "", log.LstdFlags)

	// Write the log message
	logger.Println(message)

	return nil
}

// input is an element of the prompt to process, either
// a token or an image embedding (generated from a vision projector)
type input struct {
	token int

	// embed is an image embedding
	embed []float32
}

type Sequence struct {
	// batch index
	iBatch int

	// number of tokens predicted so far
	numPredicted int

	// prompt inputs left to evaluate
	inputs []input

	// tokens that have been generated but not returned yet (e.g. for stop sequences)
	pendingResponses []string

	// input cache being used by this sequence
	cache *InputCacheSlot

	// does this sequence require cross-attention layers to be processed? - if we have seen
	// an image for certain multi-modal models
	crossAttention bool

	// channel to send responses over
	responses chan string

	// channel to stop decoding (such as if the remote connection is closed)
	quit chan bool

	// number of tokens to predict
	numPredict int

	samplingCtx *llama.SamplingContext

	// channel to send back the embedding if embedding only
	embedding chan []float32

	// stop sequences
	stop []string

	// number of inputs to keep at the beginning when shifting context window
	numKeep int

	// true if an embedding are to be returned instead of text generation
	embeddingOnly bool

	doneReason string

	// Metrics
	startProcessingTime time.Time
	startGenerationTime time.Time
	numDecoded          int
	numPromptInputs     int
}

type NewSequenceParams struct {
	numPredict     int
	stop           []string
	numKeep        int
	samplingParams *llama.SamplingParams
	embedding      bool
}

func (s *Server) NewSequence(prompt string, images []ImageData, params NewSequenceParams) (*Sequence, error) {
	slog.Info("new sequence", "prompt", prompt, "images", len(images))
	s.ready.Wait()

	startTime := time.Now()

	inputs, err := s.inputs(prompt, images)
	if err != nil {
		return nil, fmt.Errorf("failed to process inputs: %w", err)
	} else if len(inputs) == 0 {
		return nil, errors.New("no input provided")
	}
	slog.Info("inputs processed", "inputs", len(inputs))

	if params.numKeep < 0 {
		params.numKeep = len(inputs)
	}

	if s.model.AddBOSToken() {
		params.numKeep += 1
	}

	// Ensure that at least 1 input can be discarded during shift
	params.numKeep = min(params.numKeep, s.cache.numCtx-1)

	if len(inputs) > s.cache.numCtx {
		slog.Warn("input exceeds context length", "prompt", len(inputs), "limit", s.cache.numCtx)
	}

	var sc *llama.SamplingContext
	if params.samplingParams != nil {
		sc, err = llama.NewSamplingContext(s.model, *params.samplingParams)
		slog.Info("sampling context", "params", params.samplingParams, "context", sc)
		if err != nil {
			return nil, err
		}
		for _, input := range inputs {
			if input.embed == nil {
				slog.Info("sampling context accept", "token", input.token)
				sc.Accept(input.token, false)
			} else {
				slog.Info("sampling context not accept", "token", input.embed)
				// sc.Accept(input.embed, false)
			}
		}
	}

	return &Sequence{
		inputs:              inputs,
		numPromptInputs:     len(inputs),
		startProcessingTime: startTime,
		numPredict:          params.numPredict,
		pendingResponses:    make([]string, 0),
		responses:           make(chan string, 100),
		quit:                make(chan bool, 1),
		embedding:           make(chan []float32, 1),
		samplingCtx:         sc,
		embeddingOnly:       params.embedding,
		stop:                params.stop,
		numKeep:             params.numKeep,
	}, nil
}

// inputs processes the prompt and images into a list of inputs
// by splitting the prompt on [img-<n>] tags, tokenizing text and
// generating image embeddings for each image
func (s *Server) inputs(prompt string, images []ImageData) ([]input, error) {
	slog.Info("processing inputs", "prompt", prompt, "images", len(images))
	var inputs []input

	re := regexp.MustCompile(`\[img-(\d+)\]`)
	parts := re.Split(prompt, -1)
	matches := re.FindAllStringSubmatch(prompt, -1)

	for i, part := range parts {
		// text - tokenize
		slog.Info("processing part", "part", part, "index", i, "matches", matches)
		tokens, err := s.lc.Model().Tokenize(part, i == 0, true)
		if err != nil {
			return nil, err
		}

		for _, t := range tokens {
			inputs = append(inputs, input{token: t})
		}

		// image - generate image embedding
		if i < len(matches) {
			n, _ := strconv.Atoi(matches[i][1])

			imageIndex := -1
			for j := range images {
				if images[j].ID == n {
					imageIndex = j
					break
				}
			}

			if imageIndex < 0 {
				return nil, fmt.Errorf("invalid image index: %d", n)
			}

			embed, err := s.image.NewEmbed(s.lc, images[imageIndex].Data, images[imageIndex].AspectRatioID)
			if err != nil {
				return nil, err
			}

			for _, e := range embed {
				inputs = append(inputs, input{embed: e})
			}
		}
	}

	slog.Info("inputs processed", "inputs", len(inputs), inputs)
	return inputs, nil
}

type Server struct {
	modelPath string
	// is the server ready to process requests?
	// protects access to model and image
	ready sync.WaitGroup

	// loaded model
	model *llama.Model

	// image model context for multi-modal models
	image *ImageContext

	// status for external health reporting - loading, ready to serve, etc.
	status ServerStatus

	// current progress on loading the model
	progress float32

	// number of simultaneous requests to handle
	parallel int

	// maximum number of elements in a batch (per sequence)
	// TODO (jmorganca): make this n_batch
	batchSize int

	// protects access to everything below this line
	// this is context state needed for decoding
	mu sync.Mutex

	// indicates that data is ready for processing
	cond *sync.Cond

	// decoding state
	lc *llama.Context

	// the list of simultaneous sequences being evaluated
	seqs []*Sequence

	// seqs can have a maximum of parallel entries, which
	// is enfoced by seqSem
	seqsSem *semaphore.Weighted

	// KV cache
	cache *InputCache

	// next sequence for prompt processing to avoid starvation
	nextSeq int
}

func (s *Server) allNil() bool {
	for _, item := range s.seqs {
		if item != nil {
			return false
		}
	}
	return true
}

func flushPending(seq *Sequence) bool {
	slog.Info("flushing pending responses", "pending", seq.pendingResponses)
	joined := strings.Join(seq.pendingResponses, "")
	seq.pendingResponses = []string{}

	// Check if there are any partial UTF-8 characters remaining.
	// We already check and queue as we are generating but some may
	// still make it here:
	// - Sequence is ending, e.g. generation limit has been hit
	// - Invalid characters in the middle of a string
	// This is a stricter check to ensure we never output invalid Unicode.
	for !utf8.ValidString(joined) {
		joined = joined[:len(joined)-1]
	}

	if len(joined) == 0 {
		return true
	}

	select {
	case seq.responses <- joined:
		return true
	case <-seq.quit:
		return false
	}
}

func (s *Server) removeSequence(seqIndex int, reason string) {
	slog.Info("removing sequence", "index", seqIndex, "reason", reason)
	seq := s.seqs[seqIndex]

	flushPending(seq)
	seq.doneReason = reason
	close(seq.responses)
	close(seq.embedding)
	seq.cache.InUse = false
	s.seqs[seqIndex] = nil
}

func (s *Server) run(ctx context.Context) {
	slog.Info("starting runner")
	s.ready.Wait()

	// Logically these batches are used only within the context of processBatch
	// but it is better for performance to allocate them once here
	slog.Info("allocating batches", "batch_size", s.batchSize, "num_seqs", len(s.seqs))
	tokenBatch, err := llama.NewBatch(s.batchSize, len(s.seqs), 0)
	slog.Info("allocated token batch", "size", tokenBatch.Size(), tokenBatch)
	if err != nil {
		panic(err)
	}
	defer tokenBatch.Free()

	var embedBatch *llama.Batch
	embedBatchSize := s.image.BatchSize(s.batchSize)
	if embedBatchSize != 0 {
		embedBatch, err = llama.NewBatch(embedBatchSize, len(s.seqs), s.image.EmbedSize(s.lc))
		if err != nil {
			panic(err)
		}
		defer embedBatch.Free()
	} else {
		embedBatch = &llama.Batch{}
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
			s.processBatch(tokenBatch, embedBatch)
			tokenBatch.Clear()
			embedBatch.Clear()
		}
	}
}

// TODO (jmorganca): processBatch should be simplified, removing:
// * sampling
// * stop token checking
// * metrics
// these should instead be handled by the handlers
// it should only be responsible for accepting tokens or embeddings and
// processing batches as fast as possible
func (s *Server) processBatch(tokenBatch *llama.Batch, embedBatch *llama.Batch) {
	slog.Info("processing batch")
	s.mu.Lock()
	for s.allNil() {
		s.cond.Wait() // Wait until an item is added
	}
	defer s.mu.Unlock()

	var batch *llama.Batch
	crossAttention := false

	seqIdx := s.nextSeq - 1
	for range s.seqs {
		seqIdx = (seqIdx + 1) % len(s.seqs)
		seq := s.seqs[seqIdx]

		if seq == nil {
			continue
		}

		// If an error occurred during the processing of a previous batch then we may have emptied the inputs
		// without adding a new one. In this case, end the sequence rather than infinite looping.
		if len(seq.inputs) == 0 {
			slog.Error("removing sequence due to no input tokens", "index", seqIdx, "cache id", seq.cache.Id)
			s.removeSequence(seqIdx, "error")
			continue
		}

		// if past the num predict limit
		if seq.numPredict > 0 && seq.numPredicted >= seq.numPredict {
			s.removeSequence(seqIdx, "limit")
			continue
		}

		var numInputsProcessed int
		shifted := false

		for i, input := range seq.inputs {
			if len(seq.cache.Inputs)+1 > s.cache.numCtx {
				if !shifted {
					s.cache.ShiftCacheSlot(seq.cache, seq.numKeep)
					shifted = true
				} else {
					break
				}
			}

			embedding := input.embed != nil

			// If we don't currently have a batch, use one of the correct type and
			// fill it up as much as possible across all sequences. If we encounter an
			// input of the opppsite type, stop for that sequence but then pick up from
			// there for the next batch, ensuring that we alternate types
			if batch == nil {
				if !embedding {
					batch = tokenBatch
				} else {
					batch = embedBatch
					seq.crossAttention = s.image.NeedCrossAttention(input)
				}
			} else if embedding != batch.IsEmbedding() || crossAttention != seq.crossAttention {
				s.nextSeq = seqIdx
				break
			}

			if i >= batch.Size() {
				break
			}

			crossAttention = seq.crossAttention
			slog.Info("adding input to batch", "token", input.token, "embed", input.embed, "num_inputs", len(seq.cache.Inputs), "last", i+1 == len(seq.inputs), "cache_id", seq.cache.Id)
			batch.Add(input.token, input.embed, len(seq.cache.Inputs), i+1 == len(seq.inputs), seq.cache.Id)
			seq.cache.Inputs = append(seq.cache.Inputs, input)
			numInputsProcessed++
		}

		if numInputsProcessed > 0 {
			seq.inputs = seq.inputs[numInputsProcessed:]
			seq.iBatch = batch.NumTokens() - 1
		}
	}

	if batch == nil || batch.NumTokens() == 0 {
		return
	}

	s.lc.SetCrossAttention(crossAttention)

	err := s.lc.Decode(batch)
	if err != nil {
		slog.Error("failed to decode batch", "error", err)
		return
	}

	if crossAttention {
		// synchronize state to ensure the cross attention batch is complete.
		// needed specifically for multi-GPU systems otherwise an inflight
		// task may be incorrectly invalidated causing a crash
		s.lc.Synchronize()
	}

	for i, seq := range s.seqs {
		if seq == nil {
			continue
		}

		// don't sample prompt processing
		if len(seq.inputs) != 0 {
			continue
		}

		seq.numDecoded += 1
		if seq.numDecoded == 1 {
			seq.startGenerationTime = time.Now()
		}

		// if done processing the prompt, generate an embedding and return
		if seq.embeddingOnly {
			slog.Info("embedding only", "index", i)
			embed := s.lc.GetEmbeddingsSeq(i)
			LogToFile(fmt.Sprintf("Embed seq: %v", embed))
			if embed == nil {
				slog.Error("failed to get embeddings", "index", i, seq.iBatch)
				embed = s.lc.GetEmbeddingsIth(seq.iBatch)
				LogToFile(fmt.Sprintf("Embed ith: %v", embed))
			}

			seq.embedding <- embed
			s.removeSequence(i, "")
			continue
		}

		// sample a token
		slog.Info("sampling token", "index", i, "batch", seq.iBatch)
		LogToFile(fmt.Sprintf("Sampling token: %v", seq.iBatch))
		token := seq.samplingCtx.Sample(s.lc, seq.iBatch)
		LogToFile(fmt.Sprintf("Sampled token: %v", token))
		slog.Info("sampled token", "token", token)
		LogToFile(fmt.Sprintf("Sampled token: %v", token))
		seq.samplingCtx.Accept(token, true)
		LogToFile(fmt.Sprintf("Accepted token: %v", token))
		slog.Info("accepted token", "token", token)
		piece := s.model.TokenToPiece(token)
		LogToFile(fmt.Sprintf("Token to piece: %v", piece))
		slog.Info("token to piece", "token", token, "piece", piece)

		seq.numPredicted++

		// if it's an end of sequence token, break
		if s.model.TokenIsEog(token) {
			// TODO (jmorganca): we should send this back
			// as it's important for the /api/generate context
			// seq.responses <- piece

			s.removeSequence(i, "stop")
			continue
		}

		seq.inputs = []input{{token: token}}

		seq.pendingResponses = append(seq.pendingResponses, piece)
		sequence := strings.Join(seq.pendingResponses, "")

		if ok, stop := findStop(sequence, seq.stop); ok {
			slog.Info("hit stop token", "pending", seq.pendingResponses, "stop", stop)

			var tokenTruncated bool
			origLen := len(seq.pendingResponses)
			seq.pendingResponses, tokenTruncated = truncateStop(seq.pendingResponses, stop)
			slog.Info("truncated stop token", "pending", seq.pendingResponses, "truncated", tokenTruncated)
			newLen := len(seq.pendingResponses)

			// Update the cache based on the tokens that will be returned:
			// - We have 1 token more than is currently in the cache because
			// the last one generated wasn't submitted to Decode
			// - Remove any stop sequences that we stripped out
			// - If truncateStop removed a portion of a token, drop that
			// - As defense-in-depth, if truncatedToken didn't find a stop token
			// remove the extra one that we added to the cache len
			tokenLen := len(seq.cache.Inputs) + 1
			tokenLen -= origLen - newLen
			if tokenTruncated || origLen == newLen {
				tokenLen--
			}
			seq.cache.Inputs = seq.cache.Inputs[:tokenLen]

			s.removeSequence(i, "stop")
			continue
		}

		if containsStopSuffix(sequence, seq.stop) {
			continue
		}

		if incompleteUnicode(sequence) {
			continue
		}

		if !flushPending(seq) {
			s.removeSequence(i, "connection")
		}
	}
}

// TODO (jmorganca): use structs from the api package to avoid duplication
// this way the api acts as a proxy instead of using a different api for the
// runner
type Options struct {
	api.Runner

	NumKeep          int      `json:"n_keep"`
	Seed             int      `json:"seed"`
	NumPredict       int      `json:"n_predict"`
	TopK             int      `json:"top_k"`
	TopP             float32  `json:"top_p"`
	MinP             float32  `json:"min_p"`
	TFSZ             float32  `json:"tfs_z"`
	TypicalP         float32  `json:"typical_p"`
	RepeatLastN      int      `json:"repeat_last_n"`
	Temperature      float32  `json:"temperature"`
	RepeatPenalty    float32  `json:"repeat_penalty"`
	PresencePenalty  float32  `json:"presence_penalty"`
	FrequencyPenalty float32  `json:"frequency_penalty"`
	Mirostat         int      `json:"mirostat"`
	MirostatTau      float32  `json:"mirostat_tau"`
	MirostatEta      float32  `json:"mirostat_eta"`
	PenalizeNewline  bool     `json:"penalize_nl"`
	Stop             []string `json:"stop"`
}

type ImageData struct {
	Data          []byte `json:"data"`
	ID            int    `json:"id"`
	AspectRatioID int    `json:"aspect_ratio_id"`
}

type CompletionRequest struct {
	Prompt      string      `json:"prompt"`
	Images      []ImageData `json:"image_data"`
	Grammar     string      `json:"grammar"`
	CachePrompt bool        `json:"cache_prompt"`

	Options
}

type Timings struct {
	PredictedN  int     `json:"predicted_n"`
	PredictedMS float64 `json:"predicted_ms"`
	PromptN     int     `json:"prompt_n"`
	PromptMS    float64 `json:"prompt_ms"`
}

type CompletionResponse struct {
	Content string `json:"content"`
	Stop    bool   `json:"stop"`

	Model        string  `json:"model,omitempty"`
	Prompt       string  `json:"prompt,omitempty"`
	StoppedLimit bool    `json:"stopped_limit,omitempty"`
	PredictedN   int     `json:"predicted_n,omitempty"`
	PredictedMS  float64 `json:"predicted_ms,omitempty"`
	PromptN      int     `json:"prompt_n,omitempty"`
	PromptMS     float64 `json:"prompt_ms,omitempty"`

	Timings Timings `json:"timings"`
}

func (s *Server) completion(w http.ResponseWriter, r *http.Request) {
	slog.Info("completion request")
	var req CompletionRequest
	req.Options = Options(api.DefaultOptions())
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// Set the headers to indicate streaming
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Transfer-Encoding", "chunked")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	var samplingParams llama.SamplingParams
	samplingParams.TopK = req.TopK
	samplingParams.TopP = req.TopP
	samplingParams.MinP = req.MinP
	samplingParams.TfsZ = req.TFSZ
	samplingParams.TypicalP = req.TypicalP
	samplingParams.Temp = req.Temperature
	samplingParams.RepeatLastN = req.RepeatLastN
	samplingParams.PenaltyRepeat = req.RepeatPenalty
	samplingParams.PenaltyFreq = req.FrequencyPenalty
	samplingParams.PenaltyPresent = req.PresencePenalty
	samplingParams.Mirostat = req.Mirostat
	samplingParams.MirostatTau = req.MirostatTau
	samplingParams.MirostatEta = req.MirostatEta
	samplingParams.PenalizeNl = req.PenalizeNewline
	samplingParams.Seed = uint32(req.Seed)
	samplingParams.Grammar = req.Grammar

	seq, err := s.NewSequence(req.Prompt, req.Images, NewSequenceParams{
		numPredict:     req.NumPredict,
		stop:           req.Stop,
		numKeep:        req.NumKeep,
		samplingParams: &samplingParams,
		embedding:      false,
	})
	slog.Info("new sequence", "sequence", seq, "error", err)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create new sequence: %v", err), http.StatusInternalServerError)
		return
	}

	// Ensure that a place to put the sequence is available
	if err := s.seqsSem.Acquire(r.Context(), 1); err != nil {
		slog.Error("Failed to acquire semaphore", "error", err)
		return
	}
	defer s.seqsSem.Release(1)

	s.mu.Lock()
	for i, sq := range s.seqs {
		if sq == nil {
			seq.cache, seq.inputs, err = s.cache.LoadCacheSlot(seq.inputs, req.CachePrompt)
			slog.Info("Loaded cache", "inputs", seq.inputs, "cache", seq.cache)
			if err != nil {
				s.mu.Unlock()
				http.Error(w, fmt.Sprintf("Failed to load cache: %v", err), http.StatusInternalServerError)
				return
			}

			seq.crossAttention = s.image.NeedCrossAttention(seq.cache.Inputs...)

			s.seqs[i] = seq
			s.cond.Signal()
			break
		}
	}
	s.mu.Unlock()

	for {
		select {
		case <-r.Context().Done():
			close(seq.quit)
			return
		case content, ok := <-seq.responses:
			if ok {
				if err := json.NewEncoder(w).Encode(&CompletionResponse{
					Content: content,
				}); err != nil {
					http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
					close(seq.quit)
					return
				}

				flusher.Flush()
			} else {
				// Send the final response
				if err := json.NewEncoder(w).Encode(&CompletionResponse{
					Stop:         true,
					StoppedLimit: seq.doneReason == "limit",
					Timings: Timings{
						PromptN:     seq.numPromptInputs,
						PromptMS:    float64(seq.startGenerationTime.Sub(seq.startProcessingTime).Milliseconds()),
						PredictedN:  seq.numDecoded,
						PredictedMS: float64(time.Since(seq.startGenerationTime).Milliseconds()),
					},
				}); err != nil {
					http.Error(w, fmt.Sprintf("failed to encode final response: %v", err), http.StatusInternalServerError)
				}

				return
			}
		}
	}
}

type EmbeddingRequest struct {
	Content     string `json:"content"`
	CachePrompt bool   `json:"cache_prompt"`
}

type EmbeddingResponse struct {
	Embedding []float32 `json:"embedding"`
}

func (s *Server) embeddings(w http.ResponseWriter, r *http.Request) {
	slog.Info("embedding request")
	var req EmbeddingRequest

	LogToFile("embedding request in llama runner")
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("bad request: %s", err), http.StatusBadRequest)
		return
	}

	LogToFile("embedding request in llama runner" + req.Content)

	w.Header().Set("Content-Type", "application/json")

	slog.Info("embedding request", "content", req.Content)

	if os.Getenv("USE_MODEL2VEC") == "1" {
		// model2vec
		s.lc.InitializeModel2VecAndSave(s.modelPath, "")

		embedding, err := s.lc.GetModel2VecEmbeddings(s.modelPath, req.Content)

		if err != nil {
			http.Error(w, fmt.Sprintf("failed to get model2vec embedding: %v", err), http.StatusInternalServerError)
			return
		}
		if err := json.NewEncoder(w).Encode(&EmbeddingResponse{
			Embedding: embedding,
		}); err != nil {
			http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
		}

		s.lc.FreeModel2Vec()
		return
	}

	seq, err := s.NewSequence(req.Content, nil, NewSequenceParams{embedding: true})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create new sequence: %v", err), http.StatusInternalServerError)
		return
	}
	slog.Info("new sequence", "sequence", seq)

	// Ensure that a place to put the sequence is available
	if err := s.seqsSem.Acquire(r.Context(), 1); err != nil {
		slog.Error("Failed to acquire semaphore", "error", err)
		return
	}
	defer s.seqsSem.Release(1)

	LogToFile("Acquired semaphore")
	s.mu.Lock()
	for i, sq := range s.seqs {
		if sq == nil {
			seq.cache, seq.inputs, err = s.cache.LoadCacheSlot(seq.inputs, req.CachePrompt)
			slog.Info("Loaded cache", "inputs", seq.inputs, "cache", seq.cache)
			LogToFile("Loaded cache" + fmt.Sprintf("%v", seq.inputs))
			if err != nil {
				s.mu.Unlock()
				http.Error(w, fmt.Sprintf("Failed to load cache: %v", err), http.StatusInternalServerError)
				return
			}
			s.seqs[i] = seq
			s.cond.Signal()
			break
		}
	}
	s.mu.Unlock()

	LogToFile("Wait for embeddings in runner")

	embedding := <-seq.embedding

	LogToFile("Got embeddings in runner" + fmt.Sprintf("%v", embedding))
	if err := json.NewEncoder(w).Encode(&EmbeddingResponse{
		Embedding: embedding,
	}); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
	}
}

type HealthResponse struct {
	Status   string  `json:"status"`
	Progress float32 `json:"progress"`
}

type ServerStatus int

const (
	ServerStatusReady ServerStatus = iota
	ServerStatusLoadingModel
	ServerStatusError
)

func (s ServerStatus) ToString() string {
	switch s {
	case ServerStatusReady:
		return "ok"
	case ServerStatusLoadingModel:
		return "loading model"
	default:
		return "server error"
	}
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	slog.Info("health check")
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(&HealthResponse{
		Status:   s.status.ToString(),
		Progress: s.progress,
	}); err != nil {
		http.Error(w, fmt.Sprintf("failed to encode response: %v", err), http.StatusInternalServerError)
	}
}

func (s *Server) loadModel(
	params llama.ModelParams,
	mpath string,
	lpath string,
	ppath string,
	kvSize int,
	flashAttention bool,
	threads int,
	multiUserCache bool,
) {

	slog.Info("loading model", "path", mpath)
	llama.BackendInit()

	var err error
	s.model, err = llama.LoadModelFromFile(mpath, params)
	if err != nil {
		panic(err)
	}

	slog.Info("model loaded", "model", s.model)
	ctxParams := llama.NewContextParams(kvSize, s.batchSize*s.parallel, s.parallel, threads, flashAttention)
	slog.Info("context params", "params", ctxParams)
	s.lc, err = llama.NewContextWithModel(s.model, ctxParams)
	slog.Info("context created", "context", s.lc)
	if err != nil {
		panic(err)
	}

	if lpath != "" {
		err := s.model.ApplyLoraFromFile(s.lc, lpath, 1.0, threads)
		if err != nil {
			panic(err)
		}
	}

	if ppath != "" {
		var err error
		s.image, err = NewImageContext(s.lc, ppath)
		if err != nil {
			panic(err)
		}
	}

	s.cache, err = NewInputCache(s.lc, kvSize, s.parallel, multiUserCache)
	if err != nil {
		panic(err)
	}

	s.status = ServerStatusReady
	s.ready.Done()
}

func main() {
	// os.Exit(1)
	mpath := flag.String("model", "", "Path to model binary file")
	ppath := flag.String("mmproj", "", "Path to projector binary file")
	parallel := flag.Int("parallel", 1, "Number of sequences to handle simultaneously")
	batchSize := flag.Int("batch-size", 512, "Batch size")
	nGpuLayers := flag.Int("n-gpu-layers", 0, "Number of layers to offload to GPU")
	mainGpu := flag.Int("main-gpu", 0, "Main GPU")
	flashAttention := flag.Bool("flash-attn", false, "Enable flash attention")
	kvSize := flag.Int("ctx-size", 2048, "Context (or KV cache) size")
	lpath := flag.String("lora", "", "Path to lora layer file")
	port := flag.Int("port", 8080, "Port to expose the server on")
	threads := flag.Int("threads", runtime.NumCPU(), "Number of threads to use during generation")
	verbose := flag.Bool("verbose", false, "verbose output (default: disabled)")
	noMmap := flag.Bool("no-mmap", false, "do not memory-map model (slower load but may reduce pageouts if not using mlock)")
	mlock := flag.Bool("mlock", false, "force system to keep model in RAM rather than swapping or compressing")
	tensorSplit := flag.String("tensor-split", "", "fraction of the model to offload to each GPU, comma-separated list of proportions")
	multiUserCache := flag.Bool("multiuser-cache", false, "optimize input cache algorithm for multiple users")
	requirements := flag.Bool("requirements", false, "print json requirement information")

	flag.Parse()
	if *requirements {
		printRequirements(os.Stdout)
		return
	}
	level := slog.LevelInfo
	if *verbose {
		level = slog.LevelDebug
	}
	filePath := "./runner_server.log"
	fmt.Printf("Attempting to open log file at: %s\n", filePath)

	file, err := os.OpenFile(filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatalf("Failed to open log file: %v", err)
	}
	defer file.Close()
	fmt.Println("Log file successfully opened.")

	multiWriter := io.MultiWriter(os.Stderr, file)

	handler := slog.NewTextHandler(multiWriter, &slog.HandlerOptions{
		Level:     level,
		AddSource: true,
		ReplaceAttr: func(_ []string, attr slog.Attr) slog.Attr {
			if attr.Key == slog.SourceKey {
				source := attr.Value.Any().(*slog.Source)
				source.File = filepath.Base(source.File)
			}
			return attr
		},
	})
	slog.SetDefault(slog.New(handler))
	slog.Info("Starting some runner")
	slog.Info("starting go runner")
	slog.Info("system", "info", llama.PrintSystemInfo(), "threads", *threads)

	server := &Server{
		modelPath: *mpath,
		batchSize: *batchSize,
		parallel:  *parallel,
		seqs:      make([]*Sequence, *parallel),
		seqsSem:   semaphore.NewWeighted(int64(*parallel)),
		status:    ServerStatusLoadingModel,
	}

	var tensorSplitFloats []float32
	if *tensorSplit != "" {
		stringFloats := regexp.MustCompile(",").Split(*tensorSplit, -1)

		tensorSplitFloats = make([]float32, 0, len(stringFloats))
		for _, s := range stringFloats {
			f, _ := strconv.ParseFloat(s, 32)
			tensorSplitFloats = append(tensorSplitFloats, float32(f))
		}
	}

	params := llama.ModelParams{
		NumGpuLayers: *nGpuLayers,
		MainGpu:      *mainGpu,
		UseMmap:      !*noMmap && *lpath == "",
		UseMlock:     *mlock,
		TensorSplit:  tensorSplitFloats,
		Progress: func(progress float32) {
			server.progress = progress
		},
	}

	server.ready.Add(1)
	go server.loadModel(params, *mpath, *lpath, *ppath, *kvSize, *flashAttention, *threads, *multiUserCache)

	server.cond = sync.NewCond(&server.mu)

	ctx, cancel := context.WithCancel(context.Background())
	go server.run(ctx)

	addr := "127.0.0.1:" + strconv.Itoa(*port)
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Info("Listen error:", err)
		return
	}
	defer listener.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/embedding", server.embeddings)
	mux.HandleFunc("/completion", server.completion)
	mux.HandleFunc("/health", server.health)

	httpServer := http.Server{
		Handler: mux,
	}

	log.Println("Server listening on", addr)
	if err := httpServer.Serve(listener); err != nil {
		log.Fatal("server error:", err)
	}

	cancel()
}
