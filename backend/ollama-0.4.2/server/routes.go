package server

import (
	"bytes"
	"cmp"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net"
	"net/http"
	"net/netip"
	"os"
	"os/signal"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
	"gonum.org/v1/gonum/mat"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/build"
	"github.com/ollama/ollama/discover"
	"github.com/ollama/ollama/envconfig"
	"github.com/ollama/ollama/llm"
	"github.com/ollama/ollama/openai"
	"github.com/ollama/ollama/parser"
	"github.com/ollama/ollama/runners"
	"github.com/ollama/ollama/server/imageproc"
	"github.com/ollama/ollama/template"
	"github.com/ollama/ollama/types/errtypes"
	"github.com/ollama/ollama/types/model"
	"github.com/ollama/ollama/version"
)

var mode string = gin.DebugMode

type Server struct {
	addr  net.Addr
	sched *Scheduler
}

func init() {
	switch mode {
	case gin.DebugMode:
	case gin.ReleaseMode:
	case gin.TestMode:
	default:
		mode = gin.DebugMode
	}

	gin.SetMode(mode)
}

var (
	errRequired    = errors.New("is required")
	errBadTemplate = errors.New("template error")
)

func modelOptions(model *Model, requestOpts map[string]interface{}) (api.Options, error) {
	opts := api.DefaultOptions()
	if err := opts.FromMap(model.Options); err != nil {
		return api.Options{}, err
	}

	if err := opts.FromMap(requestOpts); err != nil {
		return api.Options{}, err
	}

	return opts, nil
}

// scheduleRunner schedules a runner after validating inputs such as capabilities and model options.
// It returns the allocated runner, model instance, and consolidated options if successful and error otherwise.
func (s *Server) scheduleRunner(ctx context.Context, name string, caps []Capability, requestOpts map[string]any, keepAlive *api.Duration) (llm.LlamaServer, *Model, *api.Options, error) {
	if name == "" {
		return nil, nil, nil, fmt.Errorf("model %w", errRequired)
	}

	model, err := GetModel(name)
	if err != nil {
		return nil, nil, nil, err
	}

	if err := model.CheckCapabilities(caps...); err != nil {
		return nil, nil, nil, fmt.Errorf("%s %w", name, err)
	}

	opts, err := modelOptions(model, requestOpts)
	if err != nil {
		return nil, nil, nil, err
	}

	runnerCh, errCh := s.sched.GetRunner(ctx, model, opts, keepAlive)
	var runner *runnerRef
	select {
	case runner = <-runnerCh:
	case err = <-errCh:
		return nil, nil, nil, err
	}

	return runner.llama, model, &opts, nil
}

