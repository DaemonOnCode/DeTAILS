package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"log/slog"
	"math/rand"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/semaphore"

	"github.com/ollama/ollama/api"
	"github.com/ollama/ollama/build"
	"github.com/ollama/ollama/discover"
	"github.com/ollama/ollama/envconfig"
	"github.com/ollama/ollama/format"
	"github.com/ollama/ollama/llama"
	"github.com/ollama/ollama/runners"
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

type LlamaServer interface {
	Ping(ctx context.Context) error
	WaitUntilRunning(ctx context.Context) error
	Completion(ctx context.Context, req CompletionRequest, fn func(CompletionResponse)) error
	Embedding(ctx context.Context, input string) ([]float32, error)
	Tokenize(ctx context.Context, content string) ([]int, error)
	Detokenize(ctx context.Context, tokens []int) (string, error)
	Close() error
	EstimatedVRAM() uint64 // Total VRAM across all GPUs
	EstimatedTotal() uint64
	EstimatedVRAMByGPU(gpuID string) uint64
}

// llmServer is an instance of the llama.cpp server
type llmServer struct {
	port        int
	cmd         *exec.Cmd
	done        chan error // Channel to signal when the process exits
	status      *StatusWriter
	options     api.Options
	numParallel int
	modelPath   string
	modelLock   sync.Mutex   // Temporary until we switch fully to Go server
	model       *llama.Model // If non-nil, the runner is a new Go server

	estimate    MemoryEstimate
	totalLayers uint64
	// gpuCount     int
	gpus         discover.GpuInfoList // Recorded just before the model loaded, free space will be incorrect
	loadDuration time.Duration        // Record how long it took the model to load
	loadProgress float32

	sem *semaphore.Weighted
}

// LoadModel will load a model from disk. The model must be in the GGML format.
//
// It collects array values for arrays with a size less than or equal to
// maxArraySize. If maxArraySize is 0, the default value of 1024 is used. If
// the maxArraySize is negative, all arrays are collected.
func LoadModel(model string, maxArraySize int) (*GGML, error) {
	if _, err := os.Stat(model); err != nil {
		return nil, err
	}

	f, err := os.Open(model)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	ggml, _, err := DecodeGGML(f, maxArraySize)
	return ggml, err
}

