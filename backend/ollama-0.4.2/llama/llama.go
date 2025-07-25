package llama

//go:generate make -j 8

/*
#cgo CFLAGS: -O2 -std=c11 -DGGML_BUILD=1 -DNDEBUG -DLOG_DISABLE_LOGS -DGGML_USE_LLAMAFILE
#cgo CXXFLAGS: -O2 -std=c++11 -DGGML_BUILD=1 -DNDEBUG -DLOG_DISABLE_LOGS -DGGML_USE_LLAMAFILE
#cgo amd64,avx CFLAGS: -mavx
#cgo amd64,avx CXXFLAGS: -mavx
#cgo amd64,avx2 CFLAGS: -mavx2 -mfma
#cgo amd64,avx2 CXXFLAGS: -mavx2 -mfma
#cgo amd64,f16c CFLAGS: -mf16c
#cgo amd64,f16c CXXFLAGS: -mf16c
#cgo amd64,fma CFLAGS: -mfma
#cgo amd64,fma CXXFLAGS: -mfma
#cgo avx CFLAGS: -mavx
#cgo avx CXXFLAGS: -mavx
#cgo avx2 CFLAGS: -mavx2 -mfma -mf16c
#cgo avx2 CXXFLAGS: -mavx2 -mfma -mf16c
#cgo cuda CFLAGS: -fPIE -DGGML_USE_CUDA -DGGML_CUDA_DMMV_X=32 -DGGML_CUDA_PEER_MAX_BATCH_SIZE=128 -DGGML_CUDA_MMV_Y=1 -DGGML_BUILD=1
#cgo cuda CFLAGS: -fPIE -DGGML_USE_CUDA -DGGML_CUDA_DMMV_X=32 -DGGML_CUDA_PEER_MAX_BATCH_SIZE=128 -DGGML_CUDA_MMV_Y=1 -DGGML_BUILD=1
#cgo cuda CXXFLAGS: -DGGML_USE_CUDA -DGGML_CUDA_DMMV_X=32 -DGGML_CUDA_PEER_MAX_BATCH_SIZE=128 -DGGML_CUDA_MMV_Y=1 -DGGML_BUILD=1
#cgo cuda CXXFLAGS: -DGGML_USE_CUDA -DGGML_CUDA_DMMV_X=32 -DGGML_CUDA_PEER_MAX_BATCH_SIZE=128 -DGGML_CUDA_MMV_Y=1 -DGGML_BUILD=1
#cgo cuda_jetpack5 LDFLAGS: -lggml_cuda_jetpack5 -L/usr/local/cuda-11/lib64
#cgo cuda_jetpack6 LDFLAGS: -lggml_cuda_jetpack6 -L/usr/local/cuda-12/lib64
#cgo cuda_v11 LDFLAGS: -lggml_cuda_v11 -L/usr/local/cuda-11/lib64
#cgo cuda_v12 LDFLAGS: -lggml_cuda_v12 -L/usr/local/cuda-12/lib64
#cgo darwin,amd64 CFLAGS: -Wno-incompatible-pointer-types-discards-qualifiers
#cgo darwin,amd64 CXXFLAGS: -Wno-incompatible-pointer-types-discards-qualifiers
#cgo darwin,amd64 LDFLAGS: -framework Foundation
#cgo darwin,amd64,avx2 CFLAGS: -DGGML_USE_ACCELERATE -DACCELERATE_NEW_LAPACK -DACCELERATE_LAPACK_ILP64
#cgo darwin,amd64,avx2 CXXFLAGS: -DGGML_USE_ACCELERATE -DACCELERATE_NEW_LAPACK -DACCELERATE_LAPACK_ILP64
#cgo darwin,amd64,avx2 LDFLAGS: -framework Accelerate
#cgo darwin,arm64 CFLAGS: -DGGML_USE_METAL -DGGML_USE_ACCELERATE -DGGML_METAL_EMBED_LIBRARY -DACCELERATE_NEW_LAPACK -DACCELERATE_LAPACK_ILP64 -DGGML_USE_BLAS
#cgo darwin,arm64 CXXFLAGS: -DGGML_USE_METAL -DGGML_USE_ACCELERATE -DGGML_METAL_EMBED_LIBRARY -DACCELERATE_NEW_LAPACK -DACCELERATE_LAPACK_ILP64 -DGGML_USE_BLAS
#cgo darwin,arm64 LDFLAGS: -framework Foundation -framework Metal -framework MetalKit -framework Accelerate
#cgo linux CFLAGS: -D_GNU_SOURCE
#cgo linux CXXFLAGS: -D_GNU_SOURCE
#cgo linux,amd64 LDFLAGS: -L${SRCDIR}/build/Linux/amd64
#cgo linux,amd64 LDFLAGS: -L${SRCDIR}/build/Linux/amd64
#cgo linux,arm64 CFLAGS: -D__aarch64__ -D__ARM_NEON -D__ARM_FEATURE_FMA
#cgo linux,arm64 CXXFLAGS: -D__aarch64__ -D__ARM_NEON -D__ARM_FEATURE_FMA
#cgo linux,arm64 LDFLAGS: -L${SRCDIR}/build/Linux/arm64
#cgo linux,arm64,sve CFLAGS: -march=armv8.6-a+sve
#cgo linux,arm64,sve CXXFLAGS: -march=armv8.6-a+sve
#cgo linux,cuda LDFLAGS: -lcuda -lcudart -lcublas -lcublasLt -lpthread -ldl -lrt -lresolv
#cgo linux,rocm LDFLAGS: -L/opt/rocm/lib -lpthread -ldl -lrt -lresolv
#cgo rocm CFLAGS: -DGGML_USE_CUDA -DGGML_USE_HIPBLAS -DGGML_CUDA_DMMV_X=32 -DGGML_CUDA_PEER_MAX_BATCH_SIZE=128 -DGGML_CUDA_MMV_Y=1 -DGGML_BUILD=1
#cgo rocm CXXFLAGS: -DGGML_USE_CUDA -DGGML_USE_HIPBLAS -DGGML_CUDA_DMMV_X=32 -DGGML_CUDA_PEER_MAX_BATCH_SIZE=128 -DGGML_CUDA_MMV_Y=1 -DGGML_BUILD=1
#cgo rocm LDFLAGS: -L${SRCDIR} -lggml_rocm -lhipblas -lamdhip64 -lrocblas
#cgo windows CFLAGS: -Wno-discarded-qualifiers -D_WIN32_WINNT=0x602
#cgo windows CXXFLAGS: -D_WIN32_WINNT=0x602
#cgo windows LDFLAGS: -lmsvcrt
#cgo windows LDFLAGS: -lmsvcrt -static-libstdc++ -static-libgcc -static
#cgo windows,amd64 LDFLAGS: -L${SRCDIR}/build/Windows/amd64
#cgo windows,amd64 LDFLAGS: -L${SRCDIR}/build/Windows/amd64
#cgo windows,arm64 CFLAGS: -D__aarch64__ -D__ARM_NEON -D__ARM_FEATURE_FMA
#cgo windows,arm64 CXXFLAGS: -D__aarch64__ -D__ARM_NEON -D__ARM_FEATURE_FMA
#cgo windows,arm64 LDFLAGS: -L${SRCDIR}/build/Windows/arm64
#cgo windows,arm64 LDFLAGS: -L${SRCDIR}/build/Windows/arm64
#cgo windows,cuda LDFLAGS: -lcuda -lcudart -lcublas -lcublasLt
#cgo windows,rocm LDFLAGS: -lggml_rocm -lhipblas -lamdhip64 -lrocblas

#include <stdlib.h>
#include "llama.h"
#include "clip.h"
#include "ggml.h"
#include "llava.h"
#include "mllama.h"
#include "sampling_ext.h"


bool llamaProgressCallback(float progress, void *user_data);

typedef enum {COMP_UNKNOWN,COMP_GCC,COMP_CLANG} COMPILER;
COMPILER inline get_compiler() {
#if defined(__clang__)
	return COMP_CLANG;
#elif defined(__GNUC__)
	return COMP_GCC;
#else
	return UNKNOWN_COMPILER;
#endif
}
*/
import "C"