func (s *Server) GenerateHandler(c *gin.Context) {
	checkpointStart := time.Now()
	var req api.GenerateRequest
	if err := c.ShouldBindJSON(&req); errors.Is(err, io.EOF) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	} else if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	model, err := GetModel(req.Model)
	if err != nil {
		switch {
		case os.IsNotExist(err):
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model '%s' not found", req.Model)})
		case err.Error() == "invalid model name":
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// expire the runner
	if req.Prompt == "" && req.KeepAlive != nil && int(req.KeepAlive.Seconds()) == 0 {
		s.sched.expireRunner(model)

		c.JSON(http.StatusOK, api.GenerateResponse{
			Model:      req.Model,
			CreatedAt:  time.Now().UTC(),
			Response:   "",
			Done:       true,
			DoneReason: "unload",
		})
		return
	}

	if req.Format != "" && req.Format != "json" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "format must be empty or \"json\""})
		return
	} else if req.Raw && (req.Template != "" || req.System != "" || len(req.Context) > 0) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "raw mode does not support template, system, or context"})
		return
	}

	caps := []Capability{CapabilityCompletion}
	if req.Suffix != "" {
		caps = append(caps, CapabilityInsert)
	}

	r, m, opts, err := s.scheduleRunner(c.Request.Context(), req.Model, caps, req.Options, req.KeepAlive)
	if errors.Is(err, errCapabilityCompletion) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("%q does not support generate", req.Model)})
		return
	} else if err != nil {
		handleScheduleError(c, req.Model, err)
		return
	}

	checkpointLoaded := time.Now()

	// load the model
	if req.Prompt == "" {
		c.JSON(http.StatusOK, api.GenerateResponse{
			Model:      req.Model,
			CreatedAt:  time.Now().UTC(),
			Done:       true,
			DoneReason: "load",
		})
		return
	}

	isMllama := checkMllamaModelFamily(model)
	if isMllama && len(req.Images) > 1 {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "this model only supports one image: more than one image sent"})
		return
	}

	images := make([]llm.ImageData, len(req.Images))
	for i := range req.Images {
		if isMllama {
			data, aspectRatioID, err := imageproc.Preprocess(req.Images[i])
			if err != nil {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "error processing image"})
				return
			}

			buf := new(bytes.Buffer)
			err = binary.Write(buf, binary.LittleEndian, data)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "error processing image"})
				return
			}

			images[i] = llm.ImageData{ID: i, Data: buf.Bytes(), AspectRatioID: aspectRatioID}
		} else {
			images[i] = llm.ImageData{ID: i, Data: req.Images[i]}
		}
	}

	prompt := req.Prompt
	if !req.Raw {
		tmpl := m.Template
		if req.Template != "" {
			tmpl, err = template.Parse(req.Template)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		var values template.Values
		if req.Suffix != "" {
			values.Prompt = prompt
			values.Suffix = req.Suffix
		} else {
			var msgs []api.Message
			if req.System != "" {
				msgs = append(msgs, api.Message{Role: "system", Content: req.System})
			} else if m.System != "" {
				msgs = append(msgs, api.Message{Role: "system", Content: m.System})
			}

			if req.Context == nil {
				msgs = append(msgs, m.Messages...)
			}

			for _, i := range images {
				imgPrompt := ""
				if isMllama {
					imgPrompt = "<|image|>"
				}
				msgs = append(msgs, api.Message{Role: "user", Content: fmt.Sprintf("[img-%d]"+imgPrompt, i.ID)})
			}

			values.Messages = append(msgs, api.Message{Role: "user", Content: req.Prompt})
		}

		var b bytes.Buffer
		if req.Context != nil {
			s, err := r.Detokenize(c.Request.Context(), req.Context)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			b.WriteString(s)
		}

		if err := tmpl.Execute(&b, values); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		prompt = b.String()
	}

	slog.Debug("generate request", "images", len(images), "prompt", prompt)

	ch := make(chan any)
	go func() {
		// TODO (jmorganca): avoid building the response twice both here and below
		var sb strings.Builder
		defer close(ch)
		if err := r.Completion(c.Request.Context(), llm.CompletionRequest{
			Prompt:  prompt,
			Images:  images,
			Format:  req.Format,
			Options: opts,
		}, func(cr llm.CompletionResponse) {
			res := api.GenerateResponse{
				Model:      req.Model,
				CreatedAt:  time.Now().UTC(),
				Response:   cr.Content,
				Done:       cr.Done,
				DoneReason: cr.DoneReason,
				Metrics: api.Metrics{
					PromptEvalCount:    cr.PromptEvalCount,
					PromptEvalDuration: cr.PromptEvalDuration,
					EvalCount:          cr.EvalCount,
					EvalDuration:       cr.EvalDuration,
				},
			}

			if _, err := sb.WriteString(cr.Content); err != nil {
				ch <- gin.H{"error": err.Error()}
			}

			if cr.Done {
				res.TotalDuration = time.Since(checkpointStart)
				res.LoadDuration = checkpointLoaded.Sub(checkpointStart)

				if !req.Raw {
					tokens, err := r.Tokenize(c.Request.Context(), prompt+sb.String())
					if err != nil {
						ch <- gin.H{"error": err.Error()}
						return
					}
					res.Context = tokens
				}
			}

			ch <- res
		}); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	if req.Stream != nil && !*req.Stream {
		var r api.GenerateResponse
		var sb strings.Builder
		for rr := range ch {
			switch t := rr.(type) {
			case api.GenerateResponse:
				sb.WriteString(t.Response)
				r = t
			case gin.H:
				msg, ok := t["error"].(string)
				if !ok {
					msg = "unexpected error format in response"
				}

				c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
				return
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": "unexpected response"})
				return
			}
		}

		r.Response = sb.String()
		c.JSON(http.StatusOK, r)
		return
	}

	streamResponse(c, ch)
}


func saveEmbeddingsToFile(path string, cache map[string][]float32) error {
    file, err := os.Create(path)
    if err != nil {
        return err
    }
    defer file.Close()

    encoder := json.NewEncoder(file)
    return encoder.Encode(cache)
}

func loadEmbeddingsFromFile(path string) (map[string][]float32, error) {
    file, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer file.Close()

    var cache map[string][]float32
    decoder := json.NewDecoder(file)
    err = decoder.Decode(&cache)
    return cache, err
}


func (s *Server) FastEmbedHandler(c *gin.Context) {
    checkpointStart := time.Now()
    var req api.EmbedRequest
    err := c.ShouldBindJSON(&req)
    if err != nil {
        if errors.Is(err, io.EOF) {
            c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
        } else {
            c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        }
        return
    }

    truncate := req.Truncate == nil || *req.Truncate
    var input []string

    switch i := req.Input.(type) {
    case string:
        if len(i) > 0 {
            input = append(input, i)
        }
    case []any:
        for _, v := range i {
            if str, ok := v.(string); ok {
                input = append(input, str)
            } else {
                c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid input type"})
                return
            }
        }
    default:
        if req.Input != nil {
            c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid input type"})
            return
        }
    }

    if len(input) == 0 {
        c.JSON(http.StatusOK, api.EmbedResponse{Model: req.Model, Embeddings: [][]float32{}})
        return
    }

    r, m, opts, err := s.scheduleRunner(c.Request.Context(), req.Model, []Capability{}, req.Options, req.KeepAlive)
    if err != nil {
        handleScheduleError(c, req.Model, err)
        return
    }

    checkpointLoaded := time.Now()

    kvData, err := getKVData(m.ModelPath, false)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    var count int

    for i, s := range input {
        tokens, err := r.Tokenize(c.Request.Context(), s)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        ctxLen := min(opts.NumCtx, int(kvData.ContextLength()))
        if len(tokens) > ctxLen {
            if !truncate {
                c.JSON(http.StatusBadRequest, gin.H{"error": "input length exceeds maximum context length"})
                return
            }

            tokens = tokens[:ctxLen]
            s, err = r.Detokenize(c.Request.Context(), tokens)
            if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
            }
        }

        count += len(tokens)
        input[i] = s
    }

    var g errgroup.Group
	embeddings := make([][]float32, len(input))
	for i, text := range input {
		g.Go(func() error {
			fmt.Println("Embedding")
			embedding, err := r.Embedding(c.Request.Context(), text)
			// fmt.Println("embedding received?", embedding)
			if err != nil {
				return err
			}
			embeddings[i] = normalize(embedding)
			return nil
		})
	}


    // Apply PCA
	embeddings = applyPCA(embeddings)

    // Apply SIF weighting
	embeddings = applySIF(embeddings, map[string]float32{})
    resp := api.EmbedResponse{
        Model:           req.Model,
        Embeddings:      embeddings,
        TotalDuration:   time.Since(checkpointStart),
        LoadDuration:    checkpointLoaded.Sub(checkpointStart),
        PromptEvalCount: count,
    }

    c.JSON(http.StatusOK, resp)
}

