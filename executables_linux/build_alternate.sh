#!/bin/bash

if [ $# -lt 2 ]; then
    echo "Error: Please provide the path to abc_env as the first argument and the destination path as the second argument."
    exit 1
fi

if ! ABC_ENV_PATH=$(cd "$1" && pwd); then
    echo "Error: Provided path $1 does not exist or is not a directory."
    exit 1
fi

if ! DEST_PATH=$(cd "$2" && pwd); then
    echo "Error: Destination path $2 does not exist or is not a directory."
    exit 1
fi

echo "Going to the root directory"
cd ..
echo "Current directory: $(pwd)"

ROOT_DIR=$(pwd)
EXEC_DIR=$ROOT_DIR/executables_linux

if [ -d "$EXEC_DIR" ]; then
    echo "executables_linux directory exists"
    cd "$EXEC_DIR" || exit
    echo "Cleaning up previous builds"
    
    echo "Cleaning Chromadb"
    rm -rf ./chroma_data
    cd ./chroma || exit
    rm -rf chroma_data
    rm -rf cli
    cd ..
    echo "Cleaned Chromadb"
    
    echo "Cleaning ollama"
    rm -rf ./ollama
    echo "Cleaned ollama"
    
    echo "Cleaning backend server"
    cd data-modeling-server || exit
    rm -rf main
    rm -rf datasets
    rm -rf uploaded_jsons
    rm -f *.db
    cd ..
    echo "Cleaned backend server"
    
    cd "$ROOT_DIR" || exit
else
    echo "executables_linux directory does not exist"
    mkdir "$EXEC_DIR"
fi


build_ripgrep() {
    echo "Entering ripgrep"
    cd "$ROOT_DIR/backend/ripgrep" || exit
    echo "Building ripgrep"
    cargo build --release --features 'pcre2'
    echo "Copying the built ripgrep"
    mkdir -p "$EXEC_DIR/ripgrep"
    cp ./target/release/rg "$EXEC_DIR/ripgrep/"
    echo "Exiting ripgrep"
    echo "Ripgrep built successfully"
}

build_zstd() {
    echo "Entering zstd"
    if [ ! -d "$ABC_ENV_PATH/zstd_tmp/zstd" ]; then
        echo "Error: zstd directory does not exist at $ABC_ENV_PATH/zstd_tmp/zstd"
        exit 1
    fi
    cd "$ABC_ENV_PATH/zstd_tmp/zstd" || exit
    echo "Building zstd"
    make
    echo "Copying the built zstd"
    mkdir -p "$EXEC_DIR/zstd"
    cp ./programs/zstd "$EXEC_DIR/zstd/"
    cp ./programs/zstdgrep "$EXEC_DIR/zstd/"
    cp ./programs/zstdless "$EXEC_DIR/zstd/"
    echo "Exiting zstd"
    echo "Zstd built successfully"
}

build_backend() {
    echo "Entering the backend"
    if [ ! -f "$ABC_ENV_PATH/dms_env/linenv/bin/activate" ]; then
        echo "Error: dms_env virtual environment does not exist at $ABC_ENV_PATH/dms_env/linenv/bin/activate"
        exit 1
    fi
    source "$ABC_ENV_PATH/dms_env/linenv/bin/activate"
    cd "$ROOT_DIR/backend/data_modeling_server" || exit
    echo "Removing the old buildup"
    rm -rf ./dist
    rm -rf ./build
    echo "Building the backend"
    python3 -m PyInstaller main.spec
    echo "Copying the built backend"
    mkdir -p "$EXEC_DIR/data-modeling-server"
    cp -r ./dist/main "$EXEC_DIR/data-modeling-server/"
    echo "Deactivating the environment"
    deactivate
    echo "Exiting the backend"
    echo "Backend built successfully"
}

build_ollama() {
    echo "Entering ollama"
    cd "$ROOT_DIR/backend/ollama-0.4.2" || exit
    echo "Building ollama"
    make -j 8
    go build -v -x .
    echo "Copying the built ollama"
    mkdir -p "$EXEC_DIR/ollama/"
    cp .env "$EXEC_DIR/ollama/"
    cp ./ollama "$EXEC_DIR/ollama/"
    if [ -d "dist" ]; then
        echo "Folder 'dist' exists. Proceeding with commands..."
        cp -r dist/* "$EXEC_DIR/ollama/"
    else
        echo "Folder 'dist' does not exist. Exiting..."
        exit 1
    fi
    echo "Exiting ollama"
    echo "Ollama built successfully"
}

build_chromadb() {
    echo "Entering chromadb"
    if [ ! -f "$ABC_ENV_PATH/chroma_env/linenv/bin/activate" ]; then
        echo "Error: chroma_env virtual environment does not exist at $ABC_ENV_PATH/chroma_env/linenv/bin/activate"
        exit 1
    fi
    source "$ABC_ENV_PATH/chroma_env/linenv/bin/activate"
    cd "$ROOT_DIR/backend/chroma/chromadb/cli" || exit
    echo "Building chromadb"
    python3 -m PyInstaller cli.spec
    echo "Copying the built chromadb"
    mkdir -p "$EXEC_DIR/chroma"
    cp -r dist/cli "$EXEC_DIR/chroma/"
    echo "Deactivating the environment"
    deactivate
    echo "Exiting chromadb"
    echo "Chromadb built successfully"
}

echo "Starting parallel builds..."
build_ripgrep &
build_zstd &
build_backend &
build_ollama &
build_chromadb &

wait

echo "All builds completed"

echo "Copying executables_linux to $DEST_PATH"
cp -r "$EXEC_DIR" "$DEST_PATH"
echo "Copy completed"
