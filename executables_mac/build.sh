trap cleanup INT TERM HUP

declare -a PIDS=()

# Cleanup function to handle signals
cleanup() {
  local signal=$1
  echo -e "\nCaught signal $signal! Cleaning up..."
  # Kill all background processes
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "Terminating process $pid..."
      kill -TERM "$pid" 2>/dev/null
    fi
  done
  echo "Cleanup complete. Exiting."
  exit 1
}

# Wrapper to call cleanup with the caught signal
handle_signal() {
  cleanup "$1"
}

# Trap signals and call cleanup function
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM
trap 'handle_signal HUP' HUP

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Clean up previous builds
if [ -d "./executables_mac" ]; then
    echo "executables directory exists"
    cd executables_mac
    echo "Cleaning up previous builds"
    echo "Cleaning Chromadb"
    rm -rf ./chroma_data
    cd ./chroma
    rm -rf chroma_data
    rm cli
    cd ..
    echo "Cleaned Chromadb"
    echo "Cleaning ollama"
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
    mkdir executables_mac
fi

# macOS dotfile cleanup
if [[ "$(uname)" == "Darwin" ]]; then
  echo "macOS detected → running dot_clean -m…"
  dot_clean -m "$PROJECT_ROOT"
fi

build_ripgrep() {
  echo "ripgrep Starting…"
  cd "$PROJECT_ROOT/backend/ripgrep"
  cargo build --release --features 'pcre2'
  mkdir -p "$PROJECT_ROOT/executables_mac/ripgrep"
  cp target/release/rg "$PROJECT_ROOT/executables_mac/ripgrep/"
  echo "ripgrep Done."
}

build_zstd() {
  echo "zstd Starting…"
  cd "$PROJECT_ROOT/backend/zstd"
  make clean
  make -j 8
  mkdir -p "$PROJECT_ROOT/executables_mac/zstd"
  cp programs/{zstd,zstdgrep,zstdless} "$PROJECT_ROOT/executables_mac/zstd/"
  echo "zstd Done."
}

build_backend() {
  echo "main server Starting…"
  cd "$PROJECT_ROOT/backend/data_modeling_server"
  rm -rf dist build
  source ./.venv/bin/activate
  pyinstaller main.spec
  deactivate
  mkdir -p "$PROJECT_ROOT/executables_mac/data-modeling-server"
  cp dist/main "$PROJECT_ROOT/executables_mac/data-modeling-server/"
  echo "main server Done."
}

build_ollama() {
  echo "ollama Starting…"
  cd "$PROJECT_ROOT/backend/ollama-0.4.2"
  ./scripts/build.sh 0.4.2
  mkdir -p "$PROJECT_ROOT/executables_mac/ollama"
  cp .env ollama "$PROJECT_ROOT/executables_mac/ollama/"
  if [ -d dist ]; then
    cp -r dist/* "$PROJECT_ROOT/executables_mac/ollama/"
    mkdir -p "$PROJECT_ROOT/executables_mac/ollama/lib/ollama"
    cp -r llama/make/build/darwin-arm64/* "$PROJECT_ROOT/executables_mac/ollama/lib/ollama/"
  else
    echo "ollama ERROR: dist folder missing!"
    exit 1
  fi
  echo "ollama Done."
}

build_chroma() {
  echo "chromadb Starting…"
  cd "$PROJECT_ROOT/backend/chroma"
  source ./env/bin/activate
  cd chromadb/cli
  pyinstaller cli.spec
  deactivate
  mkdir -p "$PROJECT_ROOT/executables_mac/chroma"
  cp -r dist/cli "$PROJECT_ROOT/executables_mac/chroma/"
  echo "chromadb Done."
}

build_ripgrep &
PIDS+=($!)
build_zstd &
PIDS+=($!)
build_backend &
PIDS+=($!)
build_ollama &
PIDS+=($!)
build_chroma &
PIDS+=($!)

wait

echo "All builds completed. Executables are in $PROJECT_ROOT/executables_mac."

trap - INT TERM HUP