// Example for PCA Application
func applyPCA(embeddings [][]float32, opts ...int) [][]float32 {
	numComponents := 10
	if len(opts) == 0 {
		numComponents = opts[0]
	}

    // Flatten the embeddings into a 2D matrix for PCA
    data := flattenFloat32Slice(embeddings)
    rows := len(embeddings)
    cols := len(embeddings[0])
    matData := mat.NewDense(rows, cols, data)

    var svd mat.SVD
    if ok := svd.Factorize(matData, mat.SVDThin); !ok {
        panic("SVD factorization failed")
    }

    var reduced mat.Dense
    svd.VTo(&reduced)
    reducedData := reduced.RawMatrix().Data[:rows*numComponents]
    return reshapeFloat32Slice(reducedData, rows, numComponents)
}

// Example for SIF Application
func applySIF(embeddings [][]float32, tokenProbs map[string]float32) [][]float32 {
    weight := func(prob float32) float32 {
        return 1e-3 / (1e-3 + prob)
    }

    for i, emb := range embeddings {
        tokenWeight := weight(tokenProbs["<token-key>"]) // Replace with actual token logic
        for j := range emb {
            emb[j] *= tokenWeight
        }
        embeddings[i] = emb
    }
    return embeddings
}

// Utility functions for PCA matrix operations
func flattenFloat32Slice(data [][]float32) []float64 {
    var flat []float64
    for _, row := range data {
        for _, val := range row {
            flat = append(flat, float64(val))
        }
    }
    return flat
}

func reshapeFloat32Slice(data []float64, rows, cols int) [][]float32 {
    reshaped := make([][]float32, rows)
    for i := 0; i < rows; i++ {
        reshaped[i] = make([]float32, cols)
        for j := 0; j < cols; j++ {
            reshaped[i][j] = float32(data[i*cols+j])
        }
    }
    return reshaped
}

func (s *Server) EmbedHandler(c *gin.Context) {
	checkpointStart := time.Now()
	var req api.EmbedRequest
	err := c.ShouldBindJSON(&req)
	fmt.Println("req", req.Input)
	switch {
	case errors.Is(err, io.EOF):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	case err != nil:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	truncate := true

	if req.Truncate != nil && !*req.Truncate {
		truncate = false
	}

	var input []string

	switch i := req.Input.(type) {
	case string:
		if len(i) > 0 {
			input = append(input, i)
		}
	case []any:
		for _, v := range i {
			if _, ok := v.(string); !ok {
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid input type"})
				return
			}
			input = append(input, v.(string))
		}
	default:
		if req.Input != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid input type"})
			return
		}
	}

	fmt.Println("Scheduling runner")
	r, m, opts, err := s.scheduleRunner(c.Request.Context(), req.Model, []Capability{}, req.Options, req.KeepAlive)
	if err != nil {
		handleScheduleError(c, req.Model, err)
		return
	}

	checkpointLoaded := time.Now()

	if len(input) == 0 {
		c.JSON(http.StatusOK, api.EmbedResponse{Model: req.Model, Embeddings: [][]float32{}})
		return
	}

	kvData, err := getKVData(m.ModelPath, false)
	fmt.Println("kvData", kvData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var count int

	fmt.Println("input length", len(input))

	for i, s := range input {
		tokens, err := r.Tokenize(c.Request.Context(), s)
		fmt.Println("tokens", tokens)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ctxLen := min(opts.NumCtx, int(kvData.ContextLength()))
		if len(tokens) > ctxLen {
			if !truncate {
				c.JSON(http.StatusBadRequest, gin.H{"error": "input length exceeds maximum context length"})
				return
			}

			tokens = tokens[:ctxLen]
			fmt.Println("Detokenizing")
			s, err = r.Detokenize(c.Request.Context(), tokens)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		count += len(tokens)

		input[i] = s
	}

	var g errgroup.Group
	embeddings := make([][]float32, len(input))
	for i, text := range input {
		g.Go(func() error {
			fmt.Println("Embedding")
			embedding, err := r.Embedding(c.Request.Context(), text)
			// fmt.Println("embedding received?", embedding)
			if err != nil {
				return err
			}
			embeddings[i] = normalize(embedding)
			return nil
		})
	}

	fmt.Println("Waiting for embeddings")

	if err := g.Wait(); err != nil {
		slog.Error("embedding generation failed", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Errorf("failed to generate embeddings: %v", err)})
		return
	}

	// fmt.Println("Embeddings", embeddings)

	resp := api.EmbedResponse{
		Model:           req.Model,
		Embeddings:      embeddings,
		TotalDuration:   time.Since(checkpointStart),
		LoadDuration:    checkpointLoaded.Sub(checkpointStart),
		PromptEvalCount: count,
	}
	c.JSON(http.StatusOK, resp)
}

func normalize(vec []float32) []float32 {
	var sum float32
	for _, v := range vec {
		sum += v * v
	}

	norm := float32(0.0)
	if sum > 0 {
		norm = float32(1.0 / math.Sqrt(float64(sum)))
	}

	for i := range vec {
		vec[i] *= norm
	}
	return vec
}

func (s *Server) EmbeddingsHandler(c *gin.Context) {
	var req api.EmbeddingRequest
	if err := c.ShouldBindJSON(&req); errors.Is(err, io.EOF) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	} else if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	r, _, _, err := s.scheduleRunner(c.Request.Context(), req.Model, []Capability{}, req.Options, req.KeepAlive)
	if err != nil {
		handleScheduleError(c, req.Model, err)
		return
	}

	// an empty request loads the model
	if req.Prompt == "" {
		c.JSON(http.StatusOK, api.EmbeddingResponse{Embedding: []float64{}})
		return
	}

	embedding, err := r.Embedding(c.Request.Context(), req.Prompt)
	if err != nil {
		slog.Info(fmt.Sprintf("embedding generation failed: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate embedding"})
		return
	}

	var e []float64
	for _, v := range embedding {
		e = append(e, float64(v))
	}

	resp := api.EmbeddingResponse{
		Embedding: e,
	}
	c.JSON(http.StatusOK, resp)
}

