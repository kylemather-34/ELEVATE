# Step 1: Build the backend
Write-Host "Building backend..."
cd build

if (-not (Test-Path "CMakeCache.txt")) {
    cmake ..
}

cmake --build .

# Launch the backend server (non-blocking)
Start-Process .\Debug\elevate_backend.exe
cd ..

# Step 2: Launch the VS Code extension
Write-Host "Launching ELEVATE extension in VS Code..."

# Set environment variable so the extension auto-opens the webview
$env:ELEVATE_AUTO = '1'

# Open VS Code in a new window for the elv folder
Start-Process code -ArgumentList @('elv', '--new-window')