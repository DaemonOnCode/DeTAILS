package envconfig

import (
	"time"
)

const (
	// Default values for host and ports
	DefaultSchemeHTTP  = "http"
	DefaultSchemeHTTPS = "https"
	DefaultPort        = "11434"
	DefaultHTTPPort    = "80"
	DefaultHTTPSPort   = "443"

	// Default durations
	DefaultKeepAliveDuration   = 5 * time.Minute
	DefaultLoadTimeoutDuration = 5 * time.Minute

	// Max value for infinite durations
	MaxDuration = time.Duration(^uint64(0) >> 1) // Max int64 value as duration
)

// Default origins to append for CORS
var DefaultOrigins = []string{
	"localhost",
	"127.0.0.1",
	"0.0.0.0",
}

// Additional allowed origins
var AdditionalOrigins = []string{
	"app://*",
	"file://*",
	"tauri://*",
	"vscode-webview://*",
}


var (
	// Debug enabled additional debug information.
	Debug = Bool("OLLAMA_DEBUG")
	// FlashAttention enables the experimental flash attention feature.
	FlashAttention = Bool("OLLAMA_FLASH_ATTENTION")
	// NoHistory disables readline history.
	NoHistory = Bool("OLLAMA_NOHISTORY")
	// NoPrune disables pruning of model blobs on startup.
	NoPrune = Bool("OLLAMA_NOPRUNE")
	// SchedSpread allows scheduling models across all GPUs.
	SchedSpread = Bool("OLLAMA_SCHED_SPREAD")
	// IntelGPU enables experimental Intel GPU detection.
	IntelGPU = Bool("OLLAMA_INTEL_GPU")
	// MultiUserCache optimizes prompt caching for multi-user scenarios
	MultiUserCache = Bool("OLLAMA_MULTIUSER_CACHE")
)


var (
	LLMLibrary = String("OLLAMA_LLM_LIBRARY", "path")
	TmpDir     = String("OLLAMA_TMPDIR", "path")

	CudaVisibleDevices    = String("CUDA_VISIBLE_DEVICES")
	HipVisibleDevices     = String("HIP_VISIBLE_DEVICES")
	RocrVisibleDevices    = String("ROCR_VISIBLE_DEVICES")
	GpuDeviceOrdinal      = String("GPU_DEVICE_ORDINAL")
	HsaOverrideGfxVersion = String("HSA_OVERRIDE_GFX_VERSION")
)



// Set aside VRAM per GPU
var GpuOverhead = Uint64("OLLAMA_GPU_OVERHEAD", 0)


var (
	// NumParallel sets the number of parallel model requests. NumParallel can be configured via the OLLAMA_NUM_PARALLEL environment variable.
	NumParallel = Uint("OLLAMA_NUM_PARALLEL", 0)
	// MaxRunners sets the maximum number of loaded models. MaxRunners can be configured via the OLLAMA_MAX_LOADED_MODELS environment variable.
	MaxRunners = Uint("OLLAMA_MAX_LOADED_MODELS", 0)
	// MaxQueue sets the maximum number of queued requests. MaxQueue can be configured via the OLLAMA_MAX_QUEUE environment variable.
	MaxQueue = Uint("OLLAMA_MAX_QUEUE", 512)
	// MaxVRAM sets a maximum VRAM override in bytes. MaxVRAM can be configured via the OLLAMA_MAX_VRAM environment variable.
	MaxVRAM = Uint("OLLAMA_MAX_VRAM", 0)
)