func (s *Server) PullHandler(c *gin.Context) {
	var req api.PullRequest
	err := c.ShouldBindJSON(&req)
	switch {
	case errors.Is(err, io.EOF):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	case err != nil:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := model.ParseName(cmp.Or(req.Model, req.Name))
	if !name.IsValid() {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "invalid model name"})
		return
	}

	if err := checkNameExists(name); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(r api.ProgressResponse) {
			ch <- r
		}

		regOpts := &registryOptions{
			Insecure: req.Insecure,
		}

		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		if err := PullModel(ctx, name.DisplayShortest(), regOpts, fn); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	if req.Stream != nil && !*req.Stream {
		waitForStream(c, ch)
		return
	}

	streamResponse(c, ch)
}

func (s *Server) PushHandler(c *gin.Context) {
	var req api.PushRequest
	err := c.ShouldBindJSON(&req)
	switch {
	case errors.Is(err, io.EOF):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	case err != nil:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var model string
	if req.Model != "" {
		model = req.Model
	} else if req.Name != "" {
		model = req.Name
	} else {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "model is required"})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(r api.ProgressResponse) {
			ch <- r
		}

		regOpts := &registryOptions{
			Insecure: req.Insecure,
		}

		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		if err := PushModel(ctx, model, regOpts, fn); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	if req.Stream != nil && !*req.Stream {
		waitForStream(c, ch)
		return
	}

	streamResponse(c, ch)
}

func checkNameExists(name model.Name) error {
	names, err := Manifests(true)
	if err != nil {
		return err
	}

	for n := range names {
		if strings.EqualFold(n.Filepath(), name.Filepath()) && n != name {
			return errors.New("a model with that name already exists")
		}
	}

	return nil
}

func (s *Server) CreateHandler(c *gin.Context) {
	var r api.CreateRequest
	if err := c.ShouldBindJSON(&r); errors.Is(err, io.EOF) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	} else if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := model.ParseName(cmp.Or(r.Model, r.Name))
	if !name.IsValid() {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": errtypes.InvalidModelNameErrMsg})
		return
	}

	if err := checkNameExists(name); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if r.Path == "" && r.Modelfile == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "path or modelfile are required"})
		return
	}

	var sr io.Reader = strings.NewReader(r.Modelfile)
	if r.Path != "" && r.Modelfile == "" {
		f, err := os.Open(r.Path)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("error reading modelfile: %s", err)})
			return
		}
		defer f.Close()

		sr = f
	}

	f, err := parser.ParseFile(sr)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ch := make(chan any)
	go func() {
		defer close(ch)
		fn := func(resp api.ProgressResponse) {
			ch <- resp
		}

		ctx, cancel := context.WithCancel(c.Request.Context())
		defer cancel()

		quantization := cmp.Or(r.Quantize, r.Quantization)
		if err := CreateModel(ctx, name, filepath.Dir(r.Path), strings.ToUpper(quantization), f, fn); errors.Is(err, errBadTemplate) {
			ch <- gin.H{"error": err.Error(), "status": http.StatusBadRequest}
		} else if err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	if r.Stream != nil && !*r.Stream {
		waitForStream(c, ch)
		return
	}

	streamResponse(c, ch)
}

