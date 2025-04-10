#!/bin/bash
export PATH="$PATH:/c/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.43.34808/bin/Hostx64/x64"
export CGO_ENABLED=1
make -j 8
go build -v -x .
echo $?
sleep 10