# 🚀 Setup & Development Guide - Hệ thống Partogram BV Hùng Vương

> Hướng dẫn cài đặt, chạy và phát triển backend.

---

## Yêu cầu hệ thống

| Phần mềm | Version tối thiểu |
|----------|-------------------|
| Python | 3.9+ |
| pip | 21.0+ |
| Git | 2.30+ |

---

## Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd hungvuong/backend
```

### 2. Tạo virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

### 4. Cấu hình environment

```bash
# Copy file example
cp .env.example .env

# Chỉnh sửa .env theo môi trường
```

**Các biến quan trọng cần thay đổi cho production**:
```env
FLASK_ENV=production
SECRET_KEY=<your-random-secret-key>
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### 5. Khởi tạo database

```bash
# Tạo tables
flask init-db

# (Tùy chọn) Seed dữ liệu mẫu
flask seed-db
```

### 6. Chạy server

```bash
# Development
python app.py
# Server chạy tại http://localhost:5000

# Hoặc dùng Flask CLI
flask run --host=0.0.0.0 --port=5000
```

---

## Development Workflow

### Database Migration

Khi thay đổi model (thêm/sửa/xóa column):

```bash
# 1. Tạo migration script
flask db migrate -m "Mô tả thay đổi"

# 2. Review migration file trong migrations/versions/

# 3. Apply migration
flask db upgrade

# Rollback nếu cần
flask db downgrade
```

### Chạy Tests

```bash
# Chạy tất cả tests
pytest

# Chạy với verbose
pytest -v

# Chạy test cụ thể
pytest tests/test_patient.py -v
```

### Code Formatting

```bash
# Format code
black app/

# Check linting
flake8 app/
```

---

## Cấu trúc Project

```
backend/
├── app.py              ← Entry point + CLI commands + seed data
├── manage.py           ← Flask CLI management
├── requirements.txt    ← Dependencies
├── .env                ← Environment variables (gitignored)
├── .env.example        ← Template cho .env
├── instance/           ← SQLite DB files (gitignored)
├── migrations/         ← Alembic migrations
└── app/
    ├── __init__.py     ← Application factory
    ├── models/         ← Database models
    ├── services/       ← Business logic
    └── views/          ← API endpoints (Blueprints)
```

---

## Quy trình thêm tính năng mới

### Thêm field mới cho Model

1. **Thêm column** trong `app/models/__init__.py`
2. **Cập nhật `to_dict()`** để serialize field mới
3. **Tạo migration**: `flask db migrate -m "Add <field_name>"`
4. **Apply**: `flask db upgrade`
5. **Cập nhật service** nếu cần xử lý logic
6. **Cập nhật view** nếu cần expose qua API
7. **Cập nhật documentation**

### Thêm API endpoint mới

1. **Chọn blueprint** phù hợp hoặc tạo mới
2. **Thêm route** trong file view tương ứng
3. **Thêm logic** trong service layer (không viết logic trong view)
4. **Register blueprint** trong `app/__init__.py` nếu là blueprint mới
5. **Cập nhật API_Reference.md**

### Thêm logic cảnh báo mới

1. **Thêm threshold** trong `ThresholdConfig`
2. **Thêm check method** trong `AlertService` 
3. **Gọi method mới** trong `evaluate_partogram_record()`
4. **Cập nhật `calculate_patient_status()`** nếu cần
5. **Cập nhật `get_current_alerts_for_patient()`**

---

## Troubleshooting

### Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|------------|----------|
| `ModuleNotFoundError: No module named 'app'` | Chưa activate venv hoặc chạy sai thư mục | `cd backend && venv\Scripts\activate` |
| `OperationalError: no such table` | Chưa khởi tạo DB | `flask init-db` |
| `CORS error` trong browser | Frontend gọi từ origin khác | Kiểm tra CORS config trong `__init__.py` |
| `ImportError: circular import` | Import sai thứ tự | Import models sau khi tạo app |

### Reset Database

```bash
# Xóa database cũ
rm instance/partogram.db

# Tạo lại
flask init-db
flask seed-db
```

---

## Production Deployment

### Với Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Environment Production

```env
FLASK_ENV=production
FLASK_DEBUG=0
SECRET_KEY=<strong-random-key>
DATABASE_URL=postgresql://user:pass@host:5432/partogram_prod
```

> Xem thêm chi tiết trong [DEPLOYMENT.md](../DEPLOYMENT.md)
