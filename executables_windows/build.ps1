$startDir = $PWD.Path
Write-Host "Starting directory: $startDir"

function Invoke-ComponentBuild {
    param (
        [string]$componentName,
        [string]$folderName,
        [string]$buildCommands,
        [string]$artifactPath,
        [string]$destSubDir
    )

    try {
        Write-Host "Navigating to the root directory..."
        Set-Location -Path ".." -ErrorAction Stop
        Write-Host "Current directory: $(Get-Location)"

        Write-Host "Entering the $folderName folder..."
        if (-not (Test-Path -Path ".\backend\$folderName")) {
            throw "The 'backend/$folderName' folder does not exist in the root directory."
        }
        Set-Location -Path ".\backend\$folderName" -ErrorAction Stop
        Write-Host "Current directory: $(Get-Location)"

        # Activate environment if needed
        if ($componentName -eq "backend" -or $componentName -eq "chromadb") {
            Write-Host "Activating the winenv environment..."
            if (-not (Test-Path -Path ".\winenv\Scripts\Activate.ps1")) {
                throw "The 'winenv' environment does not exist or is missing the activation script."
            }
            & ".\winenv\Scripts\Activate.ps1"
            Write-Host "Environment activated."
        }

        # Component-specific build steps
        if ($componentName -eq "zstd") {
            Set-Location -Path "build\cmake"
            if (Test-Path -Path "builddir") {
                Write-Host "Removing existing builddir..."
                Remove-Item -Path "builddir" -Recurse -Force
            }
            Write-Host "Creating new builddir..."
            New-Item -ItemType Directory -Path "builddir"
            Set-Location -Path "builddir"
        } elseif ($componentName -eq "chromadb") {
            Set-Location -Path "chromadb\cli"
        }

        # Remove stale build outputs before building:
        if ($componentName -eq "backend") {
            Write-Host "Cleaning previous backend dist/build folders..."
            Remove-Item -Path ".\dist" -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item -Path ".\build" -Recurse -Force -ErrorAction SilentlyContinue
        }
        elseif ($componentName -eq "chromadb") {
            Write-Host "Cleaning previous chromadb CLI artifact (only cli.exe)..."
            Remove-Item -Path ".\dist\cli.exe" -Force -ErrorAction SilentlyContinue
        }

        # Execute build commands
        Write-Host "Building $componentName..."
        if ($componentName -eq "ollama") {
            # Use Start-Process with -Wait for ollama to ensure the build completes
            $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $buildCommands -WorkingDirectory (Get-Location) -NoNewWindow -Wait -PassThru
            if ($process.ExitCode -ne 0) {
                throw "$componentName build failed with exit code $($process.ExitCode)."
            }
        } else {
            # Use Invoke-Expression for all other components
            Invoke-Expression $buildCommands
            if ($LASTEXITCODE -ne 0) {
                throw "$componentName build failed with exit code $LASTEXITCODE."
            }
        }
        Write-Host "$componentName built successfully."

        # Deactivate environment if activated
        if ($componentName -eq "backend" -or $componentName -eq "chromadb") {
            Write-Host "Deactivating the environment..."
            deactivate
        }

        Write-Host "Copying built artifacts to $startDir\$destSubDir..."
        $destPath = Join-Path -Path $startDir -ChildPath $destSubDir
        if (-not (Test-Path -Path $destPath)) {
            New-Item -ItemType Directory -Path $destPath -Force | Out-Null
            Write-Host "Created destination directory: $destPath"
        }
        if (-not (Test-Path -Path $artifactPath)) {
            throw "Build output '$artifactPath' was not found. Build may have failed."
        }
        Copy-Item -Path $artifactPath -Destination $destPath -Force -ErrorAction Stop
        Write-Host "Copied '$artifactPath' to $destPath"

        # Copy .env for backend
        if ($componentName -eq "backend" -and (Test-Path -Path ".env")) {
            Copy-Item -Path ".env" -Destination $destPath -Force -ErrorAction Stop
            Write-Host "Copied '.env' to $destPath"
        }

        Write-Host "Returning to the starting directory..."
        Set-Location -Path $startDir -ErrorAction Stop
        Write-Host "Current directory: $(Get-Location)"

        Write-Host "$componentName Build and copy completed successfully."
    }
    catch {
        Write-Error "An error occurred while building ${componentName}: $_"
        if ($componentName -eq "backend" -or $componentName -eq "chromadb") {
            if (Get-Command deactivate -ErrorAction SilentlyContinue) {
                deactivate
            }
        }
        Set-Location -Path $startDir -ErrorAction SilentlyContinue
        exit 1
    }
}

# Build ripgrep
Invoke-ComponentBuild -componentName "ripgrep" -folderName "ripgrep" -buildCommands "cargo build --release --features 'pcre2'" -artifactPath "target\release\rg.exe" -destSubDir "ripgrep"

# Build zstd
Invoke-ComponentBuild -componentName "zstd" -folderName "zstd" -buildCommands "cmake -G 'MinGW Makefiles' .. ; make" -artifactPath "programs\zstd.exe" -destSubDir "zstd"

# Build backend
Invoke-ComponentBuild -componentName "backend" -folderName "data_modeling_server" -buildCommands "python -m PyInstaller main.spec" -artifactPath "dist\main.exe" -destSubDir "data-modeling-server"

# Build chromadb
Invoke-ComponentBuild -componentName "chromadb" -folderName "chroma" -buildCommands "python -m PyInstaller cli.spec" -artifactPath "dist\cli.exe" -destSubDir "chroma"

# Build ollama
$ollamaFolder = "ollama-0.4.2"
$buildCommands = "set CGO_ENABLED=1 && make -j 8 && go build -v -x . && echo %ERRORLEVEL% && timeout /T 10 /NOBREAK"
Invoke-ComponentBuild -componentName "ollama" -folderName $ollamaFolder -buildCommands $buildCommands -artifactPath "ollama.exe" -destSubDir "ollama"
