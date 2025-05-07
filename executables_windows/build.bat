@echo off
setlocal

:: Capture the starting directory
set "startDir=%CD%"
echo Starting directory: %startDir%

:: Build ripgrep
echo Navigating to the root directory...
cd ..
if %ERRORLEVEL% neq 0 (
    echo Failed to navigate to the root directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Entering the ripgrep folder...
if not exist "backend\ripgrep\" (
    echo The 'ripgrep' folder does not exist in the root directory.
    goto :ERROR
)
cd backend\ripgrep
if %ERRORLEVEL% neq 0 (
    echo Failed to enter the ripgrep folder.
    goto :ERROR
)
echo Current directory: %CD%

echo Building ripgrep...
cargo build --release --features "pcre2"
if %ERRORLEVEL% neq 0 (
    echo Cargo build failed with exit code %ERRORLEVEL%.
    goto :ERROR
)
echo Ripgrep built successfully.

echo Copying built artifacts to %startDir%\ripgrep...
if not exist "%startDir%\ripgrep\" (
    mkdir "%startDir%\ripgrep"
    if %ERRORLEVEL% neq 0 (
        echo Failed to create directory %startDir%\ripgrep.
        goto :ERROR
    )
)
if not exist "target\release\rg.exe" (
    echo Build output 'target\release\rg.exe' was not found. Build may have failed.
    goto :ERROR
)
copy /Y "target\release\rg.exe" "%startDir%\ripgrep\"
if %ERRORLEVEL% neq 0 (
    echo Failed to copy 'target\release\rg.exe' to %startDir%\ripgrep.
    goto :ERROR
)
echo Copied 'target\release\rg.exe' to %startDir%\ripgrep

echo Returning to the starting directory...
cd "%startDir%"
if %ERRORLEVEL% neq 0 (
    echo Failed to return to the starting directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Ripgrep Build and copy completed successfully.

:: Build zstd
echo Navigating to the root directory...
cd ..
if %ERRORLEVEL% neq 0 (
    echo Failed to navigate to the root directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Entering the zstd folder...
if not exist "backend\zstd\" (
    echo The 'zstd' folder does not exist in the root directory.
    goto :ERROR
)
cd backend\zstd
if %ERRORLEVEL% neq 0 (
    echo Failed to enter the zstd folder.
    goto :ERROR
)
echo Current directory: %CD%

echo Building zstd...
cd build\cmake
if %ERRORLEVEL% neq 0 (
    echo Failed to enter build\cmake.
    goto :ERROR
)

if exist "builddir\" (
    echo Removing existing builddir...
    rmdir /s /q builddir
    if %ERRORLEVEL% neq 0 (
        echo Failed to remove existing builddir.
        goto :ERROR
    )
)
echo Creating new builddir...
mkdir builddir
if %ERRORLEVEL% neq 0 (
    echo Failed to create builddir.
    goto :ERROR
)

cd builddir
if %ERRORLEVEL% neq 0 (
    echo Failed to enter builddir.
    goto :ERROR
)

cmake -G "MinGW Makefiles" ..
if %ERRORLEVEL% neq 0 (
    echo cmake failed with exit code %ERRORLEVEL%.
    goto :ERROR
)

make
if %ERRORLEVEL% neq 0 (
    echo make failed with exit code %ERRORLEVEL%.
    goto :ERROR
)
echo Zstd built successfully.

echo Copying built artifacts to %startDir%\zstd...
if not exist "%startDir%\zstd\" (
    mkdir "%startDir%\zstd"
    if %ERRORLEVEL% neq 0 (
        echo Failed to create directory %startDir%\zstd.
        goto :ERROR
    )
)
if not exist "programs\zstd.exe" (
    echo Build output 'programs\zstd.exe' was not found. Build may have failed.
    goto :ERROR
)
copy /Y "programs\zstd.exe" "%startDir%\zstd\"
if %ERRORLEVEL% neq 0 (
    echo Failed to copy 'programs\zstd.exe' to %startDir%\zstd.
    goto :ERROR
)
echo Copied 'programs\zstd.exe' to %startDir%\zstd

