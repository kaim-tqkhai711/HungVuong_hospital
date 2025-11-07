# Database Migration Guide - Add Patient Overview Fields

## Mục đích
Thêm 3 trường mới vào bảng `patients`:
1. `membrane_rupture_date` (DateTime) - Ngày giờ ối vỡ
2. `risk_factors` (Text) - Yếu tố nguy cơ
3. `labor_induction_method` (String) - CDTN hoặc KPCD

## Cách chạy migration

### Windows PowerShell

```powershell
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Kích hoạt virtual environment
venv\Scripts\Activate.ps1

# 3. Chạy migration
python manage.py db upgrade

# Hoặc dùng flask
$env:FLASK_APP = "app.py"
flask db upgrade
```

### Linux/Mac

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Kích hoạt virtual environment
source venv/bin/activate

# 3. Chạy migration
python manage.py db upgrade

# Hoặc dùng flask
export FLASK_APP=app.py
flask db upgrade
```

## Kiểm tra migration đã chạy thành công

### Cách 1: Kiểm tra trong Python

```python
from app import create_app, db
from app.models import Patient

app = create_app()
with app.app_context():
    # Kiểm tra columns của Patient table
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    columns = inspector.get_columns('patients')
    
    print("Patient table columns:")
    for col in columns:
        print(f"  - {col['name']}: {col['type']}")
```

### Cách 2: Kiểm tra trong SQLite

```bash
# Mở database
sqlite3 instance/partogram.db

# Hiển thị schema của bảng patients
.schema patients

# Thoát
.quit
```

## Rollback (nếu cần)

```bash
# Rollback về version trước
cd backend
source venv/bin/activate  # hoặc venv\Scripts\Activate.ps1 trên Windows
python manage.py db downgrade
```

## Lưu ý quan trọng

1. **Backup database trước khi migrate:**
   ```bash
   cp instance/partogram.db instance/partogram.db.backup
   ```

2. **Các trường mới đều nullable=True:** Bệnh nhân cũ sẽ có giá trị NULL cho các trường này

3. **Không cần thêm dữ liệu mặc định:** Frontend sẽ hiển thị "Chưa vỡ ối", "Chưa xác định" cho các trường trống

4. **Migration đã được tạo sẵn:** File `add_patient_overview_fields.py` trong `migrations/versions/`

## Test sau khi migrate

1. **Test thêm bệnh nhân mới với các trường mới:**
   - Mở frontend
   - Click "Thêm bệnh nhân mới"
   - Điền thông tin bao gồm các trường mới
   - Lưu và kiểm tra

2. **Test chỉnh sửa bệnh nhân cũ:**
   - Mở bệnh nhân đã tồn tại
   - Click "Sửa thông tin"
   - Thêm thông tin vào các trường mới
   - Lưu và kiểm tra

3. **Test hiển thị:**
   - Kiểm tra header card hiển thị đúng các trường mới
   - Kiểm tra trường "Yếu tố nguy cơ" có hiển thị khi có dữ liệu

## Troubleshooting

### Lỗi: "Could not locate a Flask application"
```bash
export FLASK_APP=app.py  # hoặc $env:FLASK_APP="app.py" trên Windows
```

### Lỗi: "Target database is not up to date"
```bash
# Tạo migration mới từ model changes
flask db migrate -m "add patient overview fields"
flask db upgrade
```

### Lỗi: "Can't locate revision identified by 'add_patient_overview'"
```bash
# Xóa file migration lỗi và tạo lại
rm migrations/versions/add_patient_overview_fields.py
flask db migrate -m "add patient overview fields"
flask db upgrade
```

## Xác nhận migration thành công

Sau khi chạy migration, bạn sẽ thấy output:
```
INFO  [alembic.runtime.migration] Running upgrade 81596e522fb9 -> add_patient_overview, Add patient overview fields
```

Và khi thêm/sửa bệnh nhân trên frontend, bạn sẽ thấy 3 trường mới:
- ✅ Ngày giờ ối vỡ (datetime picker)
- ✅ Phương pháp (dropdown: CDTN/KPCD)
- ✅ Yếu tố nguy cơ (textarea)