func (s *Server) DeleteHandler(c *gin.Context) {
	var r api.DeleteRequest
	if err := c.ShouldBindJSON(&r); errors.Is(err, io.EOF) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	} else if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	n := model.ParseName(cmp.Or(r.Model, r.Name))
	if !n.IsValid() {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("name %q is invalid", cmp.Or(r.Model, r.Name))})
		return
	}

	m, err := ParseNamedManifest(n)
	if err != nil {
		switch {
		case os.IsNotExist(err):
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model '%s' not found", cmp.Or(r.Model, r.Name))})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	if err := m.Remove(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := m.RemoveLayers(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
}

func (s *Server) ShowHandler(c *gin.Context) {
	var req api.ShowRequest
	err := c.ShouldBindJSON(&req)
	switch {
	case errors.Is(err, io.EOF):
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	case err != nil:
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Model != "" {
		// noop
	} else if req.Name != "" {
		req.Model = req.Name
	} else {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "model is required"})
		return
	}

	resp, err := GetModelInfo(req)
	if err != nil {
		switch {
		case os.IsNotExist(err):
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model '%s' not found", req.Model)})
		case err.Error() == "invalid model name":
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

func GetModelInfo(req api.ShowRequest) (*api.ShowResponse, error) {
	m, err := GetModel(req.Model)
	if err != nil {
		return nil, err
	}

	modelDetails := api.ModelDetails{
		ParentModel:       m.ParentModel,
		Format:            m.Config.ModelFormat,
		Family:            m.Config.ModelFamily,
		Families:          m.Config.ModelFamilies,
		ParameterSize:     m.Config.ModelType,
		QuantizationLevel: m.Config.FileType,
	}

	if req.System != "" {
		m.System = req.System
	}

	msgs := make([]api.Message, len(m.Messages))
	for i, msg := range m.Messages {
		msgs[i] = api.Message{Role: msg.Role, Content: msg.Content}
	}

	n := model.ParseName(req.Model)
	if !n.IsValid() {
		return nil, errors.New("invalid model name")
	}

	manifest, err := ParseNamedManifest(n)
	if err != nil {
		return nil, err
	}

	resp := &api.ShowResponse{
		License:    strings.Join(m.License, "\n"),
		System:     m.System,
		Template:   m.Template.String(),
		Details:    modelDetails,
		Messages:   msgs,
		ModifiedAt: manifest.fi.ModTime(),
	}

	var params []string
	cs := 30
	for k, v := range m.Options {
		switch val := v.(type) {
		case []interface{}:
			for _, nv := range val {
				params = append(params, fmt.Sprintf("%-*s %#v", cs, k, nv))
			}
		default:
			params = append(params, fmt.Sprintf("%-*s %#v", cs, k, v))
		}
	}
	resp.Parameters = strings.Join(params, "\n")

	for k, v := range req.Options {
		if _, ok := req.Options[k]; ok {
			m.Options[k] = v
		}
	}

	var sb strings.Builder
	fmt.Fprintln(&sb, "# Modelfile generated by \"ollama show\"")
	fmt.Fprintln(&sb, "# To build a new Modelfile based on this, replace FROM with:")
	fmt.Fprintf(&sb, "# FROM %s\n\n", m.ShortName)
	fmt.Fprint(&sb, m.String())
	resp.Modelfile = sb.String()

	kvData, err := getKVData(m.ModelPath, req.Verbose)
	if err != nil {
		return nil, err
	}
	delete(kvData, "general.name")
	delete(kvData, "tokenizer.chat_template")
	resp.ModelInfo = kvData

	if len(m.ProjectorPaths) > 0 {
		projectorData, err := getKVData(m.ProjectorPaths[0], req.Verbose)
		if err != nil {
			return nil, err
		}
		resp.ProjectorInfo = projectorData
	}

	return resp, nil
}

func getKVData(digest string, verbose bool) (llm.KV, error) {
	maxArraySize := 0
	if verbose {
		maxArraySize = -1
	}
	kvData, err := llm.LoadModel(digest, maxArraySize)
	if err != nil {
		return nil, err
	}


	fmt.Println("kvData", kvData)

	kv := kvData.KV()

	fmt.Println("kv", kv)
	if !verbose {
		for k := range kv {
			if t, ok := kv[k].([]any); len(t) > 5 && ok {
				kv[k] = []any{}
			}
		}
	}

	for k,v := range kv {
		if strings.HasPrefix(k,"tokenizer") {
			fmt.Println("k", k, "v", v, "type", reflect.TypeOf(v))
			if reflect.TypeOf(v).String() == "*llm.array" {
				vv := llm.ConvertToArray(v)
				fmt.Println("v size", vv.Size)
				fmt.Println("v data", vv.Values)
			}
		}
	}

	return kv, nil
}

func (s *Server) ListHandler(c *gin.Context) {
	ms, err := Manifests(true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	models := []api.ListModelResponse{}
	for n, m := range ms {
		var cf ConfigV2

		if m.Config.Digest != "" {
			f, err := m.Config.Open()
			if err != nil {
				slog.Warn("bad manifest filepath", "name", n, "error", err)
				continue
			}
			defer f.Close()

			if err := json.NewDecoder(f).Decode(&cf); err != nil {
				slog.Warn("bad manifest config", "name", n, "error", err)
				continue
			}
		}

		// tag should never be masked
		models = append(models, api.ListModelResponse{
			Model:      n.DisplayShortest(),
			Name:       n.DisplayShortest(),
			Size:       m.Size(),
			Digest:     m.digest,
			ModifiedAt: m.fi.ModTime(),
			Details: api.ModelDetails{
				Format:            cf.ModelFormat,
				Family:            cf.ModelFamily,
				Families:          cf.ModelFamilies,
				ParameterSize:     cf.ModelType,
				QuantizationLevel: cf.FileType,
			},
		})
	}

	slices.SortStableFunc(models, func(i, j api.ListModelResponse) int {
		// most recently modified first
		return cmp.Compare(j.ModifiedAt.Unix(), i.ModifiedAt.Unix())
	})

	c.JSON(http.StatusOK, api.ListResponse{Models: models})
}

func (s *Server) CopyHandler(c *gin.Context) {
	var r api.CopyRequest
	if err := c.ShouldBindJSON(&r); errors.Is(err, io.EOF) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	} else if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	src := model.ParseName(r.Source)
	if !src.IsValid() {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("source %q is invalid", r.Source)})
		return
	}

	dst := model.ParseName(r.Destination)
	if !dst.IsValid() {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("destination %q is invalid", r.Destination)})
		return
	}

	if err := checkNameExists(dst); err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := CopyModel(src, dst); errors.Is(err, os.ErrNotExist) {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model %q not found", r.Source)})
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func (s *Server) HeadBlobHandler(c *gin.Context) {
	path, err := GetBlobsPath(c.Param("digest"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if _, err := os.Stat(path); err != nil {
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("blob %q not found", c.Param("digest"))})
		return
	}

	c.Status(http.StatusOK)
}

func (s *Server) CreateBlobHandler(c *gin.Context) {
	if ib, ok := intermediateBlobs[c.Param("digest")]; ok {
		p, err := GetBlobsPath(ib)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if _, err := os.Stat(p); errors.Is(err, os.ErrNotExist) {
			slog.Info("evicting intermediate blob which no longer exists", "digest", ib)
			delete(intermediateBlobs, c.Param("digest"))
		} else if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		} else {
			c.Status(http.StatusOK)
			return
		}
	}

	path, err := GetBlobsPath(c.Param("digest"))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	_, err = os.Stat(path)
	switch {
	case errors.Is(err, os.ErrNotExist):
		// noop
	case err != nil:
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	default:
		c.Status(http.StatusOK)
		return
	}

	layer, err := NewLayer(c.Request.Body, "")
	if err != nil {
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if layer.Digest != c.Param("digest") {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("digest mismatch, expected %q, got %q", c.Param("digest"), layer.Digest)})
		return
	}

	c.Status(http.StatusCreated)
}

