#!/bin/sh

set -e

. $(dirname $0)/env.sh

mkdir -p dist

# These require Xcode v13 or older to target MacOS v11
# If installed to an alternate location use the following to enable
# export SDKROOT=/Applications/Xcode_12.5.1.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk
# export DEVELOPER_DIR=/Applications/Xcode_12.5.1.app/Contents/Developer
export CGO_CFLAGS=-mmacosx-version-min=11.3
export CGO_CXXFLAGS=-mmacosx-version-min=11.3
export CGO_LDFLAGS=-mmacosx-version-min=11.3

for TARGETARCH in arm64 amd64; do
    echo "Building Go runner darwin $TARGETARCH"
    rm -rf llama/build
    echo "Building llama darwin $TARGETARCH"
    GOOS=darwin ARCH=$TARGETARCH GOARCH=$TARGETARCH make -C llama -j 8
    echo "Building ollama darwin $TARGETARCH"
    GOMAXPROCS=$(sysctl -n hw.ncpu) CGO_ENABLED=1 GOOS=darwin GOARCH=$TARGETARCH go build -v -x -trimpath -o dist/ollama-darwin-$TARGETARCH
    echo "Building ollama darwin $TARGETARCH with coverage"
    GOMAXPROCS=$(sysctl -n hw.ncpu) CGO_ENABLED=1 GOOS=darwin GOARCH=$TARGETARCH go build -v -x -trimpath -cover -o dist/ollama-darwin-$TARGETARCH-cov
    echo "end $TARGETARCH"
done

lipo -create -output dist/ollama dist/ollama-darwin-arm64 dist/ollama-darwin-amd64
rm -f dist/ollama-darwin-arm64 dist/ollama-darwin-amd64
# if [ -n "$APPLE_IDENTITY" ]; then
#     codesign --deep --force --options=runtime --sign "$APPLE_IDENTITY" --timestamp dist/ollama
# else
#     echo "Skipping code signing - set APPLE_IDENTITY"
# fi
chmod +x dist/ollama

ditto -c -k --keepParent dist/ollama dist/temp.zip

mv dist/ollama dist/ollama-darwin
rm -f dist/temp.zip