import (
	_ "embed"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"os"
	"runtime"
	"runtime/cgo"
	"slices"
	"strconv"

	// "strconv"
	"strings"
	"unsafe"
)

var CpuFeatures = ""

func logToFile(message string) error {
	// Open the file in append mode, create it if it doesn't exist, and set appropriate permissions
	file, err := os.OpenFile("./runner_server.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
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

func BackendInit() {
	slog.Info("BackendInit")
	C.llama_backend_init()
}

func PrintSystemInfo() string {
	slog.Info("PrintSystemInfo")
	var compiler string
	switch C.get_compiler() {
	case C.COMP_UNKNOWN:
		compiler = "cgo(unknown_compiler)"
	case C.COMP_GCC:
		compiler = "cgo(gcc)"
	case C.COMP_CLANG:
		compiler = "cgo(clang)"
	}
	return C.GoString(C.llama_print_system_info()) + compiler
}

func GetModelArch(modelPath string) (string, error) {
	slog.Info("GetModelArch")
	mp := C.CString(modelPath)
	defer C.free(unsafe.Pointer(mp))

	gguf_ctx := C.gguf_init_from_file(mp, C.struct_gguf_init_params{no_alloc: true, ctx: (**C.struct_ggml_context)(C.NULL)})
	if gguf_ctx == nil {
		return "", errors.New("unable to load model file")
	}
	defer C.gguf_free(gguf_ctx)

	key := C.CString("general.architecture")
	defer C.free(unsafe.Pointer(key))
	arch_index := C.gguf_find_key(gguf_ctx, key)
	if int(arch_index) < 0 {
		return "", errors.New("unknown model architecture")
	}

	arch := C.gguf_get_val_str(gguf_ctx, arch_index)

	return C.GoString(arch), nil
}

type ContextParams struct {
	c C.struct_llama_context_params
}

func NewContextParams(numCtx int, batchSize int, numSeqMax int, threads int, flashAttention bool) ContextParams {
	slog.Info("NewContextParams")
	logToFile("NewContextParams")
	params := C.llama_context_default_params()
	params.n_ctx = C.uint(numCtx)
	params.n_batch = C.uint(batchSize)
	params.n_seq_max = C.uint(numSeqMax)
	params.n_threads = C.int(threads)
	params.n_threads_batch = params.n_threads
	params.embeddings = C.bool(true)
	params.flash_attn = C.bool(flashAttention)
	return ContextParams{c: params}
}

type Context struct {
	c            *C.struct_llama_context
	numThreads   int
	useModel2Vec bool
	model2Vec    *C.struct_model2Vec // Add a model2Vec pointer to the context
}

func (c *Context) KvCacheClear() {
	slog.Info("KvCacheClear")
	logToFile("KvCacheClear")
	C.llama_kv_cache_clear(c.c)
}

// type VocabToken struct {
// 	Text  string
// 	Score float32
// }

// func (v *Vocab) Size() int {
// 	return int(C.llama_vocab_size(v.c))
// }

// func (v *Vocab) GetToken(index int) VocabToken {
// 	token := C.llama_get_vocab_token(v.c, C.int(index))
// 	return VocabToken{
// 		Text:  C.GoString(token.text),
// 		Score: float32(token.score),
// 	}
// }

// Initialize model2Vec in the context
// func (c *Context) InitializeModel2Vec(embeddingDim int, applyZipf bool, pcaComponents int) error {
// 	if !c.useModel2Vec {
// 		return nil
// 	}

// 	// Create a new model2Vec instance
// 	c.model2Vec = C.llama_model2vec_init(C.int(embeddingDim), C.bool(applyZipf), C.int(pcaComponents))
// 	if c.model2Vec == nil {
// 		return errors.New("failed to initialize model2Vec")
// 	}

// 	return nil
// }

type Model2Vec struct {
	c *C.struct_model2Vec
}

func (c *Context) InitializeModel2VecAndSave(
	modelPath string,
	saveFilePath string,
) (*Model2Vec, error) {
	// Set default saveFilePath if not provided
	if saveFilePath == "" {
		saveFilePath = modelPath + ".json"
	}

	logToFile(fmt.Sprintf("Initializing model2Vec with modelPath = %s, saveFilePath = %s", modelPath, saveFilePath))

	// Check if the file exists
	if _, err := os.Stat(saveFilePath); err == nil {
		fmt.Printf("Using existing file: %s\n", saveFilePath)
		cSaveFilePath := C.CString(saveFilePath)
		defer C.free(unsafe.Pointer(cSaveFilePath))
		// File exists, initialize Model2Vec with existing data (simulate here)
		return &Model2Vec{
			c: C.llama_model2vec_initialize(cSaveFilePath),
		}, nil
	} else if os.IsNotExist(err) {
		fmt.Printf("File does not exist. Generating new model and saving to: %s\n", saveFilePath)

		// File doesn't exist, generate and save the model
		// Simulate model generation and saving here
		// You would typically perform operations like initializing a C struct, processing, etc.
		pcaComponents := 0
		if os.Getenv("MODEL2VEC_PCA_DIMS") != "" {
			pcaComponents, _ = strconv.Atoi(os.Getenv("MODEL2VEC_PCA_DIMS"))
		}

		embeddingDim := 0
		if os.Getenv("MODEL2VEC_EMBEDDING_DIMS") != "" {
			embeddingDim, _ = strconv.Atoi(os.Getenv("MODEL2VEC_EMBEDDING_DIMS"))
		}

		model := C.llama_model2vec_initialize_and_save(c.c, c.Model().c, C.CString(saveFilePath), C.int(embeddingDim), C.bool(true), C.int(pcaComponents))

		if model == nil {
			logToFile(fmt.Sprintf("Failed to initialize model2Vec with embeddingDim = %d, pcaComponents = %d", embeddingDim, pcaComponents))
		}
		// For now, simulate save operation

		// Return new Model2Vec
		return &Model2Vec{
			c: model, // Simulated: Initialize the new model if needed
		}, nil
	} else {
		// Other file errors
		return nil, fmt.Errorf("error checking file: %w", err)
	}
}

// Free model2Vec resources
func (c *Context) FreeModel2Vec() {
	if c.model2Vec != nil {
		// C.llama_model2vec_free(c.model2Vec)
		c.model2Vec = nil
	}
}

func (c *Context) GetModel2VecEmbeddings(modelPath string, prompt string) ([]float32, error) {
	// Call the C function to get the embeddings

	cSaveFilePath := C.CString(modelPath + ".json")
	tokens, _ := c.Model().Tokenize(prompt, true, true)

	slog.Info("Tokens received", tokens)

	instance, _ := c.InitializeModel2VecAndSave(modelPath, modelPath)

	cTokens := (*C.int)(unsafe.Pointer(&tokens[0]))

	embeddings := C.llama_model2vec_get_embedding(instance.c, cTokens, C.int(len(tokens)), c.c, cSaveFilePath)
	if embeddings == nil {
		return nil, errors.New("failed to get model2Vec embeddings")
	}
	return unsafe.Slice((*float32)(embeddings), c.Model().NEmbd()), nil
}

// Get embeddings using model2Vec
func (c *Context) GetFastEmbeddings(seqId int) ([]float32, error) {
	// if c.useModel2Vec {
	// 	return c.GetModel2VecEmbeddings(seqId)

	// 	// return make([]float32, 0), nil
	// }
	return c.getLLMEmbeddings(seqId)
}

// func (c *Context) getModel2VecEmbeddings(seqId int) ([]float32, error) {
// 	// Retrieve the embedding associated with seqId
// 	embedding, err := c.getLLMEmbeddings(seqId)
// 	if err != nil {
// 		return nil, err
// 	}

// 	// Prepare a result slice for the PCA-transformed embedding
// 	result := make([]float32, len(embedding))

// 	// Call the C function with the correct embedding pointer
// 	success := C.llama_model2vec_apply_pca(
// 		c.model2Vec,
// 		(*C.float)(unsafe.Pointer(&embedding[0])),
// 		(*C.float)(unsafe.Pointer(&result[0])),
// 	)
// 	if !success {
// 		return nil, errors.New("failed to apply PCA to embedding")
// 	}
// 	return result, nil
// }

func (c *Context) Decode(batch *Batch) error {
	logToFile("Decoding")
	slog.Info("Decode")

	// if c.useModel2Vec {
	// 	numTokens := batch.NumTokens()
	// 	allocSize := batch.allocSize()

	// 	embeddings, err := c.GetFastEmbeddings()

	// Create slices over the C arrays
	// nSeqIdSlice := unsafe.Slice((*C.int)(unsafe.Pointer(batch.c.n_seq_id)), allocSize)
	// seqIdPtrSlice := unsafe.Slice((**C.llama_seq_id)(unsafe.Pointer(batch.c.seq_id)), allocSize)

	// for i := 0; i < numTokens; i++ {
	// 	// Get the number of sequence IDs for the current token
	// 	nSeqId := int(nSeqIdSlice[i])

	// 	// Get the pointer to the seq_ids for this token
	// 	seqIdsPtr := seqIdPtrSlice[i]

	// 	// Create a slice over the seq_ids for this token
	// 	seqIdsC := unsafe.Slice(seqIdsPtr, nSeqId)

	// 	for _, seqIdC := range seqIdsC {
	// 		seqId := int(seqIdC)

	// 		// Get embeddings for this sequence ID
	// 		embeddings, err := c.GetFastEmbeddings(seqId)
	// 		if err != nil {
	// 			return fmt.Errorf("failed to decode with model2Vec for seqId %d: %w", seqId, err)
	// 		}

	// 		// Log or process the embeddings as needed
	// 		logToFile(fmt.Sprintf("Decoded embeddings for seqId %d: %v", seqId, embeddings))

	// 		// Perform additional processing here if needed
	// 	}
	// }
	// 	return nil
	// }

	// Fall back to standard decoding
	code := int(C.llama_decode(c.c, batch.c))
	if code < 0 {
		return fmt.Errorf("llama_decode failed with code %d", code)
	}
	if code > 0 {
		return fmt.Errorf("could not find a KV slot for the batch: code %d", code)
	}

	return nil
}

func (c *Context) Model() *Model {
	slog.Info("Model")
	logToFile("Model")
	fmt.Println("Model")
	return &Model{c: C.llama_get_model(c.c)}
}

func (c *Context) KvCacheSeqAdd(seqId int, p0 int, p1 int, delta int) {
	slog.Info("KvCacheSeqAdd")
	logToFile(fmt.Sprintf("KvCacheSeqAdd: seqId = %d, p0 = %d, p1 = %d, delta = %d", seqId, p0, p1, delta))
	fmt.Println("KvCacheSeqAdd", seqId, p0, p1, delta)
	C.llama_kv_cache_seq_add(c.c, C.int(seqId), C.int(p0), C.int(p1), C.int(delta))
}

func (c *Context) KvCacheSeqRm(seqId int, p0 int, p1 int) bool {
	slog.Info("KvCacheSeqRm")
	logToFile(fmt.Sprintf("KvCacheSeqRm: seqId = %d, p0 = %d, p1 = %d", seqId, p0, p1))
	fmt.Println("KvCacheSeqRm", seqId, p0, p1)
	return bool(C.llama_kv_cache_seq_rm(c.c, C.int(seqId), C.int(p0), C.int(p1)))
}

func (c *Context) KvCacheSeqCp(srcSeqId int, dstSeqId int, p0 int, p1 int) {
	slog.Info("KvCacheSeqCp")
	logToFile(fmt.Sprintf("KvCacheSeqCp: srcSeqId = %d, dstSeqId = %d, p0 = %d, p1 = %d", srcSeqId, dstSeqId, p0, p1))
	fmt.Println("KvCacheSeqCp", srcSeqId, dstSeqId, p0, p1)
	C.llama_kv_cache_seq_cp(c.c, C.int(srcSeqId), C.int(dstSeqId), C.int(p0), C.int(p1))
}

// Get the embeddings for a sequence id
func (c *Context) GetEmbeddingsSeq(seqId int) []float32 {
	logToFile(fmt.Sprintf("GetEmbeddingsSeq: seqId = %d", seqId))
	slog.Info("GetEmbeddingsSeq")
	fmt.Println("Get embeddings seq", seqId)
	embeddings := unsafe.Pointer(C.llama_get_embeddings_seq(c.c, C.int(seqId)))
	if embeddings == nil {
		return nil
	}

	return unsafe.Slice((*float32)(embeddings), c.Model().NEmbd())
}

func (c *Context) GetEmbeddingsIth(i int) []float32 {
	logToFile(fmt.Sprintf("GetEmbeddingsIth: i = %d", i))
	slog.Info("GetEmbeddingsIth")
	fmt.Println("Get embeddings ith", i)
	embeddings := unsafe.Pointer(C.llama_get_embeddings_ith(c.c, C.int32_t(i)))
	fmt.Println("Embeddings in llama go", embeddings)
	if embeddings == nil {
		return nil
	}
	fmt.Println("Embeddings in llama go", embeddings)

	return unsafe.Slice((*float32)(embeddings), c.Model().NEmbd())
}

// func (c *Context) GetFastEmbeddings(seqId int) ([]float32, error) {
// 	if c.useModel2Vec {
// 		return c.getModel2VecEmbeddings(seqId)
// 	}
// 	return c.getLLMEmbeddings(seqId)
// }

// // Fetch embeddings using model2vec
// func (c *Context) getModel2VecEmbeddings(seqId int) ([]float32, error) {
// 	logToFile(fmt.Sprintf("Fetching model2vec embeddings for seqId = %d", seqId))
// 	embeddings := unsafe.Pointer(C.model2Vec_embed(c.c, C.int(seqId)))
// 	if embeddings == nil {
// 		return nil, errors.New("failed to fetch model2vec embeddings")
// 	}
// 	return unsafe.Slice((*float32)(embeddings), c.Model().NEmbd()), nil
// }

// Fetch embeddings directly from LLM
func (c *Context) getLLMEmbeddings(seqId int) ([]float32, error) {
	logToFile(fmt.Sprintf("Fetching LLM embeddings for seqId = %d", seqId))
	embeddings := unsafe.Pointer(C.llama_get_embeddings_seq(c.c, C.int(seqId)))
	if embeddings == nil {
		return nil, errors.New("failed to fetch LLM embeddings")
	}
	return unsafe.Slice((*float32)(embeddings), c.Model().NEmbd()), nil
}

type ModelParams struct {
	NumGpuLayers int
	MainGpu      int
	UseMmap      bool
	UseMlock     bool
	TensorSplit  []float32
	Progress     func(float32)
	VocabOnly    bool
}

//export llamaProgressCallback
func llamaProgressCallback(progress C.float, userData unsafe.Pointer) C.bool {
	handle := *(*cgo.Handle)(userData)
	callback := handle.Value().(func(float32))
	callback(float32(progress))
	return true
}

func LoadModelFromFile(modelPath string, params ModelParams) (*Model, error) {
	logToFile(fmt.Sprintf("Loading model from file: %s", modelPath))
	fmt.Println("Loading model from file:", modelPath)
	fmt.Println("Params:", params)

	cparams := C.llama_model_default_params()
	cparams.n_gpu_layers = C.int(params.NumGpuLayers)
	cparams.main_gpu = C.int32_t(params.MainGpu)
	cparams.use_mmap = C.bool(params.UseMmap)
	cparams.use_mlock = C.bool(params.UseMlock)
	cparams.vocab_only = C.bool(params.VocabOnly)

	if len(params.TensorSplit) > 0 {
		tensorSplitData := &params.TensorSplit[0]

		var tensorSplitPin runtime.Pinner
		tensorSplitPin.Pin(tensorSplitData)
		defer tensorSplitPin.Unpin()

		cparams.tensor_split = (*C.float)(unsafe.Pointer(tensorSplitData))
	}

	if params.Progress != nil {
		handle := cgo.NewHandle(params.Progress)
		defer handle.Delete()

		var handlePin runtime.Pinner
		handlePin.Pin(&handle)
		defer handlePin.Unpin()

		cparams.progress_callback = C.llama_progress_callback(C.llamaProgressCallback)
		cparams.progress_callback_user_data = unsafe.Pointer(&handle)
	}

	fmt.Println("C params", cparams)

	m := Model{c: C.llama_load_model_from_file(C.CString(modelPath), cparams)}

	fmt.Println("Model loaded", m.c)

	vocab := getAllVocab(&m)

	fmt.Println("Vocab", vocab)
	fmt.Println("VocabC", vocab.c)

	if m.c == nil {
		return nil, fmt.Errorf("unable to load model: %s", modelPath)
	}

	return &m, nil
}

type Vocab struct {
	c *C.struct_llama_vocab
}

func getAllVocab(model *Model) *Vocab {
	if model == nil || model.c == nil {
		return nil
	}

	// Call the C function to get the vocab.
	vocabC := C.llama_get_all_vocab(model.c)

	// If necessary, convert the C vocab to a Go-friendly format.
	if vocabC == nil {
		return nil
	}

	fmt.Println("VocabC", vocabC)

	return &Vocab{c: vocabC}
}

// func LoadModelFromFileNew(modelPath string, params ModelParams) (*Model, error) {
// 	fmt.Println("Loading model from file:", modelPath)
// 	fmt.Println("Params:", params)

// 	cparams := C.llama_model_default_params()
// 	cparams.n_gpu_layers = C.int(params.NumGpuLayers)
// 	cparams.main_gpu = C.int32_t(params.MainGpu)
// 	cparams.use_mmap = C.bool(params.UseMmap)
// 	cparams.use_mlock = C.bool(params.UseMlock)
// 	cparams.vocab_only = C.bool(params.VocabOnly)

// 	if len(params.TensorSplit) > 0 {
// 		tensorSplitData := &params.TensorSplit[0]

// 		var tensorSplitPin runtime.Pinner
// 		tensorSplitPin.Pin(tensorSplitData)
// 		defer tensorSplitPin.Unpin()

// 		cparams.tensor_split = (*C.float)(unsafe.Pointer(tensorSplitData))
// 	}

// 	if params.Progress != nil {
// 		handle := cgo.NewHandle(params.Progress)
// 		defer handle.Delete()

// 		var handlePin runtime.Pinner
// 		handlePin.Pin(&handle)
// 		defer handlePin.Unpin()

// 		cparams.progress_callback = C.llama_progress_callback(C.llamaProgressCallback)
// 		cparams.progress_callback_user_data = unsafe.Pointer(&handle)
// 	}

// 	fmt.Println("C params", cparams)

// 	m := Model{c: C.llama_load_model_from_file(C.CString(modelPath), cparams)}

// 	fmt.Println("Model loaded", m.c)

// 	if m.c == nil {
// 		return nil, fmt.Errorf("unable to load model: %s", modelPath)
// 	}

// 	return &m, nil
// }

func FreeModel(model *Model) {
	if model == nil {
		return
	}

	C.llama_free_model(model.c)
}

func NewContextWithModel(model *Model, params ContextParams) (*Context, error) {
	logToFile("Creating context with model")
	useModel2Vec := os.Getenv("USE_MODEL2VEC") == "1"

	c := &Context{
		c:            C.llama_new_context_with_model(model.c, params.c),
		numThreads:   int(params.c.n_threads),
		useModel2Vec: useModel2Vec,
	}
	if c.c == nil {
		return nil, errors.New("unable to create llama context")
	}

	// if useModel2Vec {
	// 	embeddingDims, _ := strconv.Atoi(os.Getenv("MODEL2VEC_EMBEDDING_DIMS"))
	// 	pcaDims, _ := strconv.Atoi(os.Getenv("MODEL2VEC_PCA_DIMS"))
	// 	slog.Info("Initializing model2vec as per environment variable", embeddingDims, pcaDims)
	// 	err := c.Model().InitializeModel2VecAndSave("model.bin", embeddingDims, true, pcaDims, c)
	// 	if err != nil {
	// 		return nil, err
	// 	}
	// }

	return c, nil
}

func (m *Model) NumVocab() int {
	fmt.Println("NumVocab")
	logToFile("NumVocab")
	return int(C.llama_n_vocab(m.c))
}

func (m *Model) TokenIsEog(token int) bool {
	fmt.Println("TokenIsEog")
	logToFile(fmt.Sprintf("TokenIsEog: token = %d", token))
	return bool(C.llama_token_is_eog(m.c, C.llama_token(token)))
}

func (m *Model) AddBOSToken() bool {
	logToFile("AddBOSToken")
	fmt.Println("AddBOSToken")
	return bool(C.llama_add_bos_token(m.c))
}

func (m *Model) ApplyLoraFromFile(context *Context, loraPath string, scale float32, threads int) error {
	fmt.Println("ApplyLoraFromFile")
	logToFile(fmt.Sprintf("ApplyLoraFromFile: loraPath = %s, scale = %f, threads = %d", loraPath, scale, threads))
	cLoraPath := C.CString(loraPath)
	defer C.free(unsafe.Pointer(cLoraPath))

	loraAdapter := C.llama_lora_adapter_init(m.c, cLoraPath)
	if loraAdapter == nil {
		return errors.New("unable to load lora")
	}

	err := -1
	if loraAdapter != nil {
		err = int(C.llama_lora_adapter_set(context.c, loraAdapter, C.float(scale)))
	}
	if err != 0 {
		return errors.New("error applying lora from file")
	}

	return nil
}

type Batch struct {
	c         C.struct_llama_batch
	batchSize int
	maxSeq    int
	embedSize int
}

// Creates a new batch for either word tokens or image embeddings (if embedSize is non-zero).
// Batches cannot contain both types at the same time. batchSize is the maximum number of entries
// that can be added per sequence
func NewBatch(batchSize int, maxSeq int, embedSize int) (*Batch, error) {
	logToFile(fmt.Sprintf("NewBatch: batchSize = %d, maxSeq = %d, embedSize = %d", batchSize, maxSeq, embedSize))
	fmt.Println("NewBatch", batchSize, maxSeq, embedSize)
	b := Batch{
		c:         C.llama_batch_init(C.int(batchSize*maxSeq), C.int(embedSize), C.int(maxSeq)),
		batchSize: batchSize,
		maxSeq:    maxSeq,
		embedSize: embedSize,
	}

	// Check to see if any of the allocations in llama_batch_init() failed
	nilPointer := (embedSize == 0 && b.c.token == nil) || (embedSize != 0 && b.c.embd == nil) ||
		b.c.pos == nil || b.c.n_seq_id == nil || b.c.seq_id == nil || b.c.logits == nil ||
		slices.Contains(unsafe.Slice(b.c.seq_id, b.allocSize()), nil)

	if nilPointer {
		C.llama_batch_free(b.c)
		return nil, fmt.Errorf("unable to allocate batch (batchSize=%v maxSeq=%v embedSize=%v)", batchSize, maxSeq, embedSize)
	}

	return &b, nil
}

func (b *Batch) Size() int {
	return b.batchSize
}

func (b *Batch) allocSize() int {
	return b.batchSize * b.maxSeq
}

func (b *Batch) NumTokens() int {
	return int(b.c.n_tokens)
}

func (b *Batch) IsEmbedding() bool {
	return b.embedSize != 0
}

// Add adds either a token or an image embedding to the batch depending on the type
// when the batch was initialized. The other argument will be ignored. Adds to the
// batch with the given position for the given sequence ids, and optionally instructs
// to include logits.
func (b *Batch) Add(token int, embed []float32, pos int, logits bool, seqIds ...int) {
	fmt.Println("Adding to batch", token, embed, pos, logits, seqIds)
	logToFile(fmt.Sprintf("Adding to batch: token = %d, embed = %v, pos = %d, logits = %v, seqIds = %v", token, embed, pos, logits, seqIds))
	if !b.IsEmbedding() {
		fmt.Println("Adding token", token, !b.IsEmbedding())
		logToFile(fmt.Sprintf("Adding token: token = %d", token))
		unsafe.Slice(b.c.token, b.allocSize())[b.c.n_tokens] = C.llama_token(token)
		logToFile(fmt.Sprintf("added token: %v", C.llama_token(token)))
	} else {
		fmt.Println("Adding embed", embed, !b.IsEmbedding())
		logToFile(fmt.Sprintf("Adding embed: embed = %v", embed))
		copy(unsafe.Slice((*float32)(b.c.embd), b.allocSize()*b.embedSize)[int(b.c.n_tokens)*b.embedSize:], embed)
		logToFile(fmt.Sprintf("added embed: %v", embed))
	}
	fmt.Println("Adding pos", pos)
	logToFile(fmt.Sprintf("Adding pos: pos = %d", pos))
	unsafe.Slice(b.c.pos, b.allocSize())[b.c.n_tokens] = C.llama_pos(pos)
	logToFile(fmt.Sprintf("added pos: %v", C.llama_pos(pos)))
	fmt.Println("Adding seqIds", seqIds)
	logToFile(fmt.Sprintf("Adding seqIds: seqIds = %v", seqIds))
	unsafe.Slice(b.c.n_seq_id, b.allocSize())[b.c.n_tokens] = C.int(len(seqIds))
	logToFile(fmt.Sprintf("added n_seq_id: %v", len(seqIds)))

	fmt.Println("Adding seqIds", seqIds)
	logToFile(fmt.Sprintf("Adding seqIds: seqIds = %v", seqIds))
	for i, s := range seqIds {
		unsafe.Slice((unsafe.Slice(b.c.seq_id, b.allocSize())[b.c.n_tokens]), C.int(len(seqIds)))[i] = C.int32_t(s)
		logToFile(fmt.Sprintf("added seqId: %v", C.int32_t(s)))
	}

	fmt.Println("Adding logits", logits)
	logToFile(fmt.Sprintf("Adding logits: logits = %v", logits))
	if logits {
		unsafe.Slice(b.c.logits, b.allocSize())[b.c.n_tokens] = 1
	}
	b.c.n_tokens += 1
}

func (b *Batch) Clear() {
	b.c.n_tokens = 0
}

func (b *Batch) Free() {
	b.batchSize = 0
	C.llama_batch_free(b.c)
}

type Model struct {
	c *C.struct_llama_model
}

func (m *Model) TokenToPiece(token int) string {
	fmt.Println("TokenToPiece")
	tokenLen := 12
	buf := make([]byte, tokenLen)
	tokenLen = int(C.llama_token_to_piece(
		m.c,
		C.int32_t(token),
		(*C.char)(unsafe.Pointer(&buf[0])),
		C.int32_t(tokenLen),
		C.int32_t(0),
		C.bool(true),
	))
	if tokenLen < 0 {
		tokenLen = -tokenLen

		buf = make([]byte, tokenLen)
		C.llama_token_to_piece(
			m.c,
			C.int32_t(token),
			(*C.char)(unsafe.Pointer(&buf[0])),
			C.int32_t(tokenLen),
			C.int32_t(0),
			C.bool(true),
		)
	}
	return strings.TrimRight(string(buf), "\x00")
}

func (m *Model) Tokenize(text string, addSpecial bool, parseSpecial bool) ([]int, error) {
	maxTokens := len(text) + 2
	cTokens := make([]C.llama_token, maxTokens)
	cText := C.CString(text)
	defer C.free(unsafe.Pointer(cText))

	result := C.llama_tokenize(
		m.c,
		cText,
		C.int32_t(len(text)),
		&cTokens[0],
		C.int32_t(maxTokens),
		C.bool(addSpecial),
		C.bool(parseSpecial),
	)

	if result < 0 {
		maxTokens = int(-result)
		cTokens = make([]C.llama_token, maxTokens)
		result = C.llama_tokenize(
			m.c,
			cText,
			C.int32_t(len(text)),
			&cTokens[0],
			C.int32_t(maxTokens),
			C.bool(addSpecial),
			C.bool(parseSpecial),
		)
		if result < 0 {
			return nil, fmt.Errorf("tokenization failed, required %d tokens", -result)
		}
	}

	tokens := make([]int, result)
	for i := 0; i < int(result); i++ {
		tokens[i] = int(cTokens[i])
	}

	return tokens, nil
}

func (c *Context) GetEmbeddingsForTokens(tokens []int) ([][]float32, error) {
	embeddings := make([][]float32, len(tokens))

	for i, token := range tokens {
		// Create a batch with a single token
		batch, err := NewBatch(1, 1, 0)
		if err != nil {
			return nil, err
		}
		defer batch.Free()

		// Add the token to the batch
		batch.Add(token, nil, 0, false, 0)

		// Decode the batch to get the embeddings
		err = c.Decode(batch)
		if err != nil {
			return nil, err
		}

		// Get the embeddings from the context
		embedding := c.GetEmbeddingsSeq(0)
		embeddings[i] = make([]float32, len(embedding))
		copy(embeddings[i], embedding)
	}

	return embeddings, nil
}

// func (c *Context) InitializeModel2VecWithEmbeddings(embeddings [][]float32, tokens []string) error {
// 	if !c.useModel2Vec {
// 		return nil
// 	}

// 	count := len(tokens)
// 	if len(embeddings) != count {
// 		return errors.New("number of embeddings does not match number of tokens")
// 	}

// 	// Prepare C arrays
// 	embeddingPtrs := make([]*C.float, count)
// 	tokenPtrs := make([]*C.char, count)

// 	for i := 0; i < count; i++ {
// 		embeddingPtrs[i] = (*C.float)(unsafe.Pointer(&embeddings[i][0]))
// 		tokenPtrs[i] = C.CString(tokens[i])
// 		defer C.free(unsafe.Pointer(tokenPtrs[i]))
// 	}

// 	success := C.llama_model2vec_initialize(
// 		c.model2Vec,
// 		(**C.float)(unsafe.Pointer(&embeddingPtrs[0])),
// 		(**C.char)(unsafe.Pointer(&tokenPtrs[0])),
// 		C.size_t(count),
// 	)

// 	if !bool(success) {
// 		return errors.New("failed to initialize model2vec with embeddings")
// 	}

// 	return nil
// }

func (m *Model) NEmbd() int {
	fmt.Println("NEmbd")
	return int(C.llama_n_embd(m.c))
}

func Quantize(infile, outfile string, ftype uint32) error {
	fmt.Println("Quantize")
	cinfile := C.CString(infile)
	defer C.free(unsafe.Pointer(cinfile))

	coutfile := C.CString(outfile)
	defer C.free(unsafe.Pointer(coutfile))

	params := C.llama_model_quantize_default_params()
	params.nthread = -1
	params.ftype = ftype

	if rc := C.llama_model_quantize(cinfile, coutfile, &params); rc != 0 {
		return fmt.Errorf("llama_model_quantize: %d", rc)
	}

	return nil
}

// vision processing
type ClipContext struct {
	c *C.struct_clip_ctx
}

func NewClipContext(llamaContext *Context, modelPath string) (*ClipContext, error) {
	mp := C.CString(modelPath)
	defer C.free(unsafe.Pointer(mp))
	c := C.clip_model_load(mp, 1)
	if c == nil {
		return nil, fmt.Errorf("unable to load clip model: %v", modelPath)
	}

	projEmbedSize := int(C.clip_n_mmproj_embd(c))
	modelEmbedSize := llamaContext.Model().NEmbd()
	if projEmbedSize != modelEmbedSize {
		return nil, fmt.Errorf("projector embedding size (%d) does not match model (%d)", projEmbedSize, modelEmbedSize)
	}

	return &ClipContext{c: c}, nil
}

func (c *ClipContext) Free() {
	C.clip_free(c.c)
}

func (c *ClipContext) NewEmbed(llamaContext *Context, data []byte) ([][]float32, error) {
	l := C.llava_image_embed_make_with_bytes(c.c, C.int(llamaContext.numThreads), (*C.uchar)(unsafe.Pointer(&data[0])), C.int(len(data)))
	if l == nil {
		return nil, errors.New("unable to make llava embedding from image")
	}

	numTokens := int(l.n_image_pos)
	numEmbed := llamaContext.Model().NEmbd()

	s := unsafe.Slice((*float32)(l.embed), numEmbed*numTokens)

	embed := make([][]float32, numTokens)
	rows := make([]float32, len(s))
	copy(rows, s)

	for i := range embed {
		embed[i] = rows[i*numEmbed : (i+1)*numEmbed]
	}

	C.llava_image_embed_free(l)

	return embed, nil
}

type MllamaContext struct {
	c *C.struct_mllama_ctx
}

func NewMllamaContext(llamaContext *Context, modelPath string) (*MllamaContext, error) {
	mp := C.CString(modelPath)
	defer C.free(unsafe.Pointer(mp))
	c := C.mllama_model_load(mp, 1)
	if c == nil {
		return nil, fmt.Errorf("unable to load mllama model: %v", modelPath)
	}

	projEmbedSize := int(C.mllama_n_embd(c))
	modelEmbedSize := llamaContext.Model().NEmbd()
	if projEmbedSize != modelEmbedSize {
		return nil, fmt.Errorf("projector embedding size (%d) does not match model (%d)", projEmbedSize, modelEmbedSize)
	}

	return &MllamaContext{c: c}, nil
}

func (m *MllamaContext) Free() {
	C.mllama_free(m.c)
}

func (m *MllamaContext) NewEmbed(llamaContext *Context, data []byte, aspectRatioId int) ([][]float32, error) {
	img := C.mllama_image_init()
	defer C.mllama_image_free(img)

	ok := bool(C.mllama_image_load_from_data(unsafe.Pointer(&data[0]), C.int(len(data)), 560, 560, 3, 4, C.int(aspectRatioId), img))
	if !ok {
		return nil, errors.New("unable to load mllama image data")
	}

	rows := make([]float32, m.EmbedSize(llamaContext))
	ok = bool(C.mllama_image_encode(m.c, C.int(llamaContext.numThreads), img, (*C.float)(unsafe.Pointer(&rows[0]))))
	if !ok {
		return nil, errors.New("unable to make mllama embedding from image")
	}

	embed := make([][]float32, 1)
	embed[0] = rows

	return embed, nil
}

func (m *MllamaContext) EmbedSize(llamaContext *Context) int {
	numTokens := int(C.mllama_n_positions(m.c) * C.mllama_n_tiles(m.c))
	numEmbed := llamaContext.Model().NEmbd()

	return numTokens * numEmbed
}

func (c *Context) SetCrossAttention(state bool) {
	logToFile(fmt.Sprintf("SetCrossAttention: state = %v", state))
	C.llama_set_cross_attention(c.c, C.bool(state))
}

func (c *Context) Synchronize() {
	logToFile("Synchronize")
	C.llama_synchronize(c.c)
}

// sampling
// TODO: this is a temporary wrapper to allow calling C++ code from CGo
type SamplingContext struct {
	c *C.struct_gpt_sampler
}

type SamplingParams struct {
	TopK           int
	TopP           float32
	MinP           float32
	TfsZ           float32
	TypicalP       float32
	Temp           float32
	RepeatLastN    int
	PenaltyRepeat  float32
	PenaltyFreq    float32
	PenaltyPresent float32
	Mirostat       int
	MirostatTau    float32
	MirostatEta    float32
	PenalizeNl     bool
	Seed           uint32
	Grammar        string
}

func NewSamplingContext(model *Model, params SamplingParams) (*SamplingContext, error) {
	fmt.Println("NewSamplingContext")
	var cparams C.struct_gpt_sampler_cparams
	cparams.top_k = C.int32_t(params.TopK)
	cparams.top_p = C.float(params.TopP)
	cparams.min_p = C.float(params.MinP)
	cparams.tfs_z = C.float(params.TfsZ)
	cparams.typical_p = C.float(params.TypicalP)
	cparams.temp = C.float(params.Temp)
	cparams.penalty_last_n = C.int32_t(params.RepeatLastN)
	cparams.penalty_repeat = C.float(params.PenaltyRepeat)
	cparams.penalty_freq = C.float(params.PenaltyFreq)
	cparams.penalty_present = C.float(params.PenaltyFreq)
	cparams.mirostat = C.int32_t(params.Mirostat)
	cparams.mirostat_tau = C.float(params.MirostatTau)
	cparams.mirostat_eta = C.float(params.MirostatEta)
	cparams.penalize_nl = C.bool(params.PenalizeNl)
	cparams.seed = C.uint32_t(params.Seed)

	grammar := C.CString(params.Grammar)
	defer C.free(unsafe.Pointer(grammar))

	cparams.grammar = grammar
	logToFile(fmt.Sprintf("NewSamplingContext: params = %v", params))
	context := &SamplingContext{c: C.gpt_sampler_cinit(model.c, &cparams)}
	if context.c == nil {
		return nil, errors.New("unable to create sampling context")
	}

	runtime.SetFinalizer(context, func(s *SamplingContext) { C.gpt_sampler_cfree(s.c) })

	return context, nil
}

func (s *SamplingContext) Reset() {
	C.gpt_sampler_creset(s.c)
}

func (s *SamplingContext) Sample(llamaContext *Context, idx int) int {
	fmt.Println("Sampling", idx)
	logToFile(fmt.Sprintf("Sampling: idx = %d", idx))
	return int(C.gpt_sampler_csample(s.c, llamaContext.c, C.int(idx)))
}

func (s *SamplingContext) Accept(id int, applyGrammar bool) {
	fmt.Println("Accepting", id, applyGrammar)
	logToFile(fmt.Sprintf("Accepting: id = %d, applyGrammar = %v", id, applyGrammar))
	C.gpt_sampler_caccept(s.c, C.llama_token(id), C.bool(applyGrammar))
}