func isLocalIP(ip netip.Addr) bool {
	if interfaces, err := net.Interfaces(); err == nil {
		for _, iface := range interfaces {
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}

			for _, a := range addrs {
				if parsed, _, err := net.ParseCIDR(a.String()); err == nil {
					if parsed.String() == ip.String() {
						return true
					}
				}
			}
		}
	}

	return false
}

func allowedHost(host string) bool {
	if host == "" || host == "localhost" {
		return true
	}

	if hostname, err := os.Hostname(); err == nil && host == hostname {
		return true
	}

	tlds := []string{
		"localhost",
		"local",
		"internal",
	}

	// check if the host is a local TLD
	for _, tld := range tlds {
		if strings.HasSuffix(host, "."+tld) {
			return true
		}
	}

	return false
}

func allowedHostsMiddleware(addr net.Addr) gin.HandlerFunc {
	return func(c *gin.Context) {
		if addr == nil {
			c.Next()
			return
		}

		if addr, err := netip.ParseAddrPort(addr.String()); err == nil && !addr.Addr().IsLoopback() {
			c.Next()
			return
		}

		host, _, err := net.SplitHostPort(c.Request.Host)
		if err != nil {
			host = c.Request.Host
		}

		if addr, err := netip.ParseAddr(host); err == nil {
			if addr.IsLoopback() || addr.IsPrivate() || addr.IsUnspecified() || isLocalIP(addr) {
				c.Next()
				return
			}
		}

		if allowedHost(host) {
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusNoContent)
				return
			}

			c.Next()
			return
		}

		c.AbortWithStatus(http.StatusForbidden)
	}
}

func (s *Server) GenerateRoutes() http.Handler {
	config := cors.DefaultConfig()
	config.AllowWildcard = true
	config.AllowBrowserExtensions = true
	config.AllowHeaders = []string{"Authorization", "Content-Type", "User-Agent", "Accept", "X-Requested-With"}
	openAIProperties := []string{"lang", "package-version", "os", "arch", "runtime", "runtime-version", "async"}
	for _, prop := range openAIProperties {
		config.AllowHeaders = append(config.AllowHeaders, "x-stainless-"+prop)
	}
	config.AllowOrigins = envconfig.Origins()

	r := gin.Default()
	r.Use(
		cors.New(config),
		allowedHostsMiddleware(s.addr),
	)

	r.POST("/api/pull", s.PullHandler)
	r.POST("/api/generate", s.GenerateHandler)
	r.POST("/api/chat", s.ChatHandler)
	r.POST("/api/embed", s.EmbedHandler)
	r.POST("/api/fast-embed", s.FastEmbedHandler)
	r.POST("/api/embeddings", s.EmbeddingsHandler)
	r.POST("/api/create", s.CreateHandler)
	r.POST("/api/push", s.PushHandler)
	r.POST("/api/copy", s.CopyHandler)
	r.DELETE("/api/delete", s.DeleteHandler)
	r.POST("/api/show", s.ShowHandler)
	r.POST("/api/blobs/:digest", s.CreateBlobHandler)
	r.HEAD("/api/blobs/:digest", s.HeadBlobHandler)
	r.GET("/api/ps", s.PsHandler)

	// Compatibility endpoints
	r.POST("/v1/chat/completions", openai.ChatMiddleware(), s.ChatHandler)
	r.POST("/v1/completions", openai.CompletionsMiddleware(), s.GenerateHandler)
	r.POST("/v1/embeddings", openai.EmbeddingsMiddleware(), s.EmbedHandler)
	r.GET("/v1/models", openai.ListMiddleware(), s.ListHandler)
	r.GET("/v1/models/:model", openai.RetrieveMiddleware(), s.ShowHandler)

	for _, method := range []string{http.MethodGet, http.MethodHead} {
		r.Handle(method, "/", func(c *gin.Context) {
			c.String(http.StatusOK, "Ollama is running")
		})

		r.Handle(method, "/api/tags", s.ListHandler)
		r.Handle(method, "/api/version", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"version": version.Version})
		})
	}

	return r
}

