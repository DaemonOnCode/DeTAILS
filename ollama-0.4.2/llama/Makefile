# Top-level makefile for Go server
include make/common-defs.make

# Initial runner targets
RUNNER_TARGETS := default

# Debug: Show initial targets
$(info Initial RUNNER_TARGETS=$(RUNNER_TARGETS))

# Determine which GPU runners should be built
ifeq ($(OS),windows)
	CUDA_PATH?=$(shell cygpath -m -s "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\" 2>/dev/null)unknown
	CUDA_BASE_DIR := $(dir $(shell cygpath -m -s "$(CUDA_PATH)\\.." 2>/dev/null))
	CUDA_11:=$(shell ls -d $(CUDA_BASE_DIR)/v11.? 2>/dev/null)
	CUDA_12:=$(shell ls -d $(CUDA_BASE_DIR)/v12.? 2>/dev/null)
	HIP_LIB_DIR := $(shell ls -d $(HIP_PATH)/lib 2>/dev/null)
else ifeq ($(OS),linux)
	HIP_PATH?=/opt/rocm
	HIP_LIB_DIR := $(shell ls -d $(HIP_PATH)/lib 2>/dev/null)
	CUDA_PATH?=/usr/local/cuda
	CUDA_11:=$(shell ls -d $(CUDA_PATH)-11 2>/dev/null)
	CUDA_12:=$(shell ls -d $(CUDA_PATH)-12 2>/dev/null)
endif

# Debug: Show CUDA and HIP paths
$(info CUDA_PATH=$(CUDA_PATH))
$(info HIP_PATH=$(HIP_PATH))
$(info CUDA_11=$(CUDA_11))
$(info CUDA_12=$(CUDA_12))
$(info HIP_LIB_DIR=$(HIP_LIB_DIR))

ifeq ($(OLLAMA_SKIP_CUDA_GENERATE),)
ifneq ($(CUDA_11),)
	RUNNER_TARGETS += cuda_v11
endif
ifneq ($(CUDA_12),)
	RUNNER_TARGETS += cuda_v12
endif
endif

ifeq ($(OLLAMA_SKIP_ROCM_GENERATE),)
ifneq ($(HIP_LIB_DIR),)
	RUNNER_TARGETS += rocm
endif
endif

# Debug: Final runner targets
$(info Final RUNNER_TARGETS=$(RUNNER_TARGETS))

all: clean-payload .WAIT runners

runners: $(RUNNER_TARGETS)
	@echo "Starting the runners build process"
	@echo "RUNNER_TARGETS=$(RUNNER_TARGETS)"
	@echo "Building the following runners: $(RUNNER_TARGETS)"
	@for target in $(RUNNER_TARGETS); do \
		echo "Building runner: $$target"; \
		make -f make/Makefile.$$target; \
		echo "Finished building runner: $$target"; \
	done
	@echo "All runners have been successfully built."


$(RUNNER_TARGETS):
	@echo "Building runner target: $@"
	$(MAKE) -f make/Makefile.$@
	@echo "Done building runner target: $@"

help-sync apply-patches create-patches sync:
	@echo "Running sync target..."
	$(MAKE) -f make/Makefile.sync $@
	@echo "Done running sync target."

clean:
	@echo "Cleaning build directories and artifacts..."
	@echo "BUILD_DIR=$(BUILD_DIR)"
	@echo "DIST_RUNNERS=$(DIST_RUNNERS)"
	@echo "PAYLOAD_RUNNERS=$(PAYLOAD_RUNNERS)"
	rm -rf "$(BUILD_DIR)" "$(DIST_RUNNERS)" "$(PAYLOAD_RUNNERS)"
	@echo "Done cleaning build directories and artifacts."
	go clean -cache
	@echo "Done cleaning Go cache."

clean-payload:
	@echo "Cleaning payload directories..."
	@for target in $(RUNNER_TARGETS) metal cpu cpu_avx cpu_avx2; do \
		echo "Checking target: $$target"; \
		target_dir="$(RUNNERS_PAYLOAD_DIR)/$$target"; \
		echo "Checking payload directory: $$target_dir"; \
		if [ -d "$$target_dir" ]; then \
			echo "Removing: $$target_dir"; \
			rm -rf "$$target_dir"; \
		else \
			echo "Skipping non-existent: $$target_dir"; \
		fi; \
	done
	@echo "Done cleaning payload directories."

# Handy debugging for make variables
print-%:
	@echo '$*=$($*)'

.PHONY: all runners clean clean-payload $(RUNNER_TARGETS) .WAIT
