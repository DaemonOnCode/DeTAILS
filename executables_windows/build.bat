@echo off
REM Going to the root directory
echo Going to the root directory
cd ..
echo Current directory: %cd%

REM macOS-specific step (skipped on Windows)
echo Not running on macOS. Skipping dot_clean.

REM Cleanup executables directory if it exists
if exist "executables\" (
    echo executables directory exists
    cd executables
    echo Cleaning up previous builds

    REM Cleaning Chromadb
    if exist "chroma_data\" (
        rmdir /s /q chroma_data
    )
    if exist "chroma\" (
        cd chroma
        if exist "chroma_data\" rmdir /s /q chroma_data
        if exist "cli" del /f /q cli
        cd ..
    )
    echo Cleaned Chromadb

    REM Cleaning ollama
    if exist "ollama\" (
        rmdir /s /q ollama
    )
    echo Cleaned ollama

    REM Cleaning backend server
    if exist "data-modeling-server\" (
        cd data-modeling-server
        if exist "main" del /f /q main
        if exist "datasets\" rmdir /s /q datasets
        if exist "uploaded_jsons\" rmdir /s /q uploaded_jsons
        del /f /q *.db
        cd ..
    )
    echo Cleaned backend server
    cd ..
) else (
    echo executables directory does not exist
    mkdir executables
)

REM Build ripgrep
echo Entering ripgrep
cd ripgrep
echo Building ripgrep
cargo build --release --features "pcre2"
echo Copying the built ripgrep
if not exist "..\executables\ripgrep" mkdir "..\executables\ripgrep"
copy /Y "target\release\rg.exe" "..\executables\ripgrep\"
echo Exiting ripgrep
cd ..
echo Ripgrep built successfully

REM Build zstd
echo Entering zstd
cd zstd
echo Building zstd
make
echo Copying the built zstd
if not exist "..\executables\zstd" mkdir "..\executables\zstd"
copy /Y "programs\zstd.exe" "..\executables\zstd\"
copy /Y "programs\zstdgrep.exe" "..\executables\zstd\"
copy /Y "programs\zstdless.exe" "..\executables\zstd\"
echo Exiting zstd
cd ..
echo Zstd built successfully

REM Build the backend
echo Entering the backend
cd data-modeling-server
echo Removing the old build
if exist "dist\" rmdir /s /q dist
if exist "build\" rmdir /s /q build
echo Setting environment
REM Activate the virtual environment
call .\winenv\Scripts\activate
echo Building the backend
pyinstaller main.spec
echo Copying the built backend
if not exist "..\executables\data-modeling-server" mkdir "..\executables\data-modeling-server"
xcopy /E /I /Y "dist\main" "..\executables\data-modeling-server\"
REM copy /Y ".env" "..\executables\data-modeling-server\"
echo Deactivating the environment
call deactivate
echo Exiting the backend
cd ..
echo Backend built successfully

REM Build the log-viewer
echo Entering log-viewer
cd log-viewer
echo Building the log-viewer
REM Set environment variable for this command
set REACT_APP_ROUTER=hash
npm run build
echo Copying the built log-viewer
if not exist "..\executables\log-viewer" mkdir "..\executables\log-viewer"
xcopy /E /I /Y "build" "..\executables\log-viewer\"
echo Exiting log-viewer
cd ..
echo Log-viewer built successfully

REM Build ollama
echo Entering ollama
cd ollama-0.4.2
echo Building ollama
call scripts\build.bat 0.4.2
echo Copying the built ollama
if not exist "..\executables\ollama" mkdir "..\executables\ollama"
copy /Y ".env" "..\executables\ollama\"
copy /Y "ollama.exe" "..\executables\ollama\"
if exist "dist\" (
    echo Folder 'dist' exists. Proceeding with commands...
    xcopy /E /I /Y "dist\*.*" "..\executables\ollama\"
    if not exist "..\executables\ollama\lib\ollama" mkdir "..\executables\ollama\lib\ollama"
    xcopy /E /I /Y "llama\make\build\win64\*.*" "..\executables\ollama\lib\ollama\"
) else (
    echo Folder 'dist' does not exist. Exiting...
    exit /b 1
)
echo Exiting ollama
cd ..
echo Ollama built successfully

REM Build chromadb
echo Entering chroma
cd chroma
echo Setting environment
call winenv\Scripts\activate
echo Building chromadb
cd chromadb\cli
pyinstaller cli.spec
echo Copying the built chromadb
if not exist "..\..\..\executables\chroma" mkdir "..\..\..\executables\chroma"
xcopy /E /I /Y "dist\cli" "..\..\..\executables\chroma\"
echo Deactivating the environment
call deactivate
echo Exiting chromadb
cd ..
echo Chromadb built successfully