func Serve(ln net.Listener) error {
	level := slog.LevelInfo
	if envconfig.Debug() {
		level = slog.LevelDebug
	}

	slog.Info("server config", "env", envconfig.Values())
	handler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
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

	blobsDir, err := GetBlobsPath("")
	if err != nil {
		return err
	}
	if err := fixBlobs(blobsDir); err != nil {
		return err
	}

	if !envconfig.NoPrune() {
		if _, err := Manifests(false); err != nil {
			slog.Warn("corrupt manifests detected, skipping prune operation.  Re-pull or delete to clear", "error", err)
		} else {
			// clean up unused layers and manifests
			if err := PruneLayers(); err != nil {
				return err
			}

			manifestsPath, err := GetManifestPath()
			if err != nil {
				return err
			}

			if err := PruneDirectory(manifestsPath); err != nil {
				return err
			}
		}
	}

	ctx, done := context.WithCancel(context.Background())
	schedCtx, schedDone := context.WithCancel(ctx)
	sched := InitScheduler(schedCtx)
	s := &Server{addr: ln.Addr(), sched: sched}

	http.Handle("/", s.GenerateRoutes())

	slog.Info(fmt.Sprintf("Listening on %s (version %s)", ln.Addr(), version.Version))
	srvr := &http.Server{
		// Use http.DefaultServeMux so we get net/http/pprof for
		// free.
		//
		// TODO(bmizerany): Decide if we want to make this
		// configurable so it is not exposed by default, or allow
		// users to bind it to a different port. This was a quick
		// and easy way to get pprof, but it may not be the best
		// way.
		Handler: nil,
	}

	// listen for a ctrl+c and stop any loaded llm
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-signals
		srvr.Close()
		schedDone()
		sched.unloadAllRunners()
		fmt.Println("Should start cleanup")
		runners.Cleanup(build.EmbedFS)
		done()
	}()

	fmt.Println("Refreshing llm runners in routes", build.EmbedFS)

	if _, err := runners.Refresh(build.EmbedFS); err != nil {
		return fmt.Errorf("unable to initialize llm runners %w", err)
	}

	s.sched.Run(schedCtx)

	// At startup we retrieve GPU information so we can get log messages before loading a model
	// This will log warnings to the log in case we have problems with detected GPUs
	gpus := discover.GetGPUInfo()
	gpus.LogDetails()

	err = srvr.Serve(ln)
	// If server is closed from the signal handler, wait for the ctx to be done
	// otherwise error out quickly
	if !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	<-ctx.Done()
	return nil
}

func waitForStream(c *gin.Context, ch chan interface{}) {
	c.Header("Content-Type", "application/json")
	for resp := range ch {
		switch r := resp.(type) {
		case api.ProgressResponse:
			if r.Status == "success" {
				c.JSON(http.StatusOK, r)
				return
			}
		case gin.H:
			status, ok := r["status"].(int)
			if !ok {
				status = http.StatusInternalServerError
			}
			if errorMsg, ok := r["error"].(string); ok {
				c.JSON(status, gin.H{"error": errorMsg})
				return
			} else {
				c.JSON(status, gin.H{"error": "unexpected error format in progress response"})
				return
			}
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "unexpected progress response"})
			return
		}
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "unexpected end of progress response"})
}

func streamResponse(c *gin.Context, ch chan any) {
	c.Header("Content-Type", "application/x-ndjson")
	c.Stream(func(w io.Writer) bool {
		val, ok := <-ch
		if !ok {
			return false
		}

		bts, err := json.Marshal(val)
		if err != nil {
			slog.Info(fmt.Sprintf("streamResponse: json.Marshal failed with %s", err))
			return false
		}

		// Delineate chunks with new-line delimiter
		bts = append(bts, '\n')
		if _, err := w.Write(bts); err != nil {
			slog.Info(fmt.Sprintf("streamResponse: w.Write failed with %s", err))
			return false
		}

		return true
	})
}

