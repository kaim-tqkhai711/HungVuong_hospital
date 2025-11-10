# Deployment Script - Hungvuong Partogram System

param(
    [Parameter(Position=0)]
    [ValidateSet('development', 'production')]
    [string]$DeployEnv = 'development'
)

$BackendDir = "backend"
$FrontendDir = "frontend"
$BackendPort = 5000
$FrontendPort = 3000

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Hungvuong Partogram System" -ForegroundColor Cyan
Write-Host "Deployment Mode: $DeployEnv" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Checking prerequisites..." -ForegroundColor Cyan

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

$pythonVersion = & python --version 2>&1
Write-Host "Python found: $pythonVersion" -ForegroundColor Green

$pipCmd = Get-Command pip -ErrorAction SilentlyContinue
if (-not $pipCmd) {
    Write-Host "ERROR: pip is not installed" -ForegroundColor Red
    exit 1
}
Write-Host "pip found" -ForegroundColor Green

$versionOutput = & python -c "import sys; print('.'.join(map(str, sys.version_info[:2])))"
$versionNum = [version]$versionOutput
$requiredVersion = [version]"3.8"

if ($versionNum -lt $requiredVersion) {
    Write-Host "ERROR: Python version must be 3.8 or higher. Current: $versionOutput" -ForegroundColor Red
    exit 1
}
Write-Host "Python version $versionOutput is compatible" -ForegroundColor Green

Write-Host ""
Write-Host "========== Backend Deployment ==========" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BackendDir)) {
    Write-Host "ERROR: Backend directory not found: $BackendDir" -ForegroundColor Red
    exit 1
}

Push-Location $BackendDir

try {
    if (-not (Test-Path "venv")) {
        Write-Host "Creating virtual environment..." -ForegroundColor Cyan
        & python -m venv venv
        Write-Host "Virtual environment created" -ForegroundColor Green
    } else {
        Write-Host "Virtual environment already exists" -ForegroundColor Green
    }

    Write-Host "Using virtual environment..." -ForegroundColor Cyan

    Write-Host "Upgrading pip..." -ForegroundColor Cyan
    & venv\Scripts\python.exe -m pip install --upgrade pip --quiet
    Write-Host "pip upgraded" -ForegroundColor Green

    Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
    & venv\Scripts\pip.exe install -r requirements.txt --quiet
    Write-Host "Dependencies installed" -ForegroundColor Green

    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Host "Creating .env file from .env.example..." -ForegroundColor Cyan
            Copy-Item .env.example .env
            Write-Host "WARNING: Please update .env file" -ForegroundColor Yellow
        } else {
            Write-Host "Creating default .env file..." -ForegroundColor Cyan
            $secretKey = -join ((48..57) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
            $envContent = "FLASK_ENV=$DeployEnv`nFLASK_DEBUG=$(if ($DeployEnv -eq 'development') { '1' } else { '0' })`nDATABASE_URL=sqlite:///partogram.db`nSECRET_KEY=$secretKey`nCORS_ORIGINS=http://localhost:$FrontendPort"
            $envContent | Out-File -FilePath .env -Encoding utf8
            Write-Host ".env file created" -ForegroundColor Green
        }
    } else {
        Write-Host ".env file already exists" -ForegroundColor Green
    }

    Write-Host "Setting up database..." -ForegroundColor Cyan
    $env:FLASK_APP = "app.py"

    if (-not (Test-Path "migrations")) {
        Write-Host "Initializing database migrations..." -ForegroundColor Cyan
        & venv\Scripts\flask.exe db init
        Write-Host "Database migrations initialized" -ForegroundColor Green
    }

    Write-Host "Running database migrations..." -ForegroundColor Cyan
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    try {
        & venv\Scripts\flask.exe db migrate -m "Deployment migration $timestamp" 2>&1 | Out-Null
    } catch {}
    & venv\Scripts\flask.exe db upgrade
    Write-Host "Database migrations applied" -ForegroundColor Green

    if ($DeployEnv -eq 'development') {
        $response = Read-Host "Do you want to seed the database with sample data? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Write-Host "Seeding database..." -ForegroundColor Cyan
            try {
                & venv\Scripts\flask.exe seed_db
                Write-Host "Database seeded" -ForegroundColor Green
            } catch {
                Write-Host "WARNING: Seed command not available" -ForegroundColor Yellow
            }
        }
    }

} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========== Frontend Deployment ==========" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $FrontendDir)) {
    Write-Host "ERROR: Frontend directory not found: $FrontendDir" -ForegroundColor Red
    exit 1
}

Write-Host "Frontend files verified" -ForegroundColor Green

if ($DeployEnv -eq 'production') {
    Write-Host ""
    Write-Host "========== Production Setup ==========" -ForegroundColor Cyan
    Write-Host ""
    Push-Location $BackendDir
    try {
        Write-Host "Installing waitress..." -ForegroundColor Cyan
        & venv\Scripts\pip.exe install waitress --quiet
        Write-Host "Waitress installed" -ForegroundColor Green
        
        if (-not (Test-Path "run_production.py")) {
            $prodScript = "from waitress import serve`nfrom app import app`nimport os`n`nif __name__ == '__main__':`n    port = int(os.environ.get('PORT', 5000))`n    print(f'Starting production server on port {port}...')`n    serve(app, host='0.0.0.0', port=port, threads=4)"
            $prodScript | Out-File -FilePath run_production.py -Encoding utf8
            Write-Host "Production server script created" -ForegroundColor Green
        }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Deployment completed!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($DeployEnv -eq 'development') {
    Write-Host "To start the servers:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Terminal 1 (Backend):" -ForegroundColor Cyan
    Write-Host "  cd $BackendDir" -ForegroundColor Yellow
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "  python app.py" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Terminal 2 (Frontend):" -ForegroundColor Cyan
    Write-Host "  cd $FrontendDir" -ForegroundColor Yellow
    Write-Host "  python -m http.server $FrontendPort" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Access at:" -ForegroundColor Cyan
    Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host "  Backend:  http://localhost:$BackendPort" -ForegroundColor Green
    Write-Host ""
    
    $response = Read-Host "Start servers now? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "Starting servers..." -ForegroundColor Cyan
        $backendCmd = "cd '$BackendDir'; venv\Scripts\Activate.ps1; python app.py"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
        Start-Sleep -Seconds 2
        $frontendCmd = "cd '$FrontendDir'; python -m http.server $FrontendPort"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
        Write-Host "Servers started in new windows!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Happy deploying!" -ForegroundColor Green
Write-Host ""
