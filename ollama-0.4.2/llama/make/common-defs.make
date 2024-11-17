# Common definitions for the various Makefiles
# No rules are defined here, so this is safe to include at the beginning of other Makefiles.

# Detect operating system and architecture
OS := $(shell uname -s)
ARCH := $(subst aarch64,arm64,$(subst x86_64,amd64,$(shell uname -m)))

# Handle specific OS conditions
ifneq (,$(findstring MINGW,$(OS))$(findstring MSYS,$(OS)))
	OS := windows
	ARCH := $(shell systeminfo 2>/dev/null | grep "System Type" | grep ARM64 > /dev/null && echo "arm64" || echo "amd64")
else ifeq ($(OS),Linux)
	OS := linux
else ifeq ($(OS),Darwin)
	OS := darwin
endif

# Debug: Print detected OS and ARCH
#$(info Detected OS=$(OS))
#$(info Detected ARCH=$(ARCH))

export CGO_CFLAGS_ALLOW = -mfma|-mf16c
export CGO_CXXFLAGS_ALLOW = -mfma|-mf16c
export HIP_PLATFORM = amd
export CGO_ENABLED=1

# Utility definitions
comma := ,
empty :=
space := $(empty) $(empty)
uc = $(subst a,A,$(subst b,B,$(subst c,C,$(subst d,D,$(subst e,E,$(subst f,F,$(subst g,G,$(subst h,H,$(subst i,I,$(subst j,J,$(subst k,K,$(subst l,L,$(subst m,M,$(subst n,N,$(subst o,O,$(subst p,P,$(subst q,Q,$(subst r,R,$(subst s,S,$(subst t,T,$(subst u,U,$(subst v,V,$(subst w,W,$(subst x,X,$(subst y,Y,$(subst z,Z,$1)))))))))))))))))))))))))

# Debug: Print utility definitions
#$(info Utility definitions loaded: comma=$(comma), space=$(space))

# Directory definitions
SRC_DIR := $(strip $(realpath $(dir $(lastword $(MAKEFILE_LIST)))))
BUILD_DIR := $(SRC_DIR)/build/$(OS)-$(ARCH)
DIST_BASE := $(SRC_DIR)/dist/$(OS)-$(ARCH)
DIST_LIB_DIR := $(DIST_BASE)/lib/ollama
RUNNERS_BUILD_DIR := $(BUILD_DIR)/runners
RUNNERS_PAYLOAD_DIR := $(BUILD_DIR)/payload
RUNNERS_DIST_DIR = $(DIST_LIB_DIR)/runners

# Debug: Print directory paths
#$(info SRC_DIR=$(SRC_DIR))
#$(info BUILD_DIR=$(BUILD_DIR))
#$(info DIST_BASE=$(DIST_BASE))
#$(info DIST_LIB_DIR=$(DIST_LIB_DIR))
#$(info RUNNERS_BUILD_DIR=$(RUNNERS_BUILD_DIR))
#$(info RUNNERS_PAYLOAD_DIR=$(RUNNERS_PAYLOAD_DIR))

# Default runner
DEFAULT_RUNNER := $(if $(and $(filter darwin,$(OS)),$(filter arm64,$(ARCH))),metal,cpu)

# Debug: Print default runner
#$(info DEFAULT_RUNNER=$(DEFAULT_RUNNER))

# Compression utility
GZIP := $(shell command -v pigz 2>/dev/null || echo "gzip")

# Debug: Print compression utility
#$(info GZIP=$(GZIP))

# Detect ccache for builds
ifneq ($(OS),windows)
	CCACHE := $(shell command -v ccache 2>/dev/null || echo "")
endif

# Enable ccache if available
ifneq ($(CCACHE),)
	CC := $(CCACHE) gcc
	CXX := $(CCACHE) g++
	export CC
	export CXX
	$(info ccache detected: CC=$(CC), CXX=$(CXX))
endif

# GPU CPU flags
ifeq ($(ARCH),amd64)
	GPU_RUNNER_CPU_FLAGS ?= avx
endif

# Debug: Print GPU CPU flags
#$(info GPU_RUNNER_CPU_FLAGS=$(GPU_RUNNER_CPU_FLAGS))

# OS-specific settings
ifeq ($(OS),windows)
	CP := cp
	OBJ_EXT := obj
	SHARED_EXT := dll
	EXE_EXT := .exe
	SHARED_PREFIX := 
	CPU_FLAG_PREFIX := /arch:
ifneq ($(HIP_PATH),)
	# If HIP_PATH has spaces, adjust it
	HIP_PATH := $(shell cygpath -m -s "$(HIP_PATH)")
	export HIP_PATH
	$(info Adjusted HIP_PATH=$(HIP_PATH))
endif
else ifeq ($(OS),linux)
	CP := cp -af
	OBJ_EXT := o
	SHARED_EXT := so
	SHARED_PREFIX := lib
	CPU_FLAG_PREFIX := -m
	HIP_PATH ?= /opt/rocm
else
	OBJ_EXT := o
	SHARED_EXT := so
	CPU_FLAG_PREFIX := -m
	CP := cp -af
endif

# Debug: Print OS-specific settings
#$(info CP=$(CP))
#$(info OBJ_EXT=$(OBJ_EXT))
#$(info SHARED_EXT=$(SHARED_EXT))
#$(info EXE_EXT=$(EXE_EXT))
#$(info CPU_FLAG_PREFIX=$(CPU_FLAG_PREFIX))

# Common sources and headers
COMMON_SRCS := $(wildcard *.c) $(wildcard *.cpp)
COMMON_HDRS := $(wildcard *.h) $(wildcard *.hpp)

# Debug: Print common sources and headers
# $(info COMMON_SRCS=$(COMMON_SRCS))
# $(info COMMON_HDRS=$(COMMON_HDRS))
