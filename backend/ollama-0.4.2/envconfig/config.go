package envconfig

import (
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
	"log"
)

// Host returns the scheme and host. Host can be configured via the OLLAMA_HOST environment variable.
// Default is scheme "http" and host "127.0.0.1:11434"
func Host() *url.URL {
	defaultPort := DefaultPort

	s := strings.TrimSpace(Var("OLLAMA_HOST"))
	scheme, hostport, ok := strings.Cut(s, "://")
	switch {
	case !ok:
		scheme, hostport = DefaultSchemeHTTP, s
	case scheme == DefaultSchemeHTTP:
		defaultPort = DefaultHTTPPort
	case scheme == DefaultSchemeHTTPS:
		defaultPort = DefaultHTTPSPort
	}

	hostport, path, _ := strings.Cut(hostport, "/")
	host, port, err := net.SplitHostPort(hostport)
	if err != nil {
		host, port = "127.0.0.1", defaultPort
		if ip := net.ParseIP(strings.Trim(hostport, "[]")); ip != nil {
			host = ip.String()
		} else if hostport != "" {
			host = hostport
		}
	}

	if n, err := strconv.ParseInt(port, 10, 32); err != nil || n > 65535 || n < 0 {
		slog.Warn("invalid port, using default", "port", port, "default", defaultPort)
		port = defaultPort
	}

	return &url.URL{
		Scheme: scheme,
		Host:   net.JoinHostPort(host, port),
		Path:   path,
	}
}

// Origins returns a list of allowed origins. Origins can be configured via the OLLAMA_ORIGINS environment variable.
func Origins() (origins []string) {
	if s := Var("OLLAMA_ORIGINS"); s != "" {
		origins = strings.Split(s, ",")
	}

	for _, origin := range DefaultOrigins {
		origins = append(origins,
			fmt.Sprintf("http://%s", origin),
			fmt.Sprintf("https://%s", origin),
			fmt.Sprintf("http://%s", net.JoinHostPort(origin, "*")),
			fmt.Sprintf("https://%s", net.JoinHostPort(origin, "*")),
		)
	}

	origins = append(origins, AdditionalOrigins...)
	return origins
}

// Models returns the path to the models directory. Models directory can be configured via the OLLAMA_MODELS environment variable.
// Default is $HOME/.ollama/models
func Models() string {
	if s := Var("OLLAMA_MODELS"); s != "" {
		fmt.Println("s: ", s, "ResolvePath(s): ", ResolvePath(s))
		return ResolvePath(s)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		panic(err)
	}

	return filepath.Join(home, ".ollama", "models")
}

// KeepAlive returns the duration that models stay loaded in memory.
// Negative values are treated as infinite. Zero is treated as no keep alive.
func KeepAlive() (keepAlive time.Duration) {
	keepAlive = DefaultKeepAliveDuration
	if s := Var("OLLAMA_KEEP_ALIVE"); s != "" {
		if d, err := time.ParseDuration(s); err == nil {
			keepAlive = d
		} else if n, err := strconv.ParseInt(s, 10, 64); err == nil {
			keepAlive = time.Duration(n) * time.Second
		}
	}

	if keepAlive < 0 {
		return MaxDuration
	}

	return keepAlive
}

// LoadTimeout returns the duration for stall detection during model loads.
// Zero or Negative values are treated as infinite.
func LoadTimeout() (loadTimeout time.Duration) {
	loadTimeout = DefaultLoadTimeoutDuration
	if s := Var("OLLAMA_LOAD_TIMEOUT"); s != "" {
		if d, err := time.ParseDuration(s); err == nil {
			loadTimeout = d
		} else if n, err := strconv.ParseInt(s, 10, 64); err == nil {
			loadTimeout = time.Duration(n) * time.Second
		}
	}

	if loadTimeout <= 0 {
		return MaxDuration
	}

	return loadTimeout
}

func Bool(k string) func() bool {
	return func() bool {
		if s := Var(k); s != "" {
			b, err := strconv.ParseBool(s)
			if err != nil {
				return true
			}

			return b
		}

		return false
	}
}



func String(s string, opts ...string) func() string {
	return func() string {
		return Var(s, opts...)
	}
}

func Uint(key string, defaultValue uint) func() uint {
	return func() uint {
		if s := Var(key); s != "" {
			if n, err := strconv.ParseUint(s, 10, 64); err != nil {
				slog.Warn("invalid environment variable, using default", "key", key, "value", s, "default", defaultValue)
			} else {
				return uint(n)
			}
		}

		return defaultValue
	}
}

func Uint64(key string, defaultValue uint64) func() uint64 {
	return func() uint64 {
		if s := Var(key); s != "" {
			if n, err := strconv.ParseUint(s, 10, 64); err != nil {
				slog.Warn("invalid environment variable, using default", "key", key, "value", s, "default", defaultValue)
			} else {
				return n
			}
		}

		return defaultValue
	}
}



type EnvVar struct {
	Name        string
	Value       any
	Description string
}

// ResolvePath resolves a relative path to an absolute path based on the current working directory.
func ResolvePath(relativePath string) string {
	if relativePath == "" {
		return ""
	}
	// Get the current working directory
	workingDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Error getting working directory: %v", err)
	}

	// Join the working directory with the relative path
	absolutePath := filepath.Join(workingDir, relativePath)
	return absolutePath
}


func AsMap() map[string]EnvVar {
	ret := map[string]EnvVar{
		"OLLAMA_DEBUG":             {"OLLAMA_DEBUG", Debug(), "Show additional debug information (e.g. OLLAMA_DEBUG=1)"},
		"OLLAMA_FLASH_ATTENTION":   {"OLLAMA_FLASH_ATTENTION", FlashAttention(), "Enabled flash attention"},
		"OLLAMA_GPU_OVERHEAD":      {"OLLAMA_GPU_OVERHEAD", GpuOverhead(), "Reserve a portion of VRAM per GPU (bytes)"},
		"OLLAMA_HOST":              {"OLLAMA_HOST", Host(), "IP Address for the ollama server (default 127.0.0.1:11434)"},
		"OLLAMA_KEEP_ALIVE":        {"OLLAMA_KEEP_ALIVE", KeepAlive(), "The duration that models stay loaded in memory (default \"5m\")"},
		"OLLAMA_LLM_LIBRARY":       {"OLLAMA_LLM_LIBRARY", ResolvePath(LLMLibrary()), "Set LLM library to bypass autodetection"},
		"OLLAMA_LOAD_TIMEOUT":      {"OLLAMA_LOAD_TIMEOUT", LoadTimeout(), "How long to allow model loads to stall before giving up (default \"5m\")"},
		"OLLAMA_MAX_LOADED_MODELS": {"OLLAMA_MAX_LOADED_MODELS", MaxRunners(), "Maximum number of loaded models per GPU"},
		"OLLAMA_MAX_QUEUE":         {"OLLAMA_MAX_QUEUE", MaxQueue(), "Maximum number of queued requests"},
		"OLLAMA_MODELS":            {"OLLAMA_MODELS", Models(), "The path to the models directory"},
		"OLLAMA_NOHISTORY":         {"OLLAMA_NOHISTORY", NoHistory(), "Do not preserve readline history"},
		"OLLAMA_NOPRUNE":           {"OLLAMA_NOPRUNE", NoPrune(), "Do not prune model blobs on startup"},
		"OLLAMA_NUM_PARALLEL":      {"OLLAMA_NUM_PARALLEL", NumParallel(), "Maximum number of parallel requests"},
		"OLLAMA_ORIGINS":           {"OLLAMA_ORIGINS", Origins(), "A comma separated list of allowed origins"},
		"OLLAMA_SCHED_SPREAD":      {"OLLAMA_SCHED_SPREAD", SchedSpread(), "Always schedule model across all GPUs"},
		"OLLAMA_TMPDIR":            {"OLLAMA_TMPDIR", ResolvePath(TmpDir()), "Location for temporary files"},
		"OLLAMA_MULTIUSER_CACHE":   {"OLLAMA_MULTIUSER_CACHE", MultiUserCache(), "Optimize prompt caching for multi-user scenarios"},

		// Informational
		"HTTP_PROXY":  {"HTTP_PROXY", String("HTTP_PROXY")(), "HTTP proxy"},
		"HTTPS_PROXY": {"HTTPS_PROXY", String("HTTPS_PROXY")(), "HTTPS proxy"},
		"NO_PROXY":    {"NO_PROXY", String("NO_PROXY")(), "No proxy"},

		// Model Initialization
		"INIT_MODELS": {"INIT_MODELS", InitModels(), "Comma separated list of models to initialize"},
	}

	if runtime.GOOS != "windows" {
		// Windows environment variables are case-insensitive so there's no need to duplicate them
		ret["http_proxy"] = EnvVar{"http_proxy", String("http_proxy")(), "HTTP proxy"}
		ret["https_proxy"] = EnvVar{"https_proxy", String("https_proxy")(), "HTTPS proxy"}
		ret["no_proxy"] = EnvVar{"no_proxy", String("no_proxy")(), "No proxy"}
	}

	if runtime.GOOS != "darwin" {
		ret["CUDA_VISIBLE_DEVICES"] = EnvVar{"CUDA_VISIBLE_DEVICES", CudaVisibleDevices(), "Set which NVIDIA devices are visible"}
		ret["HIP_VISIBLE_DEVICES"] = EnvVar{"HIP_VISIBLE_DEVICES", HipVisibleDevices(), "Set which AMD devices are visible by numeric ID"}
		ret["ROCR_VISIBLE_DEVICES"] = EnvVar{"ROCR_VISIBLE_DEVICES", RocrVisibleDevices(), "Set which AMD devices are visible by UUID or numeric ID"}
		ret["GPU_DEVICE_ORDINAL"] = EnvVar{"GPU_DEVICE_ORDINAL", GpuDeviceOrdinal(), "Set which AMD devices are visible by numeric ID"}
		ret["HSA_OVERRIDE_GFX_VERSION"] = EnvVar{"HSA_OVERRIDE_GFX_VERSION", HsaOverrideGfxVersion(), "Override the gfx used for all detected AMD GPUs"}
		ret["OLLAMA_INTEL_GPU"] = EnvVar{"OLLAMA_INTEL_GPU", IntelGPU(), "Enable experimental Intel GPU detection"}
	}

	return ret
}

func Values() map[string]string {
	vals := make(map[string]string)
	for k, v := range AsMap() {
		vals[k] = fmt.Sprintf("%v", v.Value)
	}
	return vals
}

func Var(key string, opts ...string) string {
	val := strings.Trim(strings.TrimSpace(os.Getenv(key)), "\"'")

	// Check if the optional argument specifies path handling
	if len(opts) > 0 && opts[0] == "path" {
		// Handle path escaping based on OS
		switch runtime.GOOS {
		case "windows":
			// Enclose paths in double quotes if spaces are present
			if strings.Contains(val, " ") {
				val = fmt.Sprintf("\"%s\"", val)
			}
		default: // Unix-like systems (macOS, Linux, etc.)
			// Escape spaces with backslash
			val = strings.ReplaceAll(val, " ", "\\ ")
		}
	}

	return val
}



// On windows, we keep the binary at the top directory, but
// other platforms use a "bin" directory, so this returns ".."
func LibRelativeToExe() string {
	if runtime.GOOS == "windows" {
		return "."
	}
	return ".."
}