echo Returning to the starting directory...
cd "%startDir%"
if %ERRORLEVEL% neq 0 (
    echo Failed to return to the starting directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Zstd Build and copy completed successfully.

:: Build backend
echo Navigating to the root directory...
cd ..
if %ERRORLEVEL% neq 0 (
    echo Failed to navigate to the root directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Entering the data-modeling-server folder...
if not exist "backend\data_modeling_server\" (
    echo The 'data-modeling-server' folder does not exist in the root directory.
    goto :ERROR
)
cd backend\data_modeling_server
if %ERRORLEVEL% neq 0 (
    echo Failed to enter the data-modeling-server folder.
    goto :ERROR
)
echo Current directory: %CD%

echo Activating the winenv environment...
if not exist "winenv\Scripts\activate.bat" (
    echo The 'winenv' environment does not exist or is missing the activation script.
    goto :ERROR
)
call winenv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo Failed to activate the winenv environment.
    goto :ERROR
)
echo Environment activated.

echo Removing existing dist and build folders...
if exist "dist\" (
    rmdir /s /q dist
    if %ERRORLEVEL% neq 0 (
        echo Failed to remove dist folder.
        goto :ERROR
    )
    echo Removed dist folder.
)
if exist "build\" (
    rmdir /s /q build
    if %ERRORLEVEL% neq 0 (
        echo Failed to remove build folder.
        goto :ERROR
    )
    echo Removed build folder.
)

echo Building the backend with PyInstaller...
if not exist "main.spec" (
    echo The 'main.spec' file is missing in the data-modeling-server folder.
    goto :ERROR
)
python -m PyInstaller main.spec
if %ERRORLEVEL% neq 0 (
    echo PyInstaller build failed with exit code %ERRORLEVEL%.
    goto :ERROR
)
echo Backend built successfully.

echo Deactivating the environment...
call deactivate
if %ERRORLEVEL% neq 0 (
    echo Failed to deactivate the environment.
    goto :ERROR
)

echo Copying built artifacts to %startDir%\data-modeling-server...
if not exist "%startDir%\data-modeling-server\" (
    mkdir "%startDir%\data-modeling-server"
    if %ERRORLEVEL% neq 0 (
        echo Failed to create directory %startDir%\data-modeling-server.
        goto :ERROR
    )
)
if not exist "dist\main.exe" (
    echo Build output 'dist\main.exe' was not found. Build may have failed.
    goto :ERROR
)
copy /Y "dist\main.exe" "%startDir%\data-modeling-server\"
if %ERRORLEVEL% neq 0 (
    echo Failed to copy 'dist\main.exe' to %startDir%\data-modeling-server.
    goto :ERROR
)
echo Copied 'dist\main.exe' to %startDir%\data-modeling-server

if exist ".env" (
    copy /Y ".env" "%startDir%\data-modeling-server\"
    if %ERRORLEVEL% neq 0 (
        echo Failed to copy '.env' to %startDir%\data-modeling-server.
        goto :ERROR
    )
    echo Copied '.env' to %startDir%\data-modeling-server
)

