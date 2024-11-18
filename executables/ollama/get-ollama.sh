#!/bin/sh

# Navigate two directories up
cd .. || { echo "Failed to navigate two directories up"; exit 1; }

pwd

# Folder to check
TARGET_FOLDER="ollama-0.4.2"

# Check if the folder exists
if [ -d "$TARGET_FOLDER" ]; then
    echo "Folder '$TARGET_FOLDER' exists. Proceeding with commands..."
else
    echo "Folder '$TARGET_FOLDER' does not exist. Exiting..."
    exit 1
fi


cd "$TARGET_FOLDER" || { echo "Failed to navigate to folder '$TARGET_FOLDER'"; exit 1; }

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
