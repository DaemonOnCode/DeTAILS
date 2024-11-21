#!/bin/sh
CURRENT_DIR=$(pwd)

# Navigate two directories up
cd .. || { echo "Failed to navigate two directories up"; exit 1; }


# Folder to check
TARGET_FOLDER="chroma"

# Check if the folder exists
if [ -d "$TARGET_FOLDER" ]; then
    echo "Folder '$TARGET_FOLDER' exists. Proceeding with commands..."
else
    echo "Folder '$TARGET_FOLDER' does not exist. Exiting..."
    exit 1
fi

cd "$TARGET_FOLDER/chromadb/cli" || { echo "Failed to navigate to folder '$TARGET_FOLDER'"; exit 1; }

if [ -d "dist" ]; then
    echo "Folder 'dist' exists. Proceeding with commands..."
    cp -r dist/* ../../../executables/chroma/
else
    echo "Folder 'dist' does not exist. Exiting..."
    exit 1
fi

cd "$CURRENT_DIR" || { echo "Failed to navigate to folder '$CURRENT_DIR'"; exit 1; }

echo "Deleting chroma-data folder..."
rm -r ../chroma-data