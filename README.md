# Hệ thống Theo dõi Chuyển dạ - Bệnh viện Hùng Vương

## 📋 Giới thiệu

Hệ thống theo dõi chuyển dạ được thiết kế để hỗ trợ các bác sĩ và nữ hộ sinh trong việc theo dõi và đánh giá tình trạng của sản phụ và thai nhi trong quá trình chuyển dạ. Hệ thống cung cấp:

- **Timeline tổng hợp**: Hiển thị diễn tiến theo dòng thời gian với khả năng phóng to/thu nhỏ
- **Hệ thống cảnh báo thông minh**: Tự động phát hiện và phân loại các nguy cơ dựa trên ngưỡng y khoa
- **Đánh giá tự động**: Phân loại tình trạng mẹ, thai nhi và tổng thể theo 3 cấp độ (Bình thường/Cảnh báo/Nguy hiểm)
- **Giao diện thân thiện**: Dễ sử dụng trên các thiết bị khác nhau
- **Cache-busting**: Websites luôn refresh và hiển thị dữ liệu mới nhất
- **Auto-redirect**: Tự động chuyển đến trang chi tiết sau khi tạo bệnh nhân mới
- **Para 4 chữ số**: Sử dụng định dạng chuẩn 4 chữ số cho thông tin sản khoa

## 🏗️ Kiến trúc Hệ thống

```
hungvuong/
├── frontend/                 # Frontend application
│   ├── index.html           # Trang danh sách bệnh nhân
│   ├── patient-detail.html  # Trang chi tiết bệnh nhân và partogram
│   ├── assets/              # Static assets
│   │   ├── css/            # Stylesheets
│   │   │   ├── styles.css  # Main styles
│   │   │   ├── components.css # Component styles
│   │   │   └── partogram.css  # Partogram specific styles
│   │   └── js/             # Main application scripts
│   └── src/                # Source code
│       ├── components/     # UI Components
│       │   ├── timeline.js # Timeline visualization
│       │   ├── partogramTable.js
│       │   └── assessmentManager.js
│       ├── services/       # API Services
│       │   └── apiService.js
│       └── utils/          # Utility functions
│           ├── dateUtils.js
│           ├── alertUtils.js
│           └── partogramUtils.js
├── backend/                 # Backend Flask application
│   ├── app.py              # Main application file
│   ├── app/                # Application package
│   │   ├── __init__.py     # App factory
│   │   ├── models/         # Database models
│   │   │   └── __init__.py # Patient, PartogramRecord, Alert, etc.
│   │   ├── views/          # API endpoints
│   │   │   ├── patient_views.py
│   │   │   ├── partogram_views.py
│   │   │   └── assessment_views.py
│   │   ├── services/       # Business logic
│   │   │   ├── alert_service.py
│   │   │   └── partogram_service.py
│   │   └── utils/          # Utility functions
│   ├── migrations/         # Database migrations
│   ├── tests/              # Unit tests
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example        # Environment variables example
│   └── .gitignore          # Git ignore rules
├── API_Documentation.md     # API documentation
└── README.md               # This file
```

## 🛠️ Công nghệ sử dụng

### Backend
- **Flask 2.3.2**: Web framework chính
- **Flask-SQLAlchemy 3.0.5**: ORM cho database
- **Flask-Migrate 4.0.4**: Database migrations
- **Flask-CORS 4.0.0**: Cross-origin resource sharing
- **SQLite**: Database (có thể chuyển sang PostgreSQL/MySQL)

### Frontend
- **Vanilla JavaScript ES6+**: Không sử dụng framework nặng
- **CSS3**: Responsive design với CSS Grid/Flexbox
- **HTML5**: Semantic markup

### Tính năng chính
- **Real-time monitoring**: Cập nhật tự động mỗi 2 phút
- **Timeline visualization**: Biểu đồ thời gian với multiple zoom levels
- **Alert system**: Hệ thống cảnh báo 3 cấp độ (Normal/Warning/Critical)
- **Responsive design**: Tương thích mobile và desktop
- **RESTful API**: Kiến trúc API chuẩn REST

## ⚡ Cài đặt và Chạy

### Yêu cầu hệ thống
- Python 3.8 hoặc cao hơn
- Web browser hiện đại (Chrome, Firefox, Safari, Edge)
- 500MB dung lượng trống

### 1. Cài đặt Backend

```bash
# Di chuyển vào thư mục backend
cd backend

# Tạo virtual environment (khuyến nghị)
python -m venv venv

# Kích hoạt virtual environment
# Windows PowerShell (nếu gặp lỗi execution policy):
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
venv\Scripts\Activate.ps1

# Windows Command Prompt (cmd):
venv\Scripts\activate.bat

# macOS/Linux:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt

# Tạo file environment
copy .env.example .env
# Chỉnh sửa .env file theo môi trường của bạn

# Khởi tạo database (Dùng python, khuyến nghị)
python manage.py db init
python manage.py db migrate -m "initial"
python manage.py db upgrade

# Hoặc dùng Flask
cd C:\Projects\URA\hungvuong\backend
venv\Scripts\Activate.ps1
# ensure .env is loaded into the current session:
$env:FLASK_APP = 'app.py'
$env:FLASK_ENV = 'development'
# now run migrations
flask db init
flask db migrate -m "initial"
flask db upgrade

# Chạy ứng dụng
python app.py
```

Backend sẽ chạy tại: `http://127.0.0.1:5000`

### 2. Cài đặt Frontend

Frontend cần chạy qua web server để tránh lỗi CORS khi gọi API. **KHÔNG** mở trực tiếp file HTML.

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cách 1: Sử dụng Python HTTP server (khuyến nghị)
python -m http.server 3000

# Cách 2: Sử dụng Node.js serve (cài đặt: npm install -g serve)
npx serve . -p 3000

# Cách 3: Sử dụng Live Server extension trong VS Code
# Click chuột phải vào index.html → "Open with Live Server"
```

**Frontend sẽ chạy tại**: `http://localhost:3000`

⚠️ **Quan trọng**: 
- **PHẢI** truy cập qua `http://localhost:3000` (không phải `file://`)
- **PHẢI** có cả backend (`http://localhost:5000`) và frontend chạy đồng thời
- Kiểm tra CORS nếu gặp lỗi kết nối API

### 3. Kiểm tra hoạt động

1. **Backend**: Mở terminal và kiểm tra `http://localhost:5000/api/health`
2. **Frontend**: Truy cập `http://localhost:3000` (KHÔNG mở file HTML trực tiếp)
3. **API Connection**: Mở F12 → Console để kiểm tra kết nối API
4. **Data Loading**: Xem danh sách bệnh nhân có hiển thị không

**Khắc phục sự cố thường gặp:**
- Nếu không có data: Chạy `flask seed_db` trong backend
- Nếu CORS error: Đảm bảo chạy frontend qua web server (không phải file://)
- Nếu 404 API: Kiểm tra backend có đang chạy trên port 5000 không

## 🎯 Hướng dẫn sử dụng

### Trang danh sách bệnh nhân (index.html)

1. **Xem tổng quan**: Thống kê số lượng bệnh nhân theo tình trạng
2. **Lọc bệnh nhân**: Sử dụng các tab để lọc theo tình trạng  
3. **Thêm bệnh nhân mới**: Click nút "+" để thêm bệnh nhân mới
4. **Chi tiết**: Click vào thẻ bệnh nhân để chuyển đến trang chi tiết
5. **Tự động cập nhật**: Dữ liệu tự động refresh mỗi 2 phút

### Trang chi tiết bệnh nhân (patient-detail.html)

1. **Timeline View**: 
   - Sử dụng zoom controls (30p, 1h, 2h, 4h)
   - Xem diễn tiến liên tục theo thời gian
   - Hover vào các điểm để xem chi tiết

2. **Thêm dữ liệu**: 
   - Click "Thêm lần khám"
   - Nhập đầy đủ thông tin theo form
   - Hệ thống tự động tính toán cảnh báo

3. **Đánh giá và xử trí**:
   - Nhập đánh giá của nữ hộ sinh và bác sĩ
   - Lập kế hoạch xử trí
   - Xem đánh giá tổng thể tự động

4. **Kết cục**:
   - Chọn loại kết cục sinh
   - Nhập thông tin chi tiết về trẻ sơ sinh
   - Lưu ghi chú cuối cùng

### Định dạng Para (4 chữ số)

Hệ thống sử dụng định dạng Para chuẩn 4 chữ số:
- **Chữ số 1**: Tổng số lần có thai (Gravida)
- **Chữ số 2**: Số lần sinh đủ tháng (Term births) 
- **Chữ số 3**: Số lần sinh non tháng (Preterm births)
- **Chữ số 4**: Số lần sảy thai/nạo phá thai (Abortions/Miscarriages)

**Ví dụ**:
- `0000`: Chưa có thai lần nào
- `0100`: Thai lần đầu, chưa sinh
- `2110`: Có thai 2 lần, sinh đủ tháng 1 lần, sinh non 1 lần, sảy 0 lần
- `3201`: Có thai 3 lần, sinh đủ tháng 2 lần, sinh non 0 lần, sảy 1 lần

## 📊 Quy tắc Cảnh báo

### 1. Đánh giá tình trạng Mẹ

| Số lần vượt ngưỡng | Tình trạng | Màu hiển thị | Hành động |
|-------------------|------------|--------------|-----------|
| 0 | Bình thường | 🟢 Xanh | Không cảnh báo |
| 1-3 | Có yếu tố nguy cơ | 🟡 Vàng | Hiển thị cảnh báo + ghi chú |
| 4-5 hoặc Critical | Nguy hiểm | 🔴 Đỏ | Tự động alert + đưa vào danh sách cảnh báo |

### 2. Đánh giá tình trạng Thai nhi

| CTG Score | Tình trạng | Hiển thị | Ghi chú |
|-----------|------------|----------|---------|
| 3 | Nguy hiểm | 🔴 Đỏ | Toàn bộ thai = ĐỎ |
| 2 | Nguy cơ cảnh báo | 🟡 Vàng | Toàn bộ thai = VÀNG |
| ≥2 | Vượt ngưỡng | Highlight viền đỏ | Luôn hiển thị cảnh báo |
| 0-1 | Theo nguyên tắc mẹ | 🟢🟡🔴 | Tính chung với các thông số khác |

### 3. Ngưỡng cảnh báo

**Mẹ:**
- Mạch: 60-100 bpm (cảnh báo: 50-120)  
- Huyết áp tâm thu: 90-140 mmHg (nguy hiểm: >160)
- Nhiệt độ: 36.0-37.5°C (nguy hiểm: >38.0°C)

**Thai nhi:**
- Tim thai: 110-160 bpm (nguy hiểm: <100 hoặc >180)
- CTG: 0-1 bình thường, 2 cảnh báo, 3 nguy hiểm

**Chuyển dạ:**
- Tốc độ mở cổ tử cung: ≥0.5 cm/giờ

## 🧪 Testing

### Chạy unit tests

```bash
cd backend
python -m pytest tests/ -v
```

### Test API endpoints

```bash
# Kiểm tra health check
curl http://127.0.0.1:5000/api/health

# Lấy danh sách bệnh nhân
curl http://127.0.0.1:5000/api/patients/

# Lấy timeline data
curl "http://127.0.0.1:5000/api/partogram/BN001/timeline?zoom=1h"
```

## 🚀 Deployment

### Development
```bash
# Terminal 1: Backend
cd backend
python app.py

# Terminal 2: Frontend  
cd frontend
python -m http.server 3000
```

Truy cập:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### Production (với Gunicorn)
```bash
# Install gunicorn
pip install gunicorn

# Run production server
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Hoặc sử dụng config file
gunicorn -c gunicorn.conf.py app:app
```

### Docker (tùy chọn)
```dockerfile
# Dockerfile cho backend
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```

## 📝 API Documentation

Chi tiết API documentation có trong file `API_Documentation.md`

Endpoints chính:
- `GET /api/patients/` - Danh sách bệnh nhân
- `POST /api/partogram/{patient_id}/records` - Thêm dữ liệu khám
- `GET /api/partogram/{patient_id}/timeline` - Timeline data
- `GET /api/assessments/{patient_id}/status` - Đánh giá tình trạng

## 🔧 Configuration

### Environment Variables (.env)
```bash
FLASK_ENV=development
FLASK_DEBUG=1
DATABASE_URL=sqlite:///partogram.db
SECRET_KEY=your-secret-key
CORS_ORIGINS=http://localhost:8080
```

### Database Configuration
- **Development**: SQLite (file-based)
- **Production**: PostgreSQL hoặc MySQL (khuyến nghị)

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push branch: `git push origin feature/new-feature`  
5. Tạo Pull Request

## � Troubleshooting

### ❌ Lỗi thường gặp và cách khắc phục

**1. Frontend không hiển thị dữ liệu:**
```bash
# Kiểm tra: Có chạy qua web server không?
# ✅ Đúng: http://localhost:3000
# ❌ Sai: file:///C:/Projects/.../index.html

# Giải pháp:
cd frontend
python -m http.server 3000
```

**2. CORS Error khi gọi API:**
```
Access to fetch at 'http://localhost:5000' from origin 'null' has been blocked by CORS policy
```
- **Nguyên nhân**: Mở file HTML trực tiếp (file://)
- **Giải pháp**: Chạy frontend qua web server như hướng dẫn ở trên

**3. "Không tìm thấy mã bệnh nhân" khi click:**
- **Kiểm tra**: Console log có hiển thị patient ID không?
- **Nguyên nhân**: Frontend chưa load được data từ API
- **Giải pháp**: Kiểm tra kết nối backend và CORS

**4. Database không có dữ liệu:**
```bash
# Khởi tạo và seed database
cd backend
flask init_db
flask seed_db
```

**5. Flask command không hoạt động:**
```bash
# Đặt FLASK_APP environment variable
export FLASK_APP=app.py  # Linux/Mac
set FLASK_APP=app.py     # Windows CMD
$env:FLASK_APP="app.py"  # Windows PowerShell
```

### 🔍 Debug steps

1. **Kiểm tra backend hoạt động:**
   ```bash
   curl http://localhost:5000/api/health
   # Hoặc mở trong browser: http://localhost:5000/api/patients/
   ```

2. **Kiểm tra frontend console:**
   - Mở F12 → Console
   - Tìm lỗi JavaScript hoặc network errors
   - Xem API calls có thành công không

3. **Kiểm tra network:**
   - F12 → Network tab
   - Refresh trang và xem các API calls
   - Status 200 = thành công, 4xx/5xx = lỗi

## �📞 Support

Nếu gặp vấn đề:

1. **Kiểm tra logs** trong browser console (F12)
2. **Xem API documentation** trong `API_Documentation.md`
3. **Kiểm tra network** connection giữa frontend và backend
4. **Đảm bảo database** được khởi tạo đúng với `flask init_db`
5. **Verify ports**: Backend (5000), Frontend (3000) không bị conflict

## 📄 License

Copyright © 2025 Bệnh viện Hùng Vương. All rights reserved.

## 🔄 Version History

- **v1.0.0** (2025-10-16)
  - Initial release
  - Basic partogram functionality
  - Alert system
  - Timeline visualization
  - RESTful API

## 🚧 Roadmap

### Phase 2 (Future)
- [ ] Multi-user authentication
- [ ] Role-based permissions (Bác sĩ/Nữ hộ sinh)
- [ ] PDF export cho partogram
- [ ] Email notifications cho cảnh báo critical
- [ ] Mobile app (React Native/Flutter)
- [ ] Advanced analytics và reporting
- [ ] Integration với HIS/EMR systems
- [ ] Real-time notifications với WebSockets

### Improvements
- [ ] Offline support với Service Workers
- [ ] Performance optimization cho large datasets
- [ ] Advanced charting với D3.js
- [ ] Multi-language support
- [ ] Accessibility improvements (WCAG 2.1)

---

**Phát triển bởi**: Đội ngũ IT Bệnh viện Hùng Vương  
**Cập nhật**: Tháng 10, 2025