echo Returning to the starting directory...
cd "%startDir%"
if %ERRORLEVEL% neq 0 (
    echo Failed to return to the starting directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Backend Build and copy completed successfully.

:: Build chromadb
echo Navigating to the root directory...
cd ..
if %ERRORLEVEL% neq 0 (
    echo Failed to navigate to the root directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Entering the chromadb folder...
if not exist "backend\chroma\" (
    echo The 'chromadb' folder does not exist in the root directory.
    goto :ERROR
)
cd backend\chroma
if %ERRORLEVEL% neq 0 (
    echo Failed to enter the chromadb folder.
    goto :ERROR
)
echo Current directory: %CD%

echo Activating the winenv environment...
if not exist "winenv\Scripts\activate.bat" (
    echo The 'winenv' environment does not exist or is missing the activation script.
    goto :ERROR
)
call winenv\Scripts\activate.bat
if %ERRORLEVEL% neq 0 (
    echo Failed to activate the winenv environment.
    goto :ERROR
)
echo Environment activated.

cd chromadb\cli
if %ERRORLEVEL% neq 0 (
    echo Failed to enter chromadb\cli.
    goto :ERROR
)
echo Building chromadb with PyInstaller...
if not exist "cli.spec" (
    echo The 'cli.spec' file is missing in the cli folder.
    goto :ERROR
)
python -m PyInstaller cli.spec
if %ERRORLEVEL% neq 0 (
    echo PyInstaller build failed with exit code %ERRORLEVEL%.
    goto :ERROR
)
echo Chromadb cli built successfully.

echo Deactivating the environment...
call deactivate
if %ERRORLEVEL% neq 0 (
    echo Failed to deactivate the environment.
    goto :ERROR
)

echo Copying built artifacts to %startDir%\chromadb...
if not exist "%startDir%\chroma\" (
    mkdir "%startDir%\chroma"
    if %ERRORLEVEL% neq 0 (
        echo Failed to create directory %startDir%\chroma.
        goto :ERROR
    )
)
if not exist "dist\cli.exe" (
    echo Build output 'dist\cli.exe' was not found. Build may have failed.
    goto :ERROR
)
copy /Y "dist\cli.exe" "%startDir%\chroma\"
if %ERRORLEVEL% neq 0 (
    echo Failed to copy 'dist\cli.exe' to %startDir%\chroma.
    goto :ERROR
)
echo Copied 'dist\cli.exe' to %startDir%\chroma

echo Returning to the starting directory...
cd "%startDir%"
if %ERRORLEVEL% neq 0 (
    echo Failed to return to the starting directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Chromadb Build and copy completed successfully.

:: Build ollama
echo Navigating to the root directory...
cd ..
if %ERRORLEVEL% neq 0 (
    echo Failed to navigate to the root directory.
    goto :ERROR
)
echo Current directory: %CD%

set "ollamaFolder=ollama-0.4.2"
echo Entering the %ollamaFolder% folder...
if not exist "%ollamaFolder%\" (
    echo The '%ollamaFolder%' folder does not exist in the root directory.
    goto :ERROR
)
cd "%ollamaFolder%"
if %ERRORLEVEL% neq 0 (
    echo Failed to enter the %ollamaFolder% folder.
    goto :ERROR
)
echo Current directory: %CD%

echo Building ollama...
set CGO_ENABLED=1
make -j 8
if %ERRORLEVEL% neq 0 (
    echo make failed with exit code %ERRORLEVEL%.
    goto :ERROR
)
go build -v -x .
if %ERRORLEVEL% neq 0 (
    echo go build failed with exit code %ERRORLEVEL%.
    goto :ERROR
)
timeout /T 10 /NOBREAK

echo Copying built artifacts to %startDir%\ollama...
if not exist "%startDir%\ollama\" (
    mkdir "%startDir%\ollama"
    if %ERRORLEVEL% neq 0 (
        echo Failed to create directory %startDir%\ollama.
        goto :ERROR
    )
)
if not exist "ollama.exe" (
    echo 'ollama.exe' not found. Build may have failed.
    goto :ERROR
)
copy /Y "ollama.exe" "%startDir%\ollama\"
if %ERRORLEVEL% neq 0 (
    echo Failed to copy 'ollama.exe' to %startDir%\ollama.
    goto :ERROR
)
if exist ".env" copy /Y ".env" "%startDir%\ollama\"

echo Returning to the starting directory...
cd "%startDir%"
if %ERRORLEVEL% neq 0 (
    echo Failed to return to the starting directory.
    goto :ERROR
)
echo Current directory: %CD%

echo Ollama Build and copy completed successfully.

echo All builds and copies completed successfully.
exit /b 0

:ERROR
echo An error occurred with exit code %ERRORLEVEL%.

if defined VIRTUAL_ENV (
    call deactivate 2>nul
)

if exist "%startDir%\" (
    cd "%startDir%" 2>nul
)
exit /b 1