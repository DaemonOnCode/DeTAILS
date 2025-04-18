#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Clean up previous builds
if [ -d "./executables_linux" ]; then
    echo "executables directory exists"
    cd executables_linux
    echo "Cleaning up previous builds"
    echo "Cleaning Chromadb"
    rm -rf ./chroma_data
    cd ./chroma
    rm -rf chroma_data
    rm cli
    cd ..
    echo "Cleaned Chromadb"
    echo "Cleaning ollama"
    # cd ollama
    # cd ..
    rm -rf ./ollama
    echo "Cleaned ollama"
    echo "Cleaning backend server"
    cd data-modeling-server
    rm ./main
    rm -rf datasets
    rm -rf uploaded_jsons
    rm -f *.db
    cd ..
    echo "Cleaned backend server"
    cd ..
else
    echo "executables directory does not exist"
    mkdir executables_linux
fi

# Build functions
build_ripgrep() {
  echo "ripgrep Starting…"
  cd "$PROJECT_ROOT/backend/ripgrep"
  cargo build --release --features 'pcre2'
  mkdir -p "$PROJECT_ROOT/executables/ripgrep"
  cp target/release/rg "$PROJECT_ROOT/executables/ripgrep/"
  echo "ripgrep Done."
}

build_zstd() {
  echo "zstd Starting…"
  cd "$PROJECT_ROOT/backend/zstd"
  make
  mkdir -p "$PROJECT_ROOT/executables/zstd"
  cp programs/{zstd,zstdgrep,zstdless} "$PROJECT_ROOT/executables/zstd/"
  echo "zstd Done."
}

build_backend() {
  echo "main server Starting…"
  cd "$PROJECT_ROOT/backend/data_modeling_server"
  rm -rf dist build
  source ./linenv/bin/activate
  pyinstaller main.spec
  deactivate
  mkdir -p "$PROJECT_ROOT/executables/data-modeling-server"
  cp dist/main "$PROJECT_ROOT/executables/data-modeling-server/"
  echo "main server Done."
}

build_ollama() {
  echo "ollama Starting…"
  cd "$PROJECT_ROOT/backend/ollama-0.4.2"
  make -j 8
  go build -v -x .
  mkdir -p "$PROJECT_ROOT/executables/ollama"
  cp .env ollama "$PROJECT_ROOT/executables/ollama/"
  if [ -d dist ]; then
    cp -r dist/* "$PROJECT_ROOT/executables/ollama/"
    mkdir -p "$PROJECT_ROOT/executables/ollama/lib/ollama"
    cp -r llama/make/build/linux/* "$PROJECT_ROOT/executables/ollama/lib/ollama/"
  else
    echo "ollama ERROR: dist folder missing!"
    exit 1
  fi
  echo "ollama Done."
}

build_chroma() {
  echo "chromadb Starting…"
  cd "$PROJECT_ROOT/backend/chroma"
  source ./linenv/bin/activate
  cd chromadb/cli
  pyinstaller cli.spec
  deactivate
  mkdir -p "$PROJECT_ROOT/executables/chroma"
  cp -r dist/cli "$PROJECT_ROOT/executables/chroma/"
  echo "chromadb Done."
}

build_ripgrep &
build_zstd &
build_backend &
build_ollama &
build_chroma &

wait

echo "All builds completed. Executables are in $PROJECT_ROOT/executables."
