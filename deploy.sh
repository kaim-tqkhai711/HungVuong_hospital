#!/bin/bash

# Deployment Script for Hệ thống Theo dõi Chuyển dạ - Bệnh viện Hùng Vương
# This script automates the deployment process for both development and production environments

set -e  # Exit immediately if a command exits with a non-zero status

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
VENV_DIR="$BACKEND_DIR/venv"
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Environment type: development or production
DEPLOY_ENV="${1:-development}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Hệ thống Theo dõi Chuyển dạ${NC}"
echo -e "${BLUE}Bệnh viện Hùng Vương${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Deployment Mode: $DEPLOY_ENV${NC}\n"

# Function to print colored messages
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists python3; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi
print_status "Python 3 found: $(python3 --version)"

if ! command_exists pip3; then
    print_error "pip3 is not installed. Please install pip."
    exit 1
fi
print_status "pip3 found"

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.8"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    print_error "Python version must be 3.8 or higher. Current version: $PYTHON_VERSION"
    exit 1
fi
print_status "Python version $PYTHON_VERSION is compatible"

# ================================
# Backend Deployment
# ================================
print_info "\n========== Backend Deployment =========="

# Navigate to backend directory
cd "$BACKEND_DIR" || exit 1

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_info "Creating virtual environment..."
    python3 -m venv venv
    print_status "Virtual environment created"
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_info "Activating virtual environment..."
source venv/bin/activate
print_status "Virtual environment activated"

# Upgrade pip
print_info "Upgrading pip..."
pip install --upgrade pip --quiet
print_status "pip upgraded"

# Install dependencies
print_info "Installing Python dependencies..."
pip install -r requirements.txt --quiet
print_status "Dependencies installed"

# Setup environment variables
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_info "Creating .env file from .env.example..."
        cp .env.example .env
        print_warning "Please update .env file with your configuration"
    else
        print_info "Creating default .env file..."
        cat > .env << EOF
FLASK_ENV=$DEPLOY_ENV
FLASK_DEBUG=$([ "$DEPLOY_ENV" = "development" ] && echo "1" || echo "0")
DATABASE_URL=sqlite:///partogram.db
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
CORS_ORIGINS=http://localhost:$FRONTEND_PORT
EOF
        print_status ".env file created with default values"
    fi
else
    print_status ".env file already exists"
fi

# Database setup
print_info "Setting up database..."

# Check if migrations directory exists
if [ ! -d "migrations" ]; then
    print_info "Initializing database migrations..."
    export FLASK_APP=app.py
    flask db init
    print_status "Database migrations initialized"
fi

# Run migrations
print_info "Running database migrations..."
export FLASK_APP=app.py
flask db migrate -m "Deployment migration $(date +%Y%m%d_%H%M%S)" 2>/dev/null || print_warning "No new migrations to apply"
flask db upgrade
print_status "Database migrations applied"

# Check if database needs seeding
if [ "$DEPLOY_ENV" = "development" ]; then
    read -p "Do you want to seed the database with sample data? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Seeding database..."
        if command_exists flask && flask seed_db 2>/dev/null; then
            print_status "Database seeded with sample data"
        else
            print_warning "Seed command not available. You may need to add sample data manually."
        fi
    fi
fi

# Return to root directory
cd ..

# ================================
# Frontend Deployment
# ================================
print_info "\n========== Frontend Deployment =========="

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    print_error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

print_status "Frontend files verified"

# ================================
# Production Setup
# ================================
if [ "$DEPLOY_ENV" = "production" ]; then
    print_info "\n========== Production Setup =========="
    
    # Install gunicorn if not installed
    print_info "Installing production server (gunicorn)..."
    cd "$BACKEND_DIR"
    source venv/bin/activate
    pip install gunicorn --quiet
    print_status "Gunicorn installed"
    
    # Create gunicorn configuration
    if [ ! -f "gunicorn.conf.py" ]; then
        print_info "Creating gunicorn configuration..."
        cat > gunicorn.conf.py << 'EOF'
import multiprocessing

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
timeout = 30
keepalive = 2

# Logging
accesslog = "logs/access.log"
errorlog = "logs/error.log"
loglevel = "info"

# Process naming
proc_name = "hungvuong_partogram"

# Server mechanics
daemon = False
pidfile = "gunicorn.pid"
EOF
        print_status "Gunicorn configuration created"
    fi
    
    # Create logs directory
    mkdir -p logs
    
    cd ..
    
    # Nginx configuration suggestion
    print_warning "\nFor production deployment, consider setting up Nginx as reverse proxy:"
    print_info "Example Nginx configuration:"
    echo -e "${YELLOW}
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root $(pwd)/$FRONTEND_DIR;
        index index.html;
        try_files \$uri \$uri/ =404;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
${NC}"
fi

# ================================
# Create systemd service (Linux production)
# ================================
if [ "$DEPLOY_ENV" = "production" ] && [ -d "/etc/systemd/system" ]; then
    read -p "Do you want to create a systemd service? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Creating systemd service file..."
        
        SERVICE_FILE="hungvuong-partogram.service"
        cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Hungvuong Partogram System
After=network.target

[Service]
Type=notify
User=$USER
WorkingDirectory=$(pwd)/$BACKEND_DIR
Environment="PATH=$(pwd)/$BACKEND_DIR/venv/bin"
ExecStart=$(pwd)/$BACKEND_DIR/venv/bin/gunicorn -c gunicorn.conf.py app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF
        
        print_status "Systemd service file created: $SERVICE_FILE"
        print_info "To install the service, run:"
        print_info "  sudo cp $SERVICE_FILE /etc/systemd/system/"
        print_info "  sudo systemctl daemon-reload"
        print_info "  sudo systemctl enable $SERVICE_FILE"
        print_info "  sudo systemctl start $SERVICE_FILE"
    fi
fi

# ================================
# Final Summary
# ================================
print_info "\n${BLUE}================================${NC}"
print_status "${GREEN}Deployment completed successfully!${NC}"
print_info "${BLUE}================================${NC}\n"

if [ "$DEPLOY_ENV" = "development" ]; then
    print_info "To start the development servers:\n"
    
    print_info "Terminal 1 (Backend):"
    echo -e "  ${YELLOW}cd $BACKEND_DIR${NC}"
    echo -e "  ${YELLOW}source venv/bin/activate${NC}"
    echo -e "  ${YELLOW}python app.py${NC}\n"
    
    print_info "Terminal 2 (Frontend):"
    echo -e "  ${YELLOW}cd $FRONTEND_DIR${NC}"
    echo -e "  ${YELLOW}python3 -m http.server $FRONTEND_PORT${NC}\n"
    
    print_info "Then access:"
    echo -e "  Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}\n"
    
    # Option to start servers now
    read -p "Do you want to start the servers now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Starting servers..."
        
        # Start backend in background
        cd "$BACKEND_DIR"
        source venv/bin/activate
        python app.py &
        BACKEND_PID=$!
        print_status "Backend started (PID: $BACKEND_PID)"
        cd ..
        
        # Start frontend in background
        cd "$FRONTEND_DIR"
        python3 -m http.server $FRONTEND_PORT &
        FRONTEND_PID=$!
        print_status "Frontend started (PID: $FRONTEND_PID)"
        cd ..
        
        print_info "\nServers are running!"
        print_info "Press Ctrl+C to stop both servers"
        
        # Wait for Ctrl+C
        trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
        wait
    fi
else
    print_info "To start the production server:\n"
    echo -e "  ${YELLOW}cd $BACKEND_DIR${NC}"
    echo -e "  ${YELLOW}source venv/bin/activate${NC}"
    echo -e "  ${YELLOW}gunicorn -c gunicorn.conf.py app:app${NC}\n"
    
    print_info "Or use the systemd service (if installed):"
    echo -e "  ${YELLOW}sudo systemctl start hungvuong-partogram.service${NC}\n"
    
    print_info "For frontend in production, serve static files using Nginx or Apache."
fi

print_info "\n${GREEN}Happy deploying! 🚀${NC}\n"
