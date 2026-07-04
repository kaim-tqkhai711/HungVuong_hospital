# 🖥️ Host Service - Backend Hệ thống Partogram Bệnh viện Hùng Vương

> Tài liệu mô tả cách cấu hình, vận hành và quản lý Host Service cho Backend API. Bao gồm các chế độ chạy, quản lý process, giám sát, bảo mật và mở rộng.

---

## Mục lục

- [Tổng quan Host Service](#tổng-quan-host-service)
- [Kiến trúc Host Service](#kiến-trúc-host-service)
- [Cấu hình Service](#cấu-hình-service)
- [Chế độ Development](#chế-độ-development)
- [Chế độ Production](#chế-độ-production)
- [Quản lý Process](#quản-lý-process)
- [Health Check & Monitoring](#health-check--monitoring)
- [Logging](#logging)
- [Bảo mật](#bảo-mật)
- [Reverse Proxy (Nginx / IIS)](#reverse-proxy-nginx--iis)
- [Scaling & Performance](#scaling--performance)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting Host Service](#troubleshooting-host-service)

---

## Tổng quan Host Service

Host Service là thành phần chịu trách nhiệm khởi chạy, duy trì và quản lý vòng đời (lifecycle) của Backend API server. Tùy theo môi trường, Host Service có thể là:

| Môi trường | Host Service | Port mặc định | Mô tả |
|-----------|-------------|---------------|-------|
| **Development** | Flask Development Server | `5000` | Auto-reload, debug mode, single-threaded |
| **Production (Linux)** | Gunicorn (WSGI) | `5000` | Multi-worker, pre-fork model |
| **Production (Windows)** | Waitress (WSGI) | `5000` | Multi-threaded, Windows-native |

### Sơ đồ tổng quan

```mermaid
graph LR
    Client["Client (Browser)"] -->|HTTP| RP["Reverse Proxy (Nginx/IIS)"]
    RP -->|":5000"| HS["Host Service (Gunicorn/Waitress)"]
    HS --> APP["Flask Application (create_app)"]
    APP --> BP1["patient_bp (/api/patients)"]
    APP --> BP2["partogram_bp (/api/partogram)"]
    APP --> BP3["assessment_bp (/api/assessments)"]
    APP --> HC["Health Check (/api/health)"]
    APP --> DB["Database (SQLite/PostgreSQL)"]

    style Client fill:#61dafb,color:#000
    style RP fill:#009639,color:#fff
    style HS fill:#ff6b35,color:#fff
    style APP fill:#3b82f6,color:#fff
    style DB fill:#6b7280,color:#fff
```

---

## Kiến trúc Host Service

### Application Factory & Entry Point

Backend sử dụng **Application Factory Pattern**. Host Service khởi tạo app thông qua:

```
backend/
├── app.py                  ← Entry point chính
│   ├── load_dotenv()       ← Load .env
│   ├── create_app()        ← Gọi Application Factory
│   ├── CLI commands         ← init-db, seed-db
│   └── app.run()           ← Development server
└── app/__init__.py         ← Application Factory
    └── create_app(config)  ← Tạo Flask instance + extensions
```

### Luồng khởi tạo Host Service

```mermaid
sequenceDiagram
    participant OS as OS / Service Manager
    participant Entry as app.py (Entry Point)
    participant Env as .env File
    participant Factory as create_app()
    participant Ext as Extensions (DB, CORS, Migrate)
    participant BP as Blueprints
    participant WSGI as WSGI Server

    OS->>Entry: Khởi chạy process
    Entry->>Env: load_dotenv()
    Entry->>Factory: create_app(FLASK_ENV)
    Factory->>Factory: Configure DB URI, SECRET_KEY
    Factory->>Ext: db.init_app(app)
    Factory->>Ext: migrate.init_app(app, db)
    Factory->>Ext: CORS(app, resources)
    Factory->>BP: Register patient_bp
    Factory->>BP: Register partogram_bp
    Factory->>BP: Register assessment_bp
    Factory->>Factory: Register error handlers (404, 500)
    Factory->>Factory: Register /api/health
    Factory-->>Entry: return app
    Entry->>WSGI: Serve app trên host:port
```

---

## Cấu hình Service

### Biến môi trường (.env)

| Biến | Bắt buộc | Mặc định | Mô tả |
|------|----------|----------|-------|
| `FLASK_APP` | ✅ | `app.py` | Entry point cho Flask CLI |
| `FLASK_ENV` | ❌ | `development` | Chế độ: `development` / `production` |
| `FLASK_DEBUG` | ❌ | `1` | Debug mode (0 = tắt, 1 = bật) |
| `DATABASE_URL` | ✅ (prod) | `sqlite:///partogram.db` | Connection string database |
| `SECRET_KEY` | ✅ (prod) | `dev-secret-key-...` | Flask secret key cho session & CSRF |
| `CORS_ORIGINS` | ❌ | `*` | Danh sách origin cho CORS, cách nhau bằng dấu phẩy |
| `LOG_LEVEL` | ❌ | `INFO` | Mức log: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `TIMEZONE` | ❌ | `Asia/Ho_Chi_Minh` | Timezone ứng dụng |
| `DATETIME_FORMAT` | ❌ | `%Y-%m-%d %H:%M:%S` | Format hiển thị datetime |

### File .env mẫu cho Production

```env
# === Host Service Configuration (Production) ===

# Flask
FLASK_APP=app.py
FLASK_ENV=production
FLASK_DEBUG=0

# Database - PostgreSQL cho production
DATABASE_URL=postgresql://partogram_user:StrongP@ssw0rd@localhost:5432/partogram_prod

# Security - BẮT BUỘC đổi cho production
SECRET_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0

# CORS - Giới hạn origin cụ thể
CORS_ORIGINS=https://partogram.hungvuong.vn,https://admin.hungvuong.vn

# Logging
LOG_LEVEL=WARNING

# Application
TIMEZONE=Asia/Ho_Chi_Minh
DATETIME_FORMAT=%Y-%m-%d %H:%M:%S
```

---

## Chế độ Development

### Khởi chạy

```bash
cd backend

# Cách 1: Trực tiếp qua Python
python app.py
# → Server chạy tại http://0.0.0.0:5000 (debug=True)

# Cách 2: Flask CLI
flask run --host=0.0.0.0 --port=5000
# → Mặc định dựa vào FLASK_DEBUG trong .env

# Cách 3: Chỉ định debug
flask run --host=0.0.0.0 --port=5000 --reload --debugger
```

### Đặc điểm Development Host

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Auto-reload | ✅ Bật | Tự khởi động lại khi code thay đổi |
| Debug mode | ✅ Bật | Hiển thị stack trace chi tiết |
| Interactive debugger | ✅ Bật | Werkzeug debugger trong browser |
| Single-threaded | ✅ | Chỉ xử lý 1 request tại 1 thời điểm |
| CORS | `*` | Cho phép tất cả origin |

> ⚠️ **CẢNH BÁO**: KHÔNG BAO GIỜ sử dụng Flask development server trong production. Server này không được thiết kế cho hiệu suất, bảo mật hay ổn định.

---

## Chế độ Production

### Linux/macOS — Gunicorn

#### Cài đặt

```bash
pip install gunicorn
```

#### Chạy trực tiếp

```bash
# Cơ bản - 4 workers
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Nâng cao - với timeout, logging, pid file
gunicorn \
  --workers 4 \
  --bind 0.0.0.0:5000 \
  --timeout 120 \
  --access-logfile /var/log/partogram/access.log \
  --error-logfile /var/log/partogram/error.log \
  --pid /var/run/partogram/gunicorn.pid \
  --daemon \
  app:app
```

#### Cấu hình file `gunicorn.conf.py` (khuyến nghị)

```python
# gunicorn.conf.py - Đặt trong backend/
import multiprocessing
import os

# Server socket
bind = "0.0.0.0:5000"

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"           # "sync" | "gevent" | "eventlet"
worker_connections = 1000
timeout = 120
keepalive = 5

# Restart workers sau N requests (chống memory leak)
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "/var/log/partogram/access.log"
errorlog = "/var/log/partogram/error.log"
loglevel = os.environ.get("LOG_LEVEL", "info").lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "partogram-backend"

# Daemonize
daemon = False  # True nếu không dùng systemd

# PID file
pidfile = "/var/run/partogram/gunicorn.pid"

# Preload app
preload_app = True

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190
```

Chạy với config file:

```bash
gunicorn -c gunicorn.conf.py app:app
```

#### Systemd Service (Linux)

Tạo file `/etc/systemd/system/partogram-backend.service`:

```ini
[Unit]
Description=Partogram Backend API - Bệnh viện Hùng Vương
Documentation=https://github.com/your-repo/hungvuong
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=notify
User=www-data
Group=www-data
RuntimeDirectory=partogram
WorkingDirectory=/opt/hungvuong/backend
Environment="PATH=/opt/hungvuong/backend/venv/bin:/usr/local/bin:/usr/bin"
EnvironmentFile=/opt/hungvuong/backend/.env
ExecStart=/opt/hungvuong/backend/venv/bin/gunicorn \
    --config gunicorn.conf.py \
    app:app
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=30
PrivateTmp=true
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Quản lý service:

```bash
# Cài đặt & kích hoạt
sudo systemctl daemon-reload
sudo systemctl enable partogram-backend
sudo systemctl start partogram-backend

# Kiểm tra trạng thái
sudo systemctl status partogram-backend

# Xem log
sudo journalctl -u partogram-backend -f

# Khởi động lại (graceful)
sudo systemctl reload partogram-backend

# Khởi động lại (full restart)
sudo systemctl restart partogram-backend

# Dừng service
sudo systemctl stop partogram-backend
```

---

### Windows — Waitress

#### Cài đặt

```powershell
pip install waitress
```

#### Chạy trực tiếp

```powershell
# Cơ bản
waitress-serve --host=0.0.0.0 --port=5000 app:app

# Nâng cao - 8 threads, với channel timeout
waitress-serve `
  --host=0.0.0.0 `
  --port=5000 `
  --threads=8 `
  --channel-timeout=120 `
  --connection-limit=500 `
  --cleanup-interval=30 `
  app:app
```

#### Script khởi chạy `run_production.py`

```python
"""
Production server launcher cho Windows (Waitress).
Đặt file này trong backend/
"""
import os
import sys
from dotenv import load_dotenv

# Load environment
load_dotenv()
os.environ['FLASK_ENV'] = 'production'

from app import create_app
from waitress import serve

app = create_app('production')

if __name__ == '__main__':
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    threads = int(os.environ.get('WAITRESS_THREADS', 8))

    print(f"🚀 Starting Partogram Backend (Production)")
    print(f"   Host: {host}:{port}")
    print(f"   Threads: {threads}")
    print(f"   Database: {app.config['SQLALCHEMY_DATABASE_URI']}")

    serve(
        app,
        host=host,
        port=port,
        threads=threads,
        channel_timeout=120,
        connection_limit=500,
        cleanup_interval=30,
        url_scheme='https'
    )
```

#### Windows Service (NSSM)

```powershell
# 1. Tải NSSM từ https://nssm.cc/download
# 2. Cài đặt service
nssm install PartogramBackend "C:\hungvuong\backend\venv\Scripts\python.exe" "C:\hungvuong\backend\run_production.py"

# 3. Cấu hình service
nssm set PartogramBackend AppDirectory "C:\hungvuong\backend"
nssm set PartogramBackend DisplayName "Partogram Backend - BV Hùng Vương"
nssm set PartogramBackend Description "Backend API cho hệ thống theo dõi chuyển dạ"
nssm set PartogramBackend Start SERVICE_AUTO_START
nssm set PartogramBackend AppStdout "C:\hungvuong\logs\backend-stdout.log"
nssm set PartogramBackend AppStderr "C:\hungvuong\logs\backend-stderr.log"
nssm set PartogramBackend AppRotateFiles 1
nssm set PartogramBackend AppRotateBytes 10485760

# 4. Quản lý service
nssm start PartogramBackend
nssm stop PartogramBackend
nssm restart PartogramBackend
nssm status PartogramBackend

# 5. Xóa service
nssm remove PartogramBackend confirm
```

Hoặc sử dụng PowerShell native:

```powershell
# Tạo Windows Service bằng sc.exe
sc.exe create PartogramBackend `
  binPath= "C:\hungvuong\backend\venv\Scripts\python.exe C:\hungvuong\backend\run_production.py" `
  DisplayName= "Partogram Backend API" `
  start= auto

# Quản lý
sc.exe start PartogramBackend
sc.exe stop PartogramBackend
sc.exe query PartogramBackend
```

---

## Quản lý Process

### Lifecycle của Host Service

```mermaid
stateDiagram-v2
    [*] --> Starting: Service Start
    Starting --> Initializing: Load .env & config
    Initializing --> Ready: create_app() thành công
    Ready --> Running: Bind host:port
    Running --> Running: Xử lý requests
    Running --> Reloading: SIGHUP / Config change
    Reloading --> Running: Graceful reload
    Running --> Stopping: SIGTERM / Stop command
    Stopping --> [*]: Cleanup & exit
    
    Running --> Error: Unhandled exception
    Error --> Restarting: Auto-restart (systemd)
    Restarting --> Starting
```

### Graceful Shutdown

Host Service xử lý shutdown an toàn:

1. **Nhận tín hiệu dừng** (SIGTERM/SIGINT)
2. **Dừng nhận request mới** — Không accept connection mới
3. **Hoàn tất request đang xử lý** — Chờ tối đa `timeout` giây
4. **Đóng kết nối DB** — SQLAlchemy session cleanup
5. **Ghi log dừng** — Log shutdown event
6. **Thoát process** — Exit code 0

### Worker Management (Gunicorn)

| Thao tác | Lệnh | Mô tả |
|----------|-------|-------|
| Graceful restart | `kill -HUP <master_pid>` | Khởi động lại worker mới, đợi worker cũ hoàn tất |
| Quick restart | `kill -TERM <master_pid>` | Dừng tất cả worker ngay lập tức |
| Tăng worker | `kill -TTIN <master_pid>` | Thêm 1 worker |
| Giảm worker | `kill -TTOU <master_pid>` | Bớt 1 worker |
| Graceful stop | `kill -QUIT <master_pid>` | Đợi worker hoàn tất rồi dừng |

---

## Health Check & Monitoring

### Endpoint Health Check

Backend cung cấp sẵn endpoint health check:

```
GET /api/health
```

**Response** (HTTP 200):

```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T10:30:00",
  "version": "1.0.0"
}
```

### Script kiểm tra sức khỏe nâng cao

Tạo file `healthcheck.sh` (Linux) hoặc `healthcheck.ps1` (Windows):

**Linux:**

```bash
#!/bin/bash
# healthcheck.sh - Kiểm tra Host Service
HEALTH_URL="http://localhost:5000/api/health"
TIMEOUT=5

response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_URL")

if [ "$response" = "200" ]; then
    echo "✅ Backend healthy"
    exit 0
else
    echo "❌ Backend unhealthy (HTTP $response)"
    exit 1
fi
```

**Windows PowerShell:**

```powershell
# healthcheck.ps1
$url = "http://localhost:5000/api/health"
try {
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 5
    if ($response.status -eq "healthy") {
        Write-Host "✅ Backend healthy - Version $($response.version)"
        exit 0
    }
} catch {
    Write-Host "❌ Backend unhealthy: $_"
    exit 1
}
```

### Giám sát với cron (Linux)

```bash
# Thêm vào crontab: kiểm tra mỗi 2 phút
*/2 * * * * /opt/hungvuong/healthcheck.sh || systemctl restart partogram-backend
```

### Giám sát với Task Scheduler (Windows)

```powershell
# Tạo Scheduled Task kiểm tra mỗi 2 phút
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-File C:\hungvuong\healthcheck.ps1"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 2) `
    -At "00:00" -Once
Register-ScheduledTask -TaskName "PartogramHealthCheck" `
    -Action $action -Trigger $trigger -RunLevel Highest
```

---

## Logging

### Cấu hình Logging

Logging mặc định qua biến `LOG_LEVEL` trong `.env`. Các mức hỗ trợ:

| Level | Khi nào sử dụng |
|-------|----------------|
| `DEBUG` | Development — log tất cả chi tiết |
| `INFO` | Development/Staging — log hoạt động bình thường |
| `WARNING` | Production — chỉ log cảnh báo trở lên |
| `ERROR` | Production (tối giản) — chỉ log lỗi |

### Vị trí file log

| Môi trường | Vị trí | Ghi chú |
|-----------|--------|---------|
| Development | `stdout/stderr` | In trực tiếp ra terminal |
| Production (Linux) | `/var/log/partogram/` | Gunicorn access & error log |
| Production (Windows) | `C:\hungvuong\logs\` | NSSM stdout/stderr redirect |
| Systemd (Linux) | `journalctl -u partogram-backend` | Managed bởi systemd |

### Log rotation (Linux)

Tạo file `/etc/logrotate.d/partogram`:

```
/var/log/partogram/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    dateext
}
```

---

## Bảo mật

### Checklist bảo mật Host Service

| # | Hạng mục | Trạng thái | Hướng dẫn |
|---|---------|-----------|-----------|
| 1 | SECRET_KEY ngẫu nhiên | ⚠️ Cần cấu hình | Tạo key: `python -c "import secrets; print(secrets.token_hex(32))"` |
| 2 | Debug mode TẮT | ⚠️ Cần cấu hình | `FLASK_DEBUG=0` và `FLASK_ENV=production` |
| 3 | CORS giới hạn | ⚠️ Cần cấu hình | Chỉ cho phép domain cụ thể, không dùng `*` |
| 4 | HTTPS | ❌ Chưa implement | Cấu hình tại Reverse Proxy (Nginx/IIS) |
| 5 | Authentication | ❌ Chưa implement | Cần thêm JWT hoặc session-based auth |
| 6 | Rate limiting | ❌ Chưa implement | Dùng `flask-limiter` hoặc Nginx `limit_req` |
| 7 | Request size limit | ✅ (Gunicorn) | `limit_request_line`, `limit_request_fields` |
| 8 | Firewall | ⚠️ Tùy hạ tầng | Chỉ expose port 80/443, không expose 5000 trực tiếp |

### Tạo SECRET_KEY an toàn

```bash
# Python
python -c "import secrets; print(secrets.token_hex(32))"

# OpenSSL
openssl rand -hex 32

# PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

---

## Reverse Proxy (Nginx / IIS)

### Nginx (Linux/macOS)

```nginx
upstream partogram_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    server_name partogram.hungvuong.vn;

    # Redirect HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name partogram.hungvuong.vn;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/partogram.hungvuong.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/partogram.hungvuong.vn/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend - Static files
    location / {
        root /opt/hungvuong/frontend;
        try_files $uri $uri/ /index.html;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Backend API - Proxy
    location /api/ {
        proxy_pass http://partogram_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # Rate limiting cho API
        limit_req zone=api burst=20 nodelay;
    }

    # Health check - không rate limit
    location /api/health {
        proxy_pass http://partogram_backend;
        access_log off;
    }

    # Request size limit (cho signature upload)
    client_max_body_size 10M;
}

# Rate limit zone
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
```

### IIS (Windows)

Cấu hình `web.config` cho reverse proxy:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- API requests → Backend -->
                <rule name="API Proxy" stopProcessing="true">
                    <match url="^api/(.*)" />
                    <action type="Rewrite" url="http://localhost:5000/api/{R:1}" />
                </rule>
                <!-- Frontend SPA -->
                <rule name="Frontend SPA" stopProcessing="true">
                    <match url=".*" />
                    <conditions logicalGrouping="MatchAll">
                        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
                        <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
                    </conditions>
                    <action type="Rewrite" url="/index.html" />
                </rule>
            </rules>
        </rewrite>
        <httpProtocol>
            <customHeaders>
                <add name="X-Frame-Options" value="SAMEORIGIN" />
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-XSS-Protection" value="1; mode=block" />
            </customHeaders>
        </httpProtocol>
    </system.webServer>
</configuration>
```

> ⚠️ **Yêu cầu**: Cài đặt module **URL Rewrite** và **Application Request Routing (ARR)** cho IIS.

---

## Scaling & Performance

### Công thức tính Worker/Thread

```
# Gunicorn (Linux) — CPU-bound
workers = (2 × CPU_cores) + 1

# Waitress (Windows) — I/O-bound
threads = (4 × CPU_cores)
```

**Ví dụ** — Server 4 CPU cores:

| Cấu hình | Gunicorn | Waitress |
|----------|----------|----------|
| Workers/Threads | 9 workers | 16 threads |
| Concurrent requests | ~9 | ~16 |
| RAM ước tính | ~450 MB (50 MB/worker) | ~200 MB |

### Performance Tuning Tips

1. **Database Connection Pool**: Cấu hình `SQLALCHEMY_POOL_SIZE` cho production
   ```python
   app.config['SQLALCHEMY_POOL_SIZE'] = 10
   app.config['SQLALCHEMY_POOL_TIMEOUT'] = 30
   app.config['SQLALCHEMY_MAX_OVERFLOW'] = 20
   ```

2. **Preload Application**: Gunicorn `preload_app = True` giúp share memory giữa workers

3. **Max Requests**: Restart worker sau N requests để chống memory leak
   ```
   max_requests = 1000
   max_requests_jitter = 50
   ```

4. **Keep-Alive**: Giữ connection để giảm TCP handshake overhead
   ```
   keepalive = 5  # giây
   ```

---

## Backup & Recovery

### Database Backup

**SQLite (Development)**:

```bash
# Backup
cp backend/instance/partogram.db backend/instance/partogram_backup_$(date +%Y%m%d).db

# Restore
cp backend/instance/partogram_backup_20251107.db backend/instance/partogram.db
```

**PostgreSQL (Production)**:

```bash
# Backup
pg_dump -U partogram_user -h localhost partogram_prod > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql -U partogram_user -h localhost partogram_prod < backup_20251107_143000.sql

# Automated daily backup (crontab)
0 2 * * * pg_dump -U partogram_user partogram_prod | gzip > /backups/partogram_$(date +\%Y\%m\%d).sql.gz
```

### Disaster Recovery

```mermaid
flowchart TD
    A["Service Down"] --> B{"Kiểm tra process"}
    B -->|"Process dead"| C["systemctl restart partogram-backend"]
    B -->|"Process running"| D{"Health check?"}
    D -->|"Unhealthy"| E["Kiểm tra log"]
    D -->|"Healthy"| F["Kiểm tra network/firewall"]
    E --> G{"DB connection error?"}
    G -->|"Có"| H["Restart DB service + kiểm tra .env"]
    G -->|"Không"| I{"Memory/CPU?"}
    I -->|"Quá tải"| J["Tăng workers hoặc scale server"]
    I -->|"Bình thường"| K["Kiểm tra code / migration"]
    C --> L["Kiểm tra health check"]
    H --> L
    J --> L
    L --> M{"Healthy?"}
    M -->|"Có"| N["✅ Đã khôi phục"]
    M -->|"Không"| O["Rollback code + restore DB backup"]
```

---

## Troubleshooting Host Service

### Lỗi thường gặp

| # | Triệu chứng | Nguyên nhân | Giải pháp |
|---|-------------|-------------|-----------|
| 1 | `[Errno 98] Address already in use` | Port 5000 đã bị chiếm | `lsof -i :5000` → `kill <PID>` hoặc đổi port |
| 2 | `ModuleNotFoundError: No module named 'app'` | Sai working directory hoặc chưa activate venv | `cd backend && source venv/bin/activate` |
| 3 | `OperationalError: no such table` | Database chưa khởi tạo | `flask init-db` hoặc `flask db upgrade` |
| 4 | `Connection refused` khi gọi API | Service chưa chạy hoặc firewall chặn | Kiểm tra `systemctl status` + firewall rules |
| 5 | `502 Bad Gateway` từ Nginx | Backend không phản hồi | Kiểm tra Gunicorn process + timeout config |
| 6 | `CORS error` trong browser | Origin không khớp `CORS_ORIGINS` | Cập nhật `.env` với origin chính xác |
| 7 | Worker bị kill liên tục | Timeout quá ngắn hoặc OOM | Tăng `timeout` hoặc thêm RAM |
| 8 | `SECRET_KEY` warning | Dùng key mặc định trong production | Tạo key mới: `secrets.token_hex(32)` |

### Kiểm tra nhanh

```bash
# 1. Service có đang chạy?
systemctl is-active partogram-backend   # Linux
sc.exe query PartogramBackend           # Windows

# 2. Port có đang listen?
ss -tlnp | grep 5000                    # Linux
netstat -an | findstr 5000              # Windows

# 3. Health check OK?
curl http://localhost:5000/api/health

# 4. Log gần nhất
journalctl -u partogram-backend -n 50   # Linux systemd
tail -50 /var/log/partogram/error.log   # Linux file log
Get-Content C:\hungvuong\logs\backend-stderr.log -Tail 50  # Windows

# 5. Database kết nối được?
flask shell -c "from app import db; print(db.engine.url)"
```

---

## Tham chiếu nhanh

### Lệnh quản lý Host Service

| Thao tác | Linux (systemd) | Windows (NSSM) |
|----------|-----------------|----------------|
| Khởi động | `sudo systemctl start partogram-backend` | `nssm start PartogramBackend` |
| Dừng | `sudo systemctl stop partogram-backend` | `nssm stop PartogramBackend` |
| Khởi động lại | `sudo systemctl restart partogram-backend` | `nssm restart PartogramBackend` |
| Trạng thái | `sudo systemctl status partogram-backend` | `nssm status PartogramBackend` |
| Xem log | `journalctl -u partogram-backend -f` | `Get-Content logs\stderr.log -Wait` |
| Tự động khởi động | `sudo systemctl enable partogram-backend` | `nssm set ... Start SERVICE_AUTO_START` |

### Endpoints đăng ký

| Blueprint | Prefix | File |
|-----------|--------|------|
| `patient_bp` | `/api/patients` | `views/patient_views.py` |
| `partogram_bp` | `/api/partogram` | `views/partogram_views.py` |
| `assessment_bp` | `/api/assessments` | `views/assessment_views.py` |
| Health Check | `/api/health` | `app/__init__.py` |

> 📖 Xem chi tiết tất cả endpoints và mẫu JSON tại [API_Reference.md](./API_Reference.md)

---

**Tài liệu liên quan:**

- [API_Reference.md](./API_Reference.md) — Tham chiếu chi tiết tất cả API endpoints và mẫu JSON request/response
- [Backend_Architecture.md](./Backend_Architecture.md) — Kiến trúc backend, service layer, alert system
- [Database_Schema.md](./Database_Schema.md) — Schema database và quan hệ giữa các bảng
- [Setup_Guide.md](./Setup_Guide.md) — Hướng dẫn cài đặt và phát triển
- [DEPLOYMENT.md](../DEPLOYMENT.md) — Hướng dẫn triển khai tổng thể (frontend + backend)

---

**Cập nhật lần cuối:** Tháng 7, 2026  
**Phiên bản:** 1.0.0