func (s *Server) PsHandler(c *gin.Context) {
	models := []api.ProcessModelResponse{}

	for _, v := range s.sched.loaded {
		model := v.model
		modelDetails := api.ModelDetails{
			Format:            model.Config.ModelFormat,
			Family:            model.Config.ModelFamily,
			Families:          model.Config.ModelFamilies,
			ParameterSize:     model.Config.ModelType,
			QuantizationLevel: model.Config.FileType,
		}

		mr := api.ProcessModelResponse{
			Model:     model.ShortName,
			Name:      model.ShortName,
			Size:      int64(v.estimatedTotal),
			SizeVRAM:  int64(v.estimatedVRAM),
			Digest:    model.Digest,
			Details:   modelDetails,
			ExpiresAt: v.expiresAt,
		}
		// The scheduler waits to set expiresAt, so if a model is loading it's
		// possible that it will be set to the unix epoch. For those cases, just
		// calculate the time w/ the sessionDuration instead.
		var epoch time.Time
		if v.expiresAt == epoch {
			mr.ExpiresAt = time.Now().Add(v.sessionDuration)
		}

		models = append(models, mr)
	}

	slices.SortStableFunc(models, func(i, j api.ProcessModelResponse) int {
		// longest duration remaining listed first
		return cmp.Compare(j.ExpiresAt.Unix(), i.ExpiresAt.Unix())
	})

	c.JSON(http.StatusOK, api.ProcessResponse{Models: models})
}

func (s *Server) ChatHandler(c *gin.Context) {
	checkpointStart := time.Now()

	var req api.ChatRequest
	if err := c.ShouldBindJSON(&req); errors.Is(err, io.EOF) {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing request body"})
		return
	} else if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// expire the runner
	if len(req.Messages) == 0 && req.KeepAlive != nil && int(req.KeepAlive.Seconds()) == 0 {
		model, err := GetModel(req.Model)
		if err != nil {
			switch {
			case os.IsNotExist(err):
				c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model '%s' not found", req.Model)})
			case err.Error() == "invalid model name":
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}
		s.sched.expireRunner(model)

		c.JSON(http.StatusOK, api.ChatResponse{
			Model:      req.Model,
			CreatedAt:  time.Now().UTC(),
			Message:    api.Message{Role: "assistant"},
			Done:       true,
			DoneReason: "unload",
		})
		return
	}

	caps := []Capability{CapabilityCompletion}
	if len(req.Tools) > 0 {
		caps = append(caps, CapabilityTools)
	}

	r, m, opts, err := s.scheduleRunner(c.Request.Context(), req.Model, caps, req.Options, req.KeepAlive)
	if errors.Is(err, errCapabilityCompletion) {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("%q does not support chat", req.Model)})
		return
	} else if err != nil {
		handleScheduleError(c, req.Model, err)
		return
	}

	checkpointLoaded := time.Now()

	if len(req.Messages) == 0 {
		c.JSON(http.StatusOK, api.ChatResponse{
			Model:      req.Model,
			CreatedAt:  time.Now().UTC(),
			Message:    api.Message{Role: "assistant"},
			Done:       true,
			DoneReason: "load",
		})
		return
	}

	msgs := append(m.Messages, req.Messages...)
	if req.Messages[0].Role != "system" && m.System != "" {
		msgs = append([]api.Message{{Role: "system", Content: m.System}}, msgs...)
	}

	prompt, images, err := chatPrompt(c.Request.Context(), m, r.Tokenize, opts, msgs, req.Tools)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	slog.Debug("chat request", "images", len(images), "prompt", prompt)

	ch := make(chan any)
	go func() {
		defer close(ch)
		if err := r.Completion(c.Request.Context(), llm.CompletionRequest{
			Prompt:  prompt,
			Images:  images,
			Format:  req.Format,
			Options: opts,
		}, func(r llm.CompletionResponse) {
			res := api.ChatResponse{
				Model:      req.Model,
				CreatedAt:  time.Now().UTC(),
				Message:    api.Message{Role: "assistant", Content: r.Content},
				Done:       r.Done,
				DoneReason: r.DoneReason,
				Metrics: api.Metrics{
					PromptEvalCount:    r.PromptEvalCount,
					PromptEvalDuration: r.PromptEvalDuration,
					EvalCount:          r.EvalCount,
					EvalDuration:       r.EvalDuration,
				},
			}

			if r.Done {
				res.TotalDuration = time.Since(checkpointStart)
				res.LoadDuration = checkpointLoaded.Sub(checkpointStart)
			}

			ch <- res
		}); err != nil {
			ch <- gin.H{"error": err.Error()}
		}
	}()

	if req.Stream != nil && !*req.Stream {
		var resp api.ChatResponse
		var sb strings.Builder
		for rr := range ch {
			switch t := rr.(type) {
			case api.ChatResponse:
				sb.WriteString(t.Message.Content)
				resp = t
			case gin.H:
				msg, ok := t["error"].(string)
				if !ok {
					msg = "unexpected error format in response"
				}

				c.JSON(http.StatusInternalServerError, gin.H{"error": msg})
				return
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": "unexpected response"})
				return
			}
		}

		resp.Message.Content = sb.String()

		if len(req.Tools) > 0 {
			if toolCalls, ok := m.parseToolCalls(sb.String()); ok {
				resp.Message.ToolCalls = toolCalls
				resp.Message.Content = ""
			}
		}

		c.JSON(http.StatusOK, resp)
		return
	}

	streamResponse(c, ch)
}

func handleScheduleError(c *gin.Context, name string, err error) {
	switch {
	case errors.Is(err, errCapabilities), errors.Is(err, errRequired):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	case errors.Is(err, context.Canceled):
		c.JSON(499, gin.H{"error": "request canceled"})
	case errors.Is(err, ErrMaxQueue):
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
	case errors.Is(err, os.ErrNotExist):
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("model %q not found, try pulling it first", name)})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}
