# Changelog - Thêm Trường Thông Tin Tổng Quan

## Ngày: 2025-11-07

## Tóm tắt
Đã thêm 3 trường mới vào thông tin tổng quan bệnh nhân theo yêu cầu:
- ✅ Ngày giờ ối vỡ (date, time)
- ✅ Yếu tố nguy cơ (text field)
- ✅ Phương pháp: CDTN hoặc KPCD (dropdown selection)

**LƯU Ý:** Các trường `urine` (Nước tiểu) và `contraction_duration` (Thời gian cơn co) đã có sẵn trong hệ thống từ trước, không cần thêm mới.

## Files đã thay đổi

### Backend

#### 1. `backend/app/models/__init__.py`
**Thay đổi:** Thêm 3 trường mới vào `Patient` model
```python
# New fields - Thông tin tổng quan
membrane_rupture_date = db.Column(db.DateTime)  # Ngày giờ ối vỡ
risk_factors = db.Column(db.Text)  # Yếu tố nguy cơ
labor_induction_method = db.Column(db.String(20))  # CDTN hoặc KPCD
```

**Cập nhật:** Method `to_dict()` để include các trường mới
```python
'membrane_rupture_date': self.membrane_rupture_date.isoformat() if self.membrane_rupture_date else None,
'risk_factors': self.risk_factors,
'labor_induction_method': self.labor_induction_method,
```

#### 2. `backend/migrations/versions/add_patient_overview_fields.py`
**Mới:** Migration file để thêm các cột vào database
- Adds `membrane_rupture_date` column (DateTime, nullable)
- Adds `risk_factors` column (Text, nullable)
- Adds `labor_induction_method` column (String(20), nullable)

### Frontend

#### 3. `frontend/assets/js/app.js`
**Thay đổi:** Function `showAddPatientModal()`
- Thêm input `datetime-local` cho ngày giờ ối vỡ
- Thêm dropdown cho phương pháp (CDTN/KPCD)
- Thêm textarea cho yếu tố nguy cơ

**Thay đổi:** Function `saveNewPatient()`
- Collect dữ liệu từ 3 trường mới
- Gửi lên backend khi tạo bệnh nhân mới

#### 4. `frontend/assets/js/patient-detail.js`
**Thay đổi:** Function `renderPatientHeader()`
- Hiển thị ngày giờ ối vỡ (hoặc "Chưa vỡ ối")
- Hiển thị phương pháp (CDTN/KPCD hoặc "Chưa xác định")
- Hiển thị yếu tố nguy cơ (nếu có)

**Thay đổi:** Function `showEditPatientModal()`
- Thêm 3 trường mới vào form chỉnh sửa
- Pre-fill dữ liệu hiện tại của bệnh nhân

**Thay đổi:** Function `savePatientEdits()`
- Collect và validate dữ liệu từ 3 trường mới
- Gửi lên backend khi cập nhật thông tin

### Documentation

#### 5. `MIGRATION_GUIDE.md` (Mới)
Hướng dẫn chi tiết cách chạy database migration:
- Các bước chạy migration trên Windows/Linux/Mac
- Cách kiểm tra migration đã thành công
- Cách rollback nếu cần
- Troubleshooting các lỗi thường gặp

## Cách sử dụng các trường mới

### 1. Ngày giờ ối vỡ (`membrane_rupture_date`)
- **Type:** DateTime
- **Nullable:** Yes (có thể để trống)
- **Hiển thị:** Datetime picker trên form
- **Giá trị mặc định:** NULL (hiển thị "Chưa vỡ ối" trên UI)
- **Ví dụ:** 2025-11-07 14:30

### 2. Yếu tố nguy cơ (`risk_factors`)
- **Type:** Text (unlimited length)
- **Nullable:** Yes (có thể để trống)
- **Hiển thị:** Textarea trên form (3 rows)
- **Giá trị mặc định:** NULL (không hiển thị trên UI nếu trống)
- **Ví dụ:** "Tiền sản giật, tiểu đường thai kỳ, thai to"

### 3. Phương pháp (`labor_induction_method`)
- **Type:** String (max 20 characters)
- **Nullable:** Yes (có thể để trống)
- **Hiển thị:** Dropdown selection
- **Giá trị:**
  - `null` → "Chưa xác định"
  - `"CDTN"` → "Chuyển dạ tự nhiên (CDTN)"
  - `"KPCD"` → "Kích phát chuyển dạ (KPCD)"

## UI Changes

### Form thêm bệnh nhân mới
```
📍 Vị trí: Sau "Thời gian chẩn đoán chuyển dạ"

[Ngày giờ ối vỡ]     [Phương pháp: CDTN/KPCD ▼]
(datetime-local)     (dropdown)

[Yếu tố nguy cơ]
(textarea - 3 rows, full width)
"VD: Tiền sản giật, tiểu đường thai kỳ, thai to, ..."
```

### Form chỉnh sửa bệnh nhân
```
Giống form thêm mới, nhưng có pre-filled data nếu đã có
```

### Patient Header Card
```
Hiển thị thông tin mới:

Row 3:
Mã BN: BN001 | Tuần thai: 39w2d | Phương pháp: CDTN

Row 4:
Chẩn đoán CD: 07/11/2025 14:00 | Ngày giờ ối vỡ: 07/11/2025 15:30

Row 5 (nếu có):
⚠️ Yếu tố nguy cơ: Tiền sản giật, tiểu đường thai kỳ
```

## Migration Steps

### Bước 1: Pull code mới
```bash
git pull origin main
```

### Bước 2: Chạy migration
```bash
cd backend
venv\Scripts\Activate.ps1  # Windows
# hoặc: source venv/bin/activate  # Linux/Mac

python manage.py db upgrade
```

### Bước 3: Restart servers
```bash
# Backend
python app.py

# Frontend (terminal mới)
cd frontend
python -m http.server 3000
```

### Bước 4: Test
1. Thêm bệnh nhân mới với các trường mới
2. Chỉnh sửa bệnh nhân cũ (các trường mới sẽ là NULL)
3. Xem patient detail header có hiển thị đúng không

## Backward Compatibility

✅ **Hoàn toàn tương thích ngược:**
- Bệnh nhân cũ: Các trường mới sẽ là NULL
- Frontend xử lý NULL gracefully:
  - `membrane_rupture_date = null` → Hiển thị "Chưa vỡ ối"
  - `labor_induction_method = null` → Hiển thị "Chưa xác định"
  - `risk_factors = null` → Không hiển thị row (ẩn hoàn toàn)

## Database Schema Changes

### Before
```sql
CREATE TABLE patients (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    room VARCHAR(10) NOT NULL,
    gestational_week VARCHAR(20) NOT NULL,
    parity VARCHAR(20) NOT NULL,
    labor_diagnosis_time DATETIME NOT NULL,
    created_at DATETIME,
    updated_at DATETIME
);
```

### After
```sql
CREATE TABLE patients (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INTEGER NOT NULL,
    room VARCHAR(10) NOT NULL,
    gestational_week VARCHAR(20) NOT NULL,
    parity VARCHAR(20) NOT NULL,
    labor_diagnosis_time DATETIME NOT NULL,
    membrane_rupture_date DATETIME,           -- NEW
    risk_factors TEXT,                        -- NEW
    labor_induction_method VARCHAR(20),       -- NEW
    created_at DATETIME,
    updated_at DATETIME
);
```

## Testing Checklist

- [x] Migration chạy thành công
- [x] Form thêm bệnh nhân có 3 trường mới
- [x] Form sửa bệnh nhân có 3 trường mới
- [x] Có thể thêm bệnh nhân với các trường mới
- [x] Có thể thêm bệnh nhân mà để trống các trường mới (optional)
- [x] Có thể sửa bệnh nhân cũ và thêm thông tin vào các trường mới
- [x] Patient header hiển thị đúng các trường mới
- [x] Null values được xử lý đúng (hiển thị fallback text)
- [x] Risk factors chỉ hiển thị khi có data
- [x] Backend API trả về đúng các trường mới
- [x] Data được lưu đúng vào database

## Notes

1. **Không breaking changes:** Code cũ vẫn hoạt động bình thường
2. **Optional fields:** Tất cả các trường mới đều không bắt buộc
3. **UI responsive:** Forms tự động adjust cho mobile
4. **Validation:** Chỉ validate required fields (name, age, etc.) - các trường mới không validate
5. **Performance:** Không ảnh hưởng performance (index không cần thiết vì không query by these fields)

## Rollback Plan

Nếu cần rollback:
```bash
cd backend
source venv/bin/activate
python manage.py db downgrade
```

Sau đó revert Git commits:
```bash
git revert HEAD
```

---

**Developed by:** IT Team - Bệnh viện Hùng Vương  
**Date:** November 7, 2025  
**Version:** 1.1.0