// NewLlamaServer will run a server for the given GPUs
// The gpu list must be a single family.
func NewLlamaServer(gpus discover.GpuInfoList, model string, ggml *GGML, adapters, projectors []string, opts api.Options, numParallel int) (LlamaServer, error) {
	var err error
	var cpuRunner string
	var estimate MemoryEstimate
	var systemTotalMemory uint64
	var systemFreeMemory uint64
	var systemSwapFreeMemory uint64

	systemInfo := discover.GetSystemInfo()
	systemTotalMemory = systemInfo.System.TotalMemory
	systemFreeMemory = systemInfo.System.FreeMemory
	systemSwapFreeMemory = systemInfo.System.FreeSwap
	slog.Info("system memory", "total", format.HumanBytes2(systemTotalMemory), "free", format.HumanBytes2(systemFreeMemory), "free_swap", format.HumanBytes2(systemSwapFreeMemory))

	// If the user wants zero GPU layers, reset the gpu list to be CPU/system ram info
	if opts.NumGPU == 0 {
		gpus = discover.GetCPUInfo()
	}
	if len(gpus) == 1 && gpus[0].Library == "cpu" {
		cpuRunner = runners.ServerForCpu()
		estimate = EstimateGPULayers(gpus, ggml, projectors, opts)
	} else {
		estimate = EstimateGPULayers(gpus, ggml, projectors, opts)

		switch {
		case gpus[0].Library == "metal" && estimate.VRAMSize > systemTotalMemory:
			// disable partial offloading when model is greater than total system memory as this
			// can lead to locking up the system
			opts.NumGPU = 0
		case gpus[0].Library != "metal" && estimate.Layers == 0:
			// Don't bother loading into the GPU if no layers can fit
			cpuRunner = runners.ServerForCpu()
			gpus = discover.GetCPUInfo()
		case opts.NumGPU < 0 && estimate.Layers > 0 && gpus[0].Library != "cpu":
			opts.NumGPU = estimate.Layers
		}
	}

	// On linux and windows, over-allocating CPU memory will almost always result in an error
	// Darwin has fully dynamic swap so has no direct concept of free swap space
	if runtime.GOOS != "darwin" {
		systemMemoryRequired := estimate.TotalSize - estimate.VRAMSize
		available := systemFreeMemory + systemSwapFreeMemory
		if systemMemoryRequired > available {
			slog.Warn("model request too large for system", "requested", format.HumanBytes2(systemMemoryRequired), "available", available, "total", format.HumanBytes2(systemTotalMemory), "free", format.HumanBytes2(systemFreeMemory), "swap", format.HumanBytes2(systemSwapFreeMemory))
			return nil, fmt.Errorf("model requires more system memory (%s) than is available (%s)", format.HumanBytes2(systemMemoryRequired), format.HumanBytes2(available))
		}
	}

	estimate.log()

	// Loop through potential servers
	finalErr := errors.New("no suitable llama servers found")

	if len(adapters) > 1 {
		return nil, errors.New("ollama supports only one lora adapter, but multiple were provided")
	}

	fmt.Println("Refreshing runners", build.EmbedFS)

	rDir, err := runners.Refresh(build.EmbedFS)
	if err != nil {
		return nil, err
	}

	availableServers := runners.GetAvailableServers(rDir)
	if len(availableServers) == 0 {
		return nil, finalErr
	}
	var servers []string
	if cpuRunner != "" {
		servers = []string{cpuRunner}
	} else {
		servers = runners.ServersForGpu(gpus[0]) // All GPUs in the list are matching Library and Variant
	}
	demandLib := envconfig.LLMLibrary()
	if demandLib != "" {
		serverPath := availableServers[demandLib]
		if serverPath == "" {
			slog.Info(fmt.Sprintf("Invalid OLLAMA_LLM_LIBRARY %s - not found", demandLib))
		} else {
			slog.Info("user override", "OLLAMA_LLM_LIBRARY", demandLib, "path", serverPath)
			servers = []string{demandLib}
			if strings.HasPrefix(demandLib, "cpu") {
				// Omit the GPU flag to silence the warning
				opts.NumGPU = -1
			}
		}
	}

	if len(servers) == 0 {
		return nil, fmt.Errorf("no servers found for %v", gpus)
	}

	params := []string{
		"--model", model,
		"--ctx-size", strconv.Itoa(opts.NumCtx),
		"--batch-size", strconv.Itoa(opts.NumBatch),
	}

	if opts.NumGPU >= 0 {
		params = append(params, "--n-gpu-layers", strconv.Itoa(opts.NumGPU))
	}

	if envconfig.Debug() {
		params = append(params, "--verbose")
	}

	if opts.MainGPU > 0 {
		params = append(params, "--main-gpu", strconv.Itoa(opts.MainGPU))
	}

	if len(adapters) > 0 {
		// TODO: applying multiple adapters is not supported by the llama.cpp server yet
		params = append(params, "--lora", adapters[0])
	}

	if len(projectors) > 0 {
		// TODO: applying multiple projectors is not supported by the llama.cpp server yet
		params = append(params, "--mmproj", projectors[0])
	}

	defaultThreads := systemInfo.GetOptimalThreadCount()
	if opts.NumThread > 0 {
		params = append(params, "--threads", strconv.Itoa(opts.NumThread))
	} else if defaultThreads > 0 {
		params = append(params, "--threads", strconv.Itoa(defaultThreads))
	}

	flashAttnEnabled := envconfig.FlashAttention()

	for _, g := range gpus {
		// only cuda (compute capability 7+) and metal support flash attention
		if g.Library != "metal" && (g.Library != "cuda" || g.DriverMajor < 7) {
			flashAttnEnabled = false
		}

		// mmap has issues with partial offloading on metal
		if g.Library == "metal" &&
			uint64(opts.NumGPU) > 0 &&
			uint64(opts.NumGPU) < ggml.KV().BlockCount()+1 {
			opts.UseMMap = new(bool)
			*opts.UseMMap = false
		}
	}

	if flashAttnEnabled {
		params = append(params, "--flash-attn")
	}

	// Windows CUDA should not use mmap for best performance
	// Linux  with a model larger than free space, mmap leads to thrashing
	// For CPU loads we want the memory to be allocated, not FS cache
	if (runtime.GOOS == "windows" && gpus[0].Library == "cuda" && opts.UseMMap == nil) ||
		(runtime.GOOS == "linux" && systemFreeMemory < estimate.TotalSize && opts.UseMMap == nil) ||
		(gpus[0].Library == "cpu" && opts.UseMMap == nil) ||
		(opts.UseMMap != nil && !*opts.UseMMap) {
		params = append(params, "--no-mmap")
	}

	if opts.UseMLock {
		params = append(params, "--mlock")
	}

	// TODO - NUMA support currently doesn't work properly

	params = append(params, "--parallel", strconv.Itoa(numParallel))

	if estimate.TensorSplit != "" {
		params = append(params, "--tensor-split", estimate.TensorSplit)
	}

	if envconfig.MultiUserCache() {
		params = append(params, "--multiuser-cache")
	}

	for i := range servers {
		dir := availableServers[servers[i]]
		if dir == "" {
			// Shouldn't happen
			finalErr = fmt.Errorf("[%d] server %s not listed in available servers %v", i, servers[i], availableServers)
			slog.Error("server list inconsistent", "error", finalErr)
			continue
		}

		if strings.HasPrefix(servers[i], "cpu") {
			gpus = discover.GetCPUInfo()
		}

		// Find an availableServers  port, retry on each iteration in case the failure was a port conflict race
		port := 0
		if a, err := net.ResolveTCPAddr("tcp", "localhost:0"); err == nil {
			var l *net.TCPListener
			if l, err = net.ListenTCP("tcp", a); err == nil {
				port = l.Addr().(*net.TCPAddr).Port
				l.Close()
			}
		}
		if port == 0 {
			slog.Debug("ResolveTCPAddr failed ", "error", err)
			port = rand.Intn(65535-49152) + 49152 // get a random port in the ephemeral range
		}
		finalParams := append(params, "--port", strconv.Itoa(port))

		pathEnv := "LD_LIBRARY_PATH"
		if runtime.GOOS == "windows" {
			pathEnv = "PATH"
		}
		// Start with the server directory for the LD_LIBRARY_PATH/PATH
		libraryPaths := []string{dir}

		if libraryPath, ok := os.LookupEnv(pathEnv); ok {
			// favor our bundled library dependencies over system libraries
			libraryPaths = append(libraryPaths, filepath.SplitList(libraryPath)...)
		}

		// Note: we always put the dependency path first
		// since this was the exact version we compiled/linked against
		if gpus[0].DependencyPath != nil {
			// assume gpus from the same library have the same dependency path
			libraryPaths = append(gpus[0].DependencyPath, libraryPaths...)
		}

		server := filepath.Join(dir, "ollama_llama_server")
		if runtime.GOOS == "windows" {
			server += ".exe"
		}

		// Detect tmp cleaners wiping out the file
		_, err := os.Stat(server)
		if errors.Is(err, os.ErrNotExist) {
			slog.Warn("llama server disappeared, reinitializing payloads", "path", server, "error", err)
			_, err = runners.Refresh(build.EmbedFS)
			if err != nil {
				slog.Warn("failed to reinitialize payloads", "error", err)
				return nil, err
			}
		}

		// Define the log file path for the other server
		logFilePath := "./server_runner.log"
		logFile, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return nil, fmt.Errorf("failed to open log file: %v", err)
		}

		// TODO - once fully switched to the Go runner, load the model here for tokenize/detokenize cgo access
		s := &llmServer{
			port:        port,
			cmd:         exec.Command(server, finalParams...),
			status:      NewStatusWriter(logFile),
			options:     opts,
			modelPath:   model,
			estimate:    estimate,
			numParallel: numParallel,
			sem:         semaphore.NewWeighted(int64(numParallel)),
			totalLayers: ggml.KV().BlockCount() + 1,
			gpus:        gpus,
			done:        make(chan error, 1),
		}

		s.cmd.Env = os.Environ()
		s.cmd.Stdout = os.Stdout
		s.cmd.Stderr = s.status
		s.cmd.SysProcAttr = LlamaServerSysProcAttr

		envWorkarounds := [][2]string{}
		for _, gpu := range gpus {
			envWorkarounds = append(envWorkarounds, gpu.EnvWorkarounds...)
		}
		visibleDevicesEnv, visibleDevicesEnvVal := gpus.GetVisibleDevicesEnv()
		pathEnvVal := strings.Join(libraryPaths, string(filepath.ListSeparator))

		// Update or add the path and visible devices variable with our adjusted version
		pathNeeded := true
		devicesNeeded := visibleDevicesEnv != ""
		for i := range s.cmd.Env {
			cmp := strings.SplitN(s.cmd.Env[i], "=", 2)
			if strings.EqualFold(cmp[0], pathEnv) {
				s.cmd.Env[i] = pathEnv + "=" + pathEnvVal
				pathNeeded = false
			} else if devicesNeeded && strings.EqualFold(cmp[0], visibleDevicesEnv) {
				s.cmd.Env[i] = visibleDevicesEnv + "=" + visibleDevicesEnvVal
				devicesNeeded = false
			} else if len(envWorkarounds) != 0 {
				for _, kv := range envWorkarounds {
					if strings.EqualFold(cmp[0], kv[0]) {
						s.cmd.Env[i] = kv[0] + "=" + kv[1]
					}
				}
			}
		}
		if pathNeeded {
			s.cmd.Env = append(s.cmd.Env, pathEnv+"="+pathEnvVal)
		}
		if devicesNeeded {
			s.cmd.Env = append(s.cmd.Env, visibleDevicesEnv+"="+visibleDevicesEnvVal)
		}

		// Set the server's stdout and stderr to write to the log file
		s.cmd.Stdout = logFile
		s.cmd.Stderr = logFile

		// Logging the start of the server
		slog.Info("starting llama server", "cmd", s.cmd.String(), "logFile", logFilePath)
		if envconfig.Debug() {
			filteredEnv := []string{}
			for _, ev := range s.cmd.Env {
				if strings.HasPrefix(ev, "CUDA_") ||
					strings.HasPrefix(ev, "ROCR_") ||
					strings.HasPrefix(ev, "ROCM_") ||
					strings.HasPrefix(ev, "HIP_") ||
					strings.HasPrefix(ev, "GPU_") ||
					strings.HasPrefix(ev, "HSA_") ||
					strings.HasPrefix(ev, "GGML_") ||
					strings.HasPrefix(ev, "PATH=") ||
					strings.HasPrefix(ev, "LD_LIBRARY_PATH=") {
					filteredEnv = append(filteredEnv, ev)
				}
			}
			// Log at debug as the environment is inherited and might contain sensitive information
			slog.Debug("subprocess", "environment", filteredEnv)
		}

		// Start the command
		if err = s.cmd.Start(); err != nil {
			// Detect permission denied and augment the message about noexec
			if errors.Is(err, os.ErrPermission) {
				finalErr = fmt.Errorf("unable to start server %w.  %s may have noexec set.  Set OLLAMA_TMPDIR for server to a writable executable directory", err, dir)
				return nil, finalErr
			}
			msg := ""
			if s.status != nil && s.status.LastErrMsg != "" {
				msg = s.status.LastErrMsg
			}
			err = fmt.Errorf("error starting the external llama server: %v %s", err, msg)
			return nil, err
		}

		// if err = s.cmd.Start(); err != nil {
		// 	// Detect permission denied and augment the message about noexec
		// 	if errors.Is(err, os.ErrPermission) {
		// 		finalErr = fmt.Errorf("unable to start server %w.  %s may have noexec set.  Set OLLAMA_TMPDIR for server to a writable executable directory", err, dir)
		// 		continue
		// 	}
		// 	msg := ""
		// 	if s.status != nil && s.status.LastErrMsg != "" {
		// 		msg = s.status.LastErrMsg
		// 	}
		// 	err = fmt.Errorf("error starting the external llama server: %v %s", err, msg)
		// 	finalErr = err
		// 	continue
		// }

		// reap subprocess when it exits
		go func() {
			err := s.cmd.Wait()
			// Favor a more detailed message over the process exit status
			if err != nil && s.status != nil && s.status.LastErrMsg != "" {
				slog.Debug("llama runner terminated", "error", err)
				if strings.Contains(s.status.LastErrMsg, "unknown model") {
					s.status.LastErrMsg = "this model is not supported by your version of Ollama. You may need to upgrade"
				}
				s.done <- errors.New(s.status.LastErrMsg)
			} else {
				s.done <- err
			}
		}()

		return s, nil
	}

	slog.Error("unable to load any llama server", "error", finalErr)
	return nil, finalErr
}

