# DEPLOYMENT GUIDE
## Tài liệu triển khai hệ thống Partogram BV Hùng Vương

---

## 1. Tổng quan

Hệ thống Partogram theo dõi chuyển dạ, gồm 2 thành phần:

| Thành phần | Công nghệ | Cổng mặc định |
|-----------|-----------|---------------|
| Frontend | nginx (static HTML/JS/CSS) | 80 |
| Backend | Flask + gunicorn (Python 3.11) | 5000 |

Luồng request: `Browser → nginx (frontend) → proxy /api → gunicorn (backend) → Database`

---

## 2. Yêu cầu hệ thống

### Docker

| Phần mềm | Phiên bản tối thiểu |
|----------|-------------------|
| Docker | 20.10+ |
| Docker Compose | 2.0+ |

### VPS (không dùng Docker)

| Phần mềm | Phiên bản tối thiểu |
|----------|-------------------|
| Python | 3.9+ |
| pip | 21.0+ |
| nginx | 1.18+ |
| Git | 2.30+ |

---

## 3. Cấu hình môi trường

### 3.1. Backend

| Biến | Bắt buộc | Mặc định | Mô tả |
|------|----------|---------|-------|
| `FLASK_APP` | x | `app.py` | Entry point cho Flask CLI |
| `FLASK_ENV` | | `development` | Chế độ: `development` / `production` |
| `FLASK_DEBUG` | | `1` | Debug mode (`0` = tắt, `1` = bật) |
| `PORT` | | `5000` | Cổng lắng nghe của backend |
| `DATABASE_URL` | x | `sqlite:///partogram.db` | Connection string database |
| `SECRET_KEY` | x | `dev-secret-key-...` | Flask secret key cho session & CSRF |
| `CORS_ORIGINS` | | `*` | Danh sách origin cho CORS, cách nhau bằng dấu phẩy |
| `LOG_LEVEL` | | `INFO` | Mức log: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `TIMEZONE` | | `Asia/Ho_Chi_Minh` | Timezone ứng dụng |
| `DATETIME_FORMAT` | | `%Y-%m-%d %H:%M:%S` | Format hiển thị datetime |

**PostgreSQL URL:**

```
DATABASE_URL=postgresql://username:password@host:port/database_name
```

### 3.2. Frontend

| Biến | Mặc định | Mô tả |
|------|---------|-------|
| `PORT` | `80` | Cổng lắng nghe nginx |
| `BACKEND_URL` | `backend:5000` | Địa chỉ backend cho nginx proxy |

---

## 4. Quy trình triển khai

### 4.1. Docker Compose (khuyến nghị)

```bash
# Clone repository
git clone <repo-url>
cd HungVuong_hospital

# Khởi động
docker compose up -d

# Kiểm tra
curl http://localhost/api/health

# Dừng
docker compose down
```

Frontend: `http://localhost`
Backend API: `http://localhost/api/health`

### 4.2. Docker từng thành phần

#### Backend

```bash
docker build -t partogram-backend ./backend

docker run -d \
  -p 5000:5000 \
  -e FLASK_ENV=production \
  -e DATABASE_URL=sqlite:///partogram.db \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  --name partogram-backend \
  partogram-backend
```

Cổng tùy chỉnh:

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e FLASK_ENV=production \
  -e DATABASE_URL=sqlite:///partogram.db \
  -e SECRET_KEY=$(openssl rand -hex 32) \
  --name partogram-backend \
  partogram-backend
```

#### Frontend

```bash
docker build -t partogram-frontend ./frontend

docker run -d \
  -p 80:80 \
  -e BACKEND_URL=host.docker.internal:5000 \
  --name partogram-frontend \
  partogram-frontend
```

`BACKEND_URL`: dùng `host.docker.internal:5000` cho máy host, hoặc tên container nếu cùng mạng Docker.

### 4.3. VPS (không dùng Docker)

#### Cài đặt

```bash
git clone <repo-url>
cd HungVuong_hospital/backend

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cat > .env << EOF
FLASK_ENV=production
PORT=5000
DATABASE_URL=sqlite:///partogram.db
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
EOF
```

#### Chạy với gunicorn

```bash
gunicorn --bind 127.0.0.1:$PORT --workers 4 app:app
```

#### Systemd Service

Tạo file `/etc/systemd/system/partogram.service`:

```ini
[Unit]
Description=Partogram Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/HungVuong_hospital/backend
Environment="PATH=/path/to/HungVuong_hospital/backend/venv/bin"
Environment="PORT=5000"
ExecStart=/path/to/HungVuong_hospital/backend/venv/bin/gunicorn --bind 127.0.0.1:5000 --workers 4 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now partogram
```

#### Nginx

Tạo file `/etc/nginx/sites-available/partogram`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/HungVuong_hospital/frontend;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/partogram /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
