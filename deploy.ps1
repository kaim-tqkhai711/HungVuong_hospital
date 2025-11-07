# Deployment Script for Hệ thống Theo dõi Chuyển dạ - Bệnh viện Hùng Vương
# PowerShell version for Windows deployment

param(
    [Parameter(Position=0)]
    [ValidateSet('development', 'production')]
    [string]$DeployEnv = 'development'
)

# Configuration
$BackendDir = "backend"
$FrontendDir = "frontend"
$VenvDir = Join-Path $BackendDir "venv"
$BackendPort = 5000
$FrontendPort = 3000

# Color functions
function Write-Status {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "✓" -ForegroundColor Green -NoNewline
    Write-Host "] $Message"
}

function Write-Error-Message {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "✗" -ForegroundColor Red -NoNewline
    Write-Host "] $Message"
}

function Write-Warning-Message {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "!" -ForegroundColor Yellow -NoNewline
    Write-Host "] $Message"
}

function Write-Info {
    param([string]$Message)
    Write-Host "[" -NoNewline
    Write-Host "i" -ForegroundColor Cyan -NoNewline
    Write-Host "] $Message"
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
}

# Banner
Write-Header "Hệ thống Theo dõi Chuyển dạ`nBệnh viện Hùng Vương"
Write-Host "Deployment Mode: " -NoNewline
Write-Host $DeployEnv -ForegroundColor Green
Write-Host ""

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check Python
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Error-Message "Python is not installed or not in PATH. Please install Python 3.8 or higher."
    exit 1
}

$pythonVersion = & python --version 2>&1
Write-Status "Python found: $pythonVersion"

# Check pip
$pipCmd = Get-Command pip -ErrorAction SilentlyContinue
if (-not $pipCmd) {
    Write-Error-Message "pip is not installed. Please install pip."
    exit 1
}
Write-Status "pip found"

# Check Python version
$versionOutput = & python -c "import sys; print('.'.join(map(str, sys.version_info[:2])))"
$versionNum = [version]$versionOutput
$requiredVersion = [version]"3.8"

if ($versionNum -lt $requiredVersion) {
    Write-Error-Message "Python version must be 3.8 or higher. Current version: $versionOutput"
    exit 1
}
Write-Status "Python version $versionOutput is compatible"

# ================================
# Backend Deployment
# ================================
Write-Info "`n========== Backend Deployment =========="

# Navigate to backend directory
if (-not (Test-Path $BackendDir)) {
    Write-Error-Message "Backend directory not found: $BackendDir"
    exit 1
}

Push-Location $BackendDir

try {
    # Create virtual environment if it doesn't exist
    if (-not (Test-Path "venv")) {
        Write-Info "Creating virtual environment..."
        & python -m venv venv
        Write-Status "Virtual environment created"
    } else {
        Write-Status "Virtual environment already exists"
    }

    # Activate virtual environment
    Write-Info "Activating virtual environment..."
    $activateScript = "venv\Scripts\Activate.ps1"
    
    # Set execution policy for current process
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force
    
    & $activateScript
    Write-Status "Virtual environment activated"

    # Upgrade pip
    Write-Info "Upgrading pip..."
    & venv\Scripts\python.exe -m pip install --upgrade pip --quiet
    Write-Status "pip upgraded"

    # Install dependencies
    Write-Info "Installing Python dependencies..."
    & venv\Scripts\pip.exe install -r requirements.txt --quiet
    Write-Status "Dependencies installed"

    # Setup environment variables
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Info "Creating .env file from .env.example..."
            Copy-Item .env.example .env
            Write-Warning-Message "Please update .env file with your configuration"
        } else {
            Write-Info "Creating default .env file..."
            
            # Generate secret key
            $secretKey = -join ((48..57) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
            
            $envContent = @"
FLASK_ENV=$DeployEnv
FLASK_DEBUG=$( if ($DeployEnv -eq 'development') { '1' } else { '0' } )
DATABASE_URL=sqlite:///partogram.db
SECRET_KEY=$secretKey
CORS_ORIGINS=http://localhost:$FrontendPort
"@
            $envContent | Out-File -FilePath .env -Encoding utf8
            Write-Status ".env file created with default values"
        }
    } else {
        Write-Status ".env file already exists"
    }

    # Database setup
    Write-Info "Setting up database..."

    # Set environment variable for Flask
    $env:FLASK_APP = "app.py"

    # Check if migrations directory exists
    if (-not (Test-Path "migrations")) {
        Write-Info "Initializing database migrations..."
        & venv\Scripts\flask.exe db init
        Write-Status "Database migrations initialized"
    }

    # Run migrations
    Write-Info "Running database migrations..."
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    try {
        & venv\Scripts\flask.exe db migrate -m "Deployment migration $timestamp" 2>&1 | Out-Null
    } catch {
        Write-Warning-Message "No new migrations to apply"
    }
    & venv\Scripts\flask.exe db upgrade
    Write-Status "Database migrations applied"

    # Check if database needs seeding
    if ($DeployEnv -eq 'development') {
        $response = Read-Host "Do you want to seed the database with sample data? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            Write-Info "Seeding database..."
            try {
                & venv\Scripts\flask.exe seed_db
                Write-Status "Database seeded with sample data"
            } catch {
                Write-Warning-Message "Seed command not available. You may need to add sample data manually."
            }
        }
    }

} finally {
    # Return to root directory
    Pop-Location
}

# ================================
# Frontend Deployment
# ================================
Write-Info "`n========== Frontend Deployment =========="

# Check if frontend directory exists
if (-not (Test-Path $FrontendDir)) {
    Write-Error-Message "Frontend directory not found: $FrontendDir"
    exit 1
}

Write-Status "Frontend files verified"

# ================================
# Production Setup
# ================================
if ($DeployEnv -eq 'production') {
    Write-Info "`n========== Production Setup =========="
    
    # Install waitress (Windows WSGI server)
    Write-Info "Installing production server (waitress)..."
    Push-Location $BackendDir
    try {
        & venv\Scripts\pip.exe install waitress --quiet
        Write-Status "Waitress installed"
        
        # Create production server script
        if (-not (Test-Path "run_production.py")) {
            Write-Info "Creating production server script..."
            $prodScript = @"
from waitress import serve
from app import app
import os

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f'Starting production server on port {port}...')
    serve(app, host='0.0.0.0', port=port, threads=4)
"@
            $prodScript | Out-File -FilePath run_production.py -Encoding utf8
            Write-Status "Production server script created"
        }
    } finally {
        Pop-Location
    }
    
    Write-Warning-Message "`nFor production deployment, consider:"
    Write-Info "1. Setting up IIS as reverse proxy"
    Write-Info "2. Using NSSM to run as Windows service"
    Write-Info "3. Configuring SSL/HTTPS"
}

# ================================
# Create Windows Service (NSSM)
# ================================
if ($DeployEnv -eq 'production') {
    $response = Read-Host "`nDo you want instructions to create a Windows service? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Info "`nTo create a Windows service using NSSM:"
        Write-Host ""
        Write-Host "1. Download NSSM from https://nssm.cc/download" -ForegroundColor Yellow
        Write-Host "2. Run the following commands as Administrator:" -ForegroundColor Yellow
        Write-Host ""
        $currentPath = Get-Location
        $pythonPath = Join-Path $currentPath "$BackendDir\venv\Scripts\python.exe"
        $scriptPath = Join-Path $currentPath "$BackendDir\run_production.py"
        
        Write-Host "   nssm install HungVuongPartogram `"$pythonPath`" `"$scriptPath`"" -ForegroundColor Cyan
        Write-Host "   nssm set HungVuongPartogram AppDirectory `"$(Join-Path $currentPath $BackendDir)`"" -ForegroundColor Cyan
        Write-Host "   nssm set HungVuongPartogram Description `"Hungvuong Partogram System`"" -ForegroundColor Cyan
        Write-Host "   nssm start HungVuongPartogram" -ForegroundColor Cyan
        Write-Host ""
    }
}

# ================================
# Final Summary
# ================================
Write-Header "Deployment completed successfully!"

if ($DeployEnv -eq 'development') {
    Write-Info "To start the development servers:`n"
    
    Write-Info "Terminal 1 (Backend):"
    Write-Host "  cd $BackendDir" -ForegroundColor Yellow
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "  python app.py" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Info "Terminal 2 (Frontend):"
    Write-Host "  cd $FrontendDir" -ForegroundColor Yellow
    Write-Host "  python -m http.server $FrontendPort" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Info "Then access:"
    Write-Host "  Frontend: " -NoNewline
    Write-Host "http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host "  Backend:  " -NoNewline
    Write-Host "http://localhost:$BackendPort" -ForegroundColor Green
    Write-Host ""
    
    # Option to start servers now
    $response = Read-Host "Do you want to start the servers now? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Info "Starting servers..."
        
        # Start backend in new window
        $backendCmd = "cd '$BackendDir'; venv\Scripts\Activate.ps1; python app.py"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
        Write-Status "Backend server started in new window"
        
        # Wait a moment for backend to start
        Start-Sleep -Seconds 2
        
        # Start frontend in new window
        $frontendCmd = "cd '$FrontendDir'; python -m http.server $FrontendPort"
        Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd
        Write-Status "Frontend server started in new window"
        
        Write-Host ""
        Write-Status "Both servers are running in separate windows!"
        Write-Info "Close those windows to stop the servers"
    }
} else {
    Write-Info "To start the production server:`n"
    Write-Host "  cd $BackendDir" -ForegroundColor Yellow
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    Write-Host "  python run_production.py" -ForegroundColor Yellow
    Write-Host ""
    
    Write-Info "Or install as Windows service using NSSM (see instructions above)"
    Write-Host ""
    
    Write-Info "For frontend in production, serve static files using IIS or nginx."
}

Write-Host ""
Write-Host "Happy deploying! 🚀" -ForegroundColor Green
Write-Host ""