type ServerStatus int

const ( // iota is reset to 0
	ServerStatusReady ServerStatus = iota
	ServerStatusNoSlotsAvailable
	ServerStatusLoadingModel
	ServerStatusNotResponding
	ServerStatusError
)

func (s ServerStatus) ToString() string {
	switch s {
	case ServerStatusReady:
		return "llm server ready"
	case ServerStatusNoSlotsAvailable:
		return "llm busy - no slots available"
	case ServerStatusLoadingModel:
		return "llm server loading model"
	case ServerStatusNotResponding:
		return "llm server not responding"
	default:
		return "llm server error"
	}
}

type ServerStatusResp struct {
	Status          string  `json:"status"`
	SlotsIdle       int     `json:"slots_idle"`
	SlotsProcessing int     `json:"slots_processing"`
	Error           string  `json:"error"`
	Progress        float32 `json:"progress"`
}

func (s *llmServer) getServerStatus(ctx context.Context) (ServerStatus, error) {
	// Fail fast if its exited
	if s.cmd.ProcessState != nil {
		msg := ""
		if s.status != nil && s.status.LastErrMsg != "" {
			msg = s.status.LastErrMsg
		}
		if s.cmd.ProcessState.ExitCode() == -1 {
			// Most likely a signal killed it, log some more details to try to help troubleshoot
			slog.Warn("llama runner process no longer running", "sys", s.cmd.ProcessState.Sys(), "string", s.cmd.ProcessState.String())
		}
		return ServerStatusError, fmt.Errorf("llama runner process no longer running: %d %s", s.cmd.ProcessState.ExitCode(), msg)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://127.0.0.1:%d/health", s.port), nil)
	if err != nil {
		return ServerStatusError, fmt.Errorf("error creating GET request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return ServerStatusNotResponding, errors.New("server not responding")
		}
		return ServerStatusError, fmt.Errorf("health resp: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ServerStatusError, fmt.Errorf("read health request: %w", err)
	}

	var status ServerStatusResp
	if err := json.Unmarshal(body, &status); err != nil {
		return ServerStatusError, fmt.Errorf("health unmarshal encode response: %w", err)
	}

	switch status.Status {
	case "ok":
		return ServerStatusReady, nil
	case "no slot available":
		return ServerStatusNoSlotsAvailable, nil
	case "loading model":
		s.loadProgress = status.Progress
		return ServerStatusLoadingModel, nil
	default:
		return ServerStatusError, fmt.Errorf("server error: %+v", status)
	}
}

// getServerStatusRetry will retry if ServerStatusNoSlotsAvailable is received
func (s *llmServer) getServerStatusRetry(ctx context.Context) (ServerStatus, error) {
	var retries int
	for {
		status, err := s.getServerStatus(ctx)
		if err != nil {
			return status, err
		}

		if status == ServerStatusNoSlotsAvailable {
			if retries >= 10 {
				return status, fmt.Errorf("no slots available after %d retries", retries)
			}

			time.Sleep(5 * time.Millisecond)
			retries++
			continue
		}

		return status, nil
	}
}

func (s *llmServer) Ping(ctx context.Context) error {
	_, err := s.getServerStatus(ctx)
	if err != nil {
		slog.Debug("server unhealthy", "error", err)
		return err
	}
	return nil
}

func (s *llmServer) WaitUntilRunning(ctx context.Context) error {
	start := time.Now()
	stallDuration := envconfig.LoadTimeout()    // If no progress happens
	stallTimer := time.Now().Add(stallDuration) // give up if we stall

	slog.Info("waiting for llama runner to start responding")
	var lastStatus ServerStatus = -1
	fullyLoaded := false

	for {
		select {
		case <-ctx.Done():
			slog.Warn("client connection closed before server finished loading, aborting load")
			return fmt.Errorf("timed out waiting for llama runner to start: %w", ctx.Err())
		case err := <-s.done:
			return fmt.Errorf("llama runner process has terminated: %w", err)
		default:
		}
		if time.Now().After(stallTimer) {
			// timeout
			msg := ""
			if s.status != nil && s.status.LastErrMsg != "" {
				msg = s.status.LastErrMsg
			}
			return fmt.Errorf("timed out waiting for llama runner to start - progress %0.2f - %s", s.loadProgress, msg)
		}
		if s.cmd.ProcessState != nil {
			msg := ""
			if s.status != nil && s.status.LastErrMsg != "" {
				msg = s.status.LastErrMsg
			}
			return fmt.Errorf("llama runner process no longer running: %d %s", s.cmd.ProcessState.ExitCode(), msg)
		}
		ctx, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
		defer cancel()
		priorProgress := s.loadProgress
		status, _ := s.getServerStatus(ctx)
		if lastStatus != status && status != ServerStatusReady {
			// Only log on status changes
			slog.Info("waiting for server to become available", "status", status.ToString())
		}
		switch status {
		case ServerStatusReady:
			s.loadDuration = time.Since(start)
			slog.Info(fmt.Sprintf("llama runner started in %0.2f seconds", s.loadDuration.Seconds()))
			return nil
		default:
			lastStatus = status
			// Reset the timer as long as we're making forward progress on the load
			if priorProgress != s.loadProgress {
				slog.Debug(fmt.Sprintf("model load progress %0.2f", s.loadProgress))
				stallTimer = time.Now().Add(stallDuration)
			} else if !fullyLoaded && int(s.loadProgress*100.0) >= 100 {
				slog.Debug("model load completed, waiting for server to become available", "status", status.ToString())
				stallTimer = time.Now().Add(stallDuration)
				fullyLoaded = true
			}
			time.Sleep(time.Millisecond * 250)
			continue
		}
	}
}

const jsonGrammar = `
root   ::= object
value  ::= object | array | string | number | ("true" | "false" | "null") ws

object ::=
  "{" ws (
            string ":" ws value
    ("," ws string ":" ws value)*
  )? "}" ws

array  ::=
  "[" ws (
            value
    ("," ws value)*
  )? "]" ws

string ::=
  "\"" (
    [^"\\\x7F\x00-\x1F] |
    "\\" (["\\/bfnrt] | "u" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]) # escapes
  )* "\"" ws

number ::= ("-"? ([0-9] | [1-9] [0-9]*)) ("." [0-9]+)? ([eE] [-+]? [0-9]+)? ws

# Optional space: by convention, applied in this grammar after literal chars when allowed
ws ::= ([ \t\n] ws)?
`

const maxBufferSize = 512 * format.KiloByte

type ImageData struct {
	Data          []byte `json:"data"`
	ID            int    `json:"id"`
	AspectRatioID int    `json:"aspect_ratio_id"`
}

type completion struct {
	Content      string `json:"content"`
	Model        string `json:"model"`
	Prompt       string `json:"prompt"`
	Stop         bool   `json:"stop"`
	StoppedLimit bool   `json:"stopped_limit"`

	Timings struct {
		PredictedN  int     `json:"predicted_n"`
		PredictedMS float64 `json:"predicted_ms"`
		PromptN     int     `json:"prompt_n"`
		PromptMS    float64 `json:"prompt_ms"`
	}
}

type CompletionRequest struct {
	Prompt  string
	Format  string
	Images  []ImageData
	Options *api.Options
}

type CompletionResponse struct {
	Content            string
	DoneReason         string
	Done               bool
	PromptEvalCount    int
	PromptEvalDuration time.Duration
	EvalCount          int
	EvalDuration       time.Duration
}

func (s *llmServer) Completion(ctx context.Context, req CompletionRequest, fn func(CompletionResponse)) error {
	if err := s.sem.Acquire(ctx, 1); err != nil {
		slog.Error("Failed to acquire semaphore", "error", err)
		return err
	}
	defer s.sem.Release(1)

	// put an upper limit on num_predict to avoid the model running on forever
	if req.Options.NumPredict < 0 || req.Options.NumPredict > 10*s.options.NumCtx {
		req.Options.NumPredict = 10 * s.options.NumCtx
	}

	request := map[string]any{
		"prompt":            req.Prompt,
		"stream":            true,
		"n_predict":         req.Options.NumPredict,
		"n_keep":            req.Options.NumKeep,
		"main_gpu":          req.Options.MainGPU,
		"temperature":       req.Options.Temperature,
		"top_k":             req.Options.TopK,
		"top_p":             req.Options.TopP,
		"min_p":             req.Options.MinP,
		"tfs_z":             req.Options.TFSZ,
		"typical_p":         req.Options.TypicalP,
		"repeat_last_n":     req.Options.RepeatLastN,
		"repeat_penalty":    req.Options.RepeatPenalty,
		"presence_penalty":  req.Options.PresencePenalty,
		"frequency_penalty": req.Options.FrequencyPenalty,
		"mirostat":          req.Options.Mirostat,
		"mirostat_tau":      req.Options.MirostatTau,
		"mirostat_eta":      req.Options.MirostatEta,
		"penalize_nl":       req.Options.PenalizeNewline,
		"seed":              req.Options.Seed,
		"stop":              req.Options.Stop,
		"image_data":        req.Images,
		"cache_prompt":      true,
	}

	// Make sure the server is ready
	status, err := s.getServerStatusRetry(ctx)
	if err != nil {
		return err
	} else if status != ServerStatusReady {
		return fmt.Errorf("unexpected server status: %s", status.ToString())
	}

	if req.Format == "json" {
		request["grammar"] = jsonGrammar
		if !strings.Contains(strings.ToLower(req.Prompt), "json") {
			slog.Warn("Prompt does not specify that the LLM should response in JSON, but JSON format is expected. For best results specify that JSON is expected in the system prompt.")
		}
	}

	// Handling JSON marshaling with special characters unescaped.
	buffer := &bytes.Buffer{}
	enc := json.NewEncoder(buffer)
	enc.SetEscapeHTML(false)

	if err := enc.Encode(request); err != nil {
		return fmt.Errorf("failed to marshal data: %v", err)
	}

	endpoint := fmt.Sprintf("http://127.0.0.1:%d/completion", s.port)
	serverReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, buffer)
	if err != nil {
		return fmt.Errorf("error creating POST request: %v", err)
	}
	serverReq.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(serverReq)
	if err != nil {
		return fmt.Errorf("POST predict: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode >= 400 {
		bodyBytes, err := io.ReadAll(res.Body)
		if err != nil {
			return fmt.Errorf("failed reading llm error response: %w", err)
		}
		log.Printf("llm predict error: %s", bodyBytes)
		return fmt.Errorf("%s", bodyBytes)
	}

	scanner := bufio.NewScanner(res.Body)
	buf := make([]byte, 0, maxBufferSize)
	scanner.Buffer(buf, maxBufferSize)

	// keep track of the last token generated, this is used to abort if the model starts looping
	var lastToken string
	var tokenRepeat int

	for scanner.Scan() {
		select {
		case <-ctx.Done():
			// This handles the request cancellation
			return ctx.Err()
		default:
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}

			// slog.Debug("got line", "line", string(line))
			evt, ok := bytes.CutPrefix(line, []byte("data: "))
			if !ok {
				evt = line
			}

			var c completion
			if err := json.Unmarshal(evt, &c); err != nil {
				return fmt.Errorf("error unmarshalling llm prediction response: %v", err)
			}
			switch {
			case strings.TrimSpace(c.Content) == lastToken:
				tokenRepeat++
			default:
				lastToken = strings.TrimSpace(c.Content)
				tokenRepeat = 0
			}

			// 30 picked as an arbitrary max token repeat limit, modify as needed
			if tokenRepeat > 30 {
				slog.Debug("prediction aborted, token repeat limit reached")
				return ctx.Err()
			}

			if c.Content != "" {
				fn(CompletionResponse{
					Content: c.Content,
				})
			}

			if c.Stop {
				doneReason := "stop"
				if c.StoppedLimit {
					doneReason = "length"
				}

				fn(CompletionResponse{
					Done:               true,
					DoneReason:         doneReason,
					PromptEvalCount:    c.Timings.PromptN,
					PromptEvalDuration: parseDurationMs(c.Timings.PromptMS),
					EvalCount:          c.Timings.PredictedN,
					EvalDuration:       parseDurationMs(c.Timings.PredictedMS),
				})
				return nil
			}
		}
	}

	if err := scanner.Err(); err != nil {
		if strings.Contains(err.Error(), "unexpected EOF") {
			s.Close()
			msg := ""
			if s.status != nil && s.status.LastErrMsg != "" {
				msg = s.status.LastErrMsg
			}
			return fmt.Errorf("an unknown error was encountered while running the model %s", msg)
		}

		return fmt.Errorf("error reading llm response: %v", err)
	}

	return nil
}

type EmbeddingRequest struct {
	Content string `json:"content"`
}

type EmbeddingResponse struct {
	Embedding []float32 `json:"embedding"`
}

func (s *llmServer) Embedding(ctx context.Context, input string) ([]float32, error) {

	// LogToFile("In Embedding: "+input)
	if err := s.sem.Acquire(ctx, 1); err != nil {
		slog.Error("Failed to acquire semaphore", "error", err)
		return nil, err
	}
	defer s.sem.Release(1)

	// Make sure the server is ready
	status, err := s.getServerStatusRetry(ctx)
	if err != nil {
		return nil, err
	} else if status != ServerStatusReady {
		return nil, fmt.Errorf("unexpected server status: %s", status.ToString())
	}

	// LogToFile("Server is ready")

	data, err := json.Marshal(EmbeddingRequest{Content: input})
	if err != nil {
		return nil, fmt.Errorf("error marshaling embed data: %w", err)
	}

	// LogToFile("Data is marshaled")

	r, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("http://127.0.0.1:%d/embedding", s.port), bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("error creating embed request: %w", err)
	}
	r.Header.Set("Content-Type", "application/json")

	// LogToFile("Request is created for port "+fmt.Sprintf("%d", s.port))

	resp, err := http.DefaultClient.Do(r)
	if err != nil {
		return nil, fmt.Errorf("do embedding request: %w", err)
	}
	defer resp.Body.Close()

	// LogToFile("Response is received")

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading embed response: %w", err)
	}

	// LogToFile("Body is read"+string(body))

	if resp.StatusCode >= 400 {
		log.Printf("llm embedding error: %s", body)
		return nil, fmt.Errorf("%s", body)
	}

	// LogToFile("Status code is OK")

	var e EmbeddingResponse
	if err := json.Unmarshal(body, &e); err != nil {
		return nil, fmt.Errorf("unmarshal tokenize response: %w", err)
	}

	// LogToFile("Embedding is unmarshaled: "+fmt.Sprintf("%v", e.Embedding))

	return e.Embedding, nil
}

type TokenizeRequest struct {
	Content string `json:"content"`
}

type TokenizeResponse struct {
	Tokens []int `json:"tokens"`
}

func (s *llmServer) Tokenize(ctx context.Context, content string) ([]int, error) {
	s.modelLock.Lock()
	defer s.modelLock.Unlock()
	if s.model != nil {
		return s.model.Tokenize(content, false, true)
	}

	// Make sure the server is ready
	status, err := s.getServerStatus(ctx)
	if err != nil {
		return nil, err
	} else if status != ServerStatusReady && status != ServerStatusNoSlotsAvailable {
		return nil, fmt.Errorf("unexpected server status: %s", status.ToString())
	}

	data, err := json.Marshal(TokenizeRequest{Content: content})
	if err != nil {
		return nil, fmt.Errorf("marshaling encode data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("http://127.0.0.1:%d/tokenize", s.port), bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("encode request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do encode request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		if s.model == nil {
			slog.Debug("new runner detected, loading model for cgo tokenization")
			m, err := llama.LoadModelFromFile(s.modelPath, llama.ModelParams{VocabOnly: true})
			if err != nil {
				return nil, err
			}
			s.model = m
		}
		return s.model.Tokenize(content, false, true)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read encode request: %w", err)
	}

	if resp.StatusCode >= 400 {
		log.Printf("llm encode error: %s", body)
		return nil, fmt.Errorf("%s", body)
	}

	var encoded TokenizeResponse
	if err := json.Unmarshal(body, &encoded); err != nil {
		return nil, fmt.Errorf("unmarshal encode response: %w", err)
	}

	return encoded.Tokens, nil
}

type DetokenizeRequest struct {
	Tokens []int `json:"tokens"`
}

type DetokenizeResponse struct {
	Content string `json:"content"`
}

func (s *llmServer) Detokenize(ctx context.Context, tokens []int) (string, error) {
	s.modelLock.Lock()
	defer s.modelLock.Unlock()
	if s.model != nil {
		var resp string
		for _, token := range tokens {
			resp += s.model.TokenToPiece(token)
		}
		return resp, nil
	}
	// Make sure the server is ready
	status, err := s.getServerStatus(ctx)
	if err != nil {
		return "", err
	} else if status != ServerStatusReady && status != ServerStatusNoSlotsAvailable {
		return "", fmt.Errorf("unexpected server status: %s", status.ToString())
	}

	data, err := json.Marshal(DetokenizeRequest{Tokens: tokens})
	if err != nil {
		return "", fmt.Errorf("marshaling decode data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("http://127.0.0.1:%d/detokenize", s.port), bytes.NewBuffer(data))
	if err != nil {
		return "", fmt.Errorf("decode request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("do decode request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		if s.model == nil {
			slog.Debug("new runner detected, loading model for cgo tokenization")
			m, err := llama.LoadModelFromFile(s.modelPath, llama.ModelParams{VocabOnly: true})
			if err != nil {
				return "", err
			}
			s.model = m
		}
		var resp string
		for _, token := range tokens {
			resp += s.model.TokenToPiece(token)
		}
		return resp, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read decode request: %w", err)
	}

	if resp.StatusCode >= 400 {
		log.Printf("llm decode error: %s", body)
		return "", fmt.Errorf("%s", body)
	}

	var decoded DetokenizeResponse
	if err := json.Unmarshal(body, &decoded); err != nil {
		return "", fmt.Errorf("unmarshal encode response: %w", err)
	}

	return decoded.Content, nil
}

func (s *llmServer) Close() error {
	s.modelLock.Lock()
	if s.model != nil {
		llama.FreeModel(s.model)
		s.model = nil
	}
	s.modelLock.Unlock()

	if s.cmd != nil {
		slog.Debug("stopping llama server")
		if err := s.cmd.Process.Kill(); err != nil {
			return err
		}
		// if ProcessState is already populated, Wait already completed, no need to wait again
		if s.cmd.ProcessState == nil {
			slog.Debug("waiting for llama server to exit")
			<-s.done
		}

		slog.Debug("llama server stopped")
	}

	return nil
}

func (s *llmServer) EstimatedVRAM() uint64 {
	return s.estimate.VRAMSize
}

func (s *llmServer) EstimatedTotal() uint64 {
	return s.estimate.TotalSize
}

func (s *llmServer) EstimatedVRAMByGPU(gpuID string) uint64 {
	for i, gpu := range s.gpus {
		if gpu.ID == gpuID {
			return s.estimate.GPUSizes[i]
		}
	}
	return 0
}

func parseDurationMs(ms float64) time.Duration {
	dur, err := time.ParseDuration(fmt.Sprintf("%fms", ms))
	if err != nil {
		panic(err)
	}

	return dur
}
