echo "Going to the root directory"
cd ..
echo "Current directory: $(pwd)"

if [ -d "./executables" ]; then
    echo "executables directory exists"
else
    echo "executables directory does not exist"
    mkdir executables
fi

# Build the backend
echo "Entering the backend"
cd ./data-modeling-server
echo "Setting environment"
source ./env/bin/activate
echo "Building the backend"
pyinstaller main.spec
echo "Copying the built backend"
mkdir -p ../executables/data-modeling-server
cp -r ./dist/main ../executables/data-modeling-server/
echo "Deactivating the environment"
deactivate
echo "Exiting the backend"
cd ..
echo "Backend built sucessfully"

# Build the log-viewer
echo "Entering log-viewer"
cd ./log-viewer
echo "Building the log-viewer"
REACT_APP_ROUTER=hash npm run build
echo "Copying the built log-viewer"
cp -r ./build ../executables/log-viewer
echo "Exiting log-viewer"
cd ..
echo "Log-viewer built sucessfully"


# Build ollama
echo "Entering ollama"
cd ./ollama-0.4.2
echo "Building ollama"
./scripts/build.sh 0.4.2
echo "Copying the built ollama"
cp .env ../executables/ollama/

if [ -d "dist" ]; then
    echo "Folder 'dist' exists. Proceeding with commands..."
    cp -r dist/* ../executables/ollama/

    mkdir -p ../executables/ollama/lib/ollama
    cp -r llama/make/build/darwin-arm64/* ../executables/ollama/lib/ollama
else
    echo "Folder 'dist' does not exist. Exiting..."
    exit 1
fi
echo "Exiting ollama"
cd ..
echo "Ollama built sucessfully"


# Build chromadb
echo "Entering chromadb"
cd ./chroma
echo "Setting environment"
source ./env/bin/activate
echo "Building chromadb"
cd ./chromadb/cli
pyinstaller cli.spec
echo "Copying the built chromadb"
cp -r ./dist/cli ../../../executables/chroma/
echo "Deactivating the environment"
deactivate
echo "Exiting chromadb"
cd ..
echo "Chromadb built sucessfully"
