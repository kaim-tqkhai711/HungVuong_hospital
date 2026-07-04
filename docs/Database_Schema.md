# Database Schema — Hệ thống Partogram Bệnh viện Hùng Vương

> **Database Engine**: SQLite (development) / PostgreSQL (production)
> **ORM**: SQLAlchemy 2.0
> **Migration**: Flask-Migrate (Alembic)

Tài liệu mô tả schema thực tế của DB, không phải schema lý tưởng. Những chỗ ghi "smell" là vấn đề thiết kế đã biết, không phải điều bạn cần sửa ngay — nhưng cần biết trước khi viết migration mới đè lên.

---

## Mục lục

- [Tổng quan Entity Relationship](#tổng-quan-entity-relationship)
- [Bảng patients](#bảng-patients)
- [Bảng partogram_records](#bảng-partogram_records)
- [Bảng assessments](#bảng-assessments)
- [Bảng alerts](#bảng-alerts)
- [Bảng outcomes](#bảng-outcomes)
- [Cấu hình Threshold](#cấu-hình-threshold)

---

## Tổng quan Entity Relationship

```mermaid
erDiagram
    patients ||--o{ partogram_records : "has many"
    patients ||--o{ assessments : "has many"
    patients ||--o{ alerts : "has many"
    patients ||--o{ outcomes : "has many"
    partogram_records ||--o{ alerts : "triggers"
    partogram_records ||--o| assessments : "links to"

    patients {
        string id PK "BN001, BN002..."
        string name
        int age
        string room
        string gestational_week
        string parity
        datetime labor_diagnosis_time
        datetime membrane_rupture_date
        text risk_factors
        string labor_induction_method
        datetime created_at
        datetime updated_at
    }

    partogram_records {
        int id PK
        string patient_id FK
        datetime recorded_at
        string examination_time
        float time_since_dilation
        int pulse
        int systolic_bp
        int diastolic_bp
        float temperature
        int fetal_heart_rate
        int ctg_score
        int cervix_dilation
        int contractions_per_10min
        string recorded_by_role
    }

    assessments {
        int id PK
        string patient_id FK
        int partogram_record_id FK
        text nurse_assessment
        text doctor_assessment
        text treatment_plan
        string assessor_role
        datetime assessed_at
        string assessed_by
    }

    alerts {
        int id PK
        string patient_id FK
        int partogram_record_id FK
        string alert_type
        string severity
        string parameter
        string value
        string threshold
        text message
        boolean is_acknowledged
    }

    outcomes {
        int id PK
        string patient_id FK
        string outcome_type
        datetime delivery_time
        float baby_weight
        int apgar_1min
        int apgar_5min
    }
```

`patient_id` là String(10) làm PK cho `patients`, không phải surrogate integer key. Business ID (VD: `BN001`) và primary key là cùng một giá trị — tiện cho tra cứu qua API, nhưng nếu sau này cần đổi mã bệnh nhân (như `PUT /api/patients/<id>` hiện đang cho phép), bạn phải cascade update qua tất cả FK. Cân nhắc kỹ trước khi cho phép sửa PK tự do ở tầng API.

---

## Bảng `patients`

> Thông tin bệnh nhân sản khoa.

| Column | Type | Constraints | Mô tả |
|--------|------|------------|-------|
| `id` | `String(10)` | **PK** | Mã bệnh nhân (VD: BN001) |
| `name` | `String(100)` | NOT NULL | Họ tên |
| `age` | `Integer` | NOT NULL | Tuổi |
| `room` | `String(10)` | NOT NULL | Số phòng (VD: P301) |
| `gestational_week` | `String(20)` | NOT NULL | Tuổi thai |
| `parity` | `String(20)` | NOT NULL | Số lần sinh (VD: Para 0) |
| `labor_diagnosis_time` | `DateTime` | NOT NULL | Thời điểm chẩn đoán chuyển dạ |
| `membrane_rupture_date` | `DateTime` | NULLABLE | Ngày giờ ối vỡ |
| `risk_factors` | `Text` | NULLABLE | Yếu tố nguy cơ |
| `labor_induction_method` | `String(20)` | NULLABLE | Phương pháp (CDTN hoặc KPCD) |
| `created_at` | `DateTime` | DEFAULT `utcnow` | Thời điểm tạo |
| `updated_at` | `DateTime` | DEFAULT `utcnow`, AUTO UPDATE | Thời điểm cập nhật |

`gestational_week` là `String`, không phải số — lưu dạng "39 tuần" hoặc "38 tuần 3 ngày". Tiện cho hiển thị, nhưng không sort/so sánh được bằng SQL nếu sau này cần query kiểu "tìm bệnh nhân >= 37 tuần". Nếu cần query theo tuổi thai, sẽ phải parse string ở tầng ứng dụng hoặc thêm cột số riêng.

### Relationships

| Relationship | Target | Type | Cascade |
|-------------|--------|------|---------|
| `partogram_records` | `PartogramRecord` | One-to-Many | `all, delete-orphan` |
| `assessments` | `Assessment` | One-to-Many | `all, delete-orphan` |
| `outcomes` | `Outcome` | One-to-Many | `all, delete-orphan` |
| `alerts` | `Alert` | One-to-Many | *(backref only)* |

Chú ý `alerts` không có cascade delete — xóa patient sẽ để lại alert mồ côi trỏ vào `patient_id` không còn tồn tại, trừ khi DB có FK constraint riêng xử lý việc này. Kiểm tra lại nếu định thêm chức năng xóa patient thật sự (hiện tại API chưa có endpoint `DELETE /patients/<id>`).

### Methods

| Method | Return | Mô tả |
|--------|--------|-------|
| `to_dict()` | `dict` | Serialize sang dictionary |
| `get_current_status()` | `str` | Trạng thái hiện tại (`normal`/`warning`/`critical`) |
| `get_last_check_time()` | `datetime\|None` | Thời điểm khám cuối |

---

## Bảng `partogram_records`

> Bảng lõi của toàn hệ thống — mọi chỉ số theo dõi chuyển dạ đều nằm ở đây.

| Column | Type | Constraints | Mô tả |
|--------|------|------------|-------|
| **Identification** |
| `id` | `Integer` | **PK**, AUTO | ID tự tăng |
| `patient_id` | `String(10)` | **FK** → `patients.id`, NOT NULL | Mã bệnh nhân |
| `recorded_at` | `DateTime` | NOT NULL | Thời điểm ghi nhận |
| `examination_time` | `String(10)` | NULLABLE | Giờ khám (HH:MM) |
| `time_since_dilation` | `Float` | NULLABLE | Số giờ từ khi bắt đầu pha tích cực |
| **Chăm sóc hỗ trợ (Supportive Care)** |
| `companion` | `Boolean` | DEFAULT `False` | Có người thân đi kèm |
| `vas_score` | `Integer` | NULLABLE | Điểm đau VAS (1-10) |
| `drinking` | `Boolean` | DEFAULT `False` | Được uống nước |
| `eating` | `Boolean` | DEFAULT `False` | Được ăn |
| **Dấu hiệu sinh tồn mẹ (Mother's Vitals)** |
| `pulse` | `Integer` | NULLABLE | Mạch (bpm) |
| `systolic_bp` | `Integer` | NULLABLE | Huyết áp tâm thu (mmHg) |
| `diastolic_bp` | `Integer` | NULLABLE | Huyết áp tâm trương (mmHg) |
| `temperature` | `Float` | NULLABLE | Nhiệt độ (°C) |
| `urine` | `String(50)` | NULLABLE | Nước tiểu |
| **Theo dõi thai (Fetus Monitoring)** |
| `fetal_heart_rate` | `Integer` | NULLABLE | Nhịp tim thai (bpm) |
| `ctg_score` | `Integer` | NULLABLE | Điểm CTG (0=bình thường, 1=nghi ngờ, 2=bất thường, 3=bệnh lý) |
| `amniotic_fluid` | `String(50)` | NULLABLE | Tính chất nước ối |
| `fetal_position` | `String(50)` | NULLABLE | Ngôi thai |
| `caput` | `String(10)` | NULLABLE | Bướu huyết thanh |
| `molding` | `String(10)` | NULLABLE | Chồng xương sọ |
| **Tiến triển chuyển dạ (Labor Progress)** |
| `contractions_per_10min` | `Integer` | NULLABLE | Số cơn co/10 phút |
| `contraction_duration` | `Integer` | NULLABLE | Thời gian co (giây) |
| `cervix_dilation` | `Integer` | NULLABLE | Độ mở cổ tử cung (cm, 0-10) |
| `station` | `String(10)` | NULLABLE | Độ lọt |
| **Thuốc (Medication)** |
| `oral_medication` | `Text` | NULLABLE | Thuốc uống |
| `injection_medication` | `Text` | NULLABLE | Thuốc tiêm |
| `infusion_medication` | `Text` | NULLABLE | Thuốc truyền |
| **Đánh giá (Assessment)** |
| `nurse_assessment` | `Text` | NULLABLE | Nhận xét điều dưỡng |
| `doctor_assessment` | `Text` | NULLABLE | Nhận xét bác sĩ |
| `treatment_plan` | `Text` | NULLABLE | Kế hoạch điều trị |
| **Workflow** |
| `recorded_by_role` | `String(20)` | DEFAULT `'nurse'` | Vai trò người nhập (`nurse`/`doctor`) |
| `acknowledged_by_doctor_id` | `String(100)` | NULLABLE | Mã bác sĩ xác nhận |
| `acknowledged_at` | `DateTime` | NULLABLE | Thời điểm xác nhận |
| `doctor_signature` | `Text` | NULLABLE | Chữ ký bác sĩ (Base64 image) |
| `created_at` | `DateTime` | DEFAULT `utcnow` | Thời điểm tạo record |

Ba cột "Đánh giá" (`nurse_assessment`, `doctor_assessment`, `treatment_plan`) trùng lặp gần như 100% với bảng `assessments` bên dưới — xem phần smell ở bảng đó. `doctor_signature` lưu base64 image trực tiếp trong cột Text — hoạt động tốt với vài trăm record, nhưng nếu volume tăng, kích thước bảng sẽ phình nhanh vì ảnh chữ ký không nhỏ. Nếu cần tối ưu, tách ra object storage và chỉ lưu reference ở đây.

---

## Bảng `assessments`

> Đánh giá và kế hoạch điều trị, lưu như một bảng riêng.

| Column | Type | Constraints | Mô tả |
|--------|------|------------|-------|
| `id` | `Integer` | **PK**, AUTO | ID tự tăng |
| `patient_id` | `String(10)` | **FK** → `patients.id`, NOT NULL | Mã bệnh nhân |
| `partogram_record_id` | `Integer` | **FK** → `partogram_records.id`, NULLABLE | Liên kết record |
| `nurse_assessment` | `Text` | NULLABLE | Nhận xét điều dưỡng |
| `doctor_assessment` | `Text` | NULLABLE | Nhận xét bác sĩ |
| `treatment_plan` | `Text` | NULLABLE | Kế hoạch điều trị |
| `assessor_role` | `String(20)` | NOT NULL, DEFAULT `'doctor'` | Vai trò người đánh giá |
| `assessed_at` | `DateTime` | DEFAULT `utcnow` | Thời điểm đánh giá |
| `assessed_by` | `String(100)` | NULLABLE | Tên người đánh giá |

**Smell rõ nhất trong toàn bộ schema**: bảng này chứa gần như y hệt 3 cột assessment của `partogram_records`, không có ràng buộc nào đảm bảo hai nơi đồng bộ. Trước khi thêm feature đọc/ghi assessment, xác định trước: đâu là nguồn sự thật (source of truth)? Nếu cả hai đều đang được ghi độc lập bởi các phần khác nhau của UI, đây là data integrity risk thật sự, không chỉ là "code chưa đẹp".

---

## Bảng `alerts`

> Cảnh báo tự động do hệ thống sinh ra khi chỉ số vượt ngưỡng.

| Column | Type | Constraints | Mô tả |
|--------|------|------------|-------|
| `id` | `Integer` | **PK**, AUTO | ID tự tăng |
| `patient_id` | `String(10)` | **FK** → `patients.id`, NOT NULL | Mã bệnh nhân |
| `partogram_record_id` | `Integer` | **FK** → `partogram_records.id`, NULLABLE | Record gây ra alert |
| `alert_type` | `String(20)` | NOT NULL | Loại: `"mother"` / `"fetus"` / `"labor"` |
| `severity` | `String(10)` | NOT NULL | Mức độ: `"normal"` / `"warning"` / `"critical"` |
| `parameter` | `String(50)` | NOT NULL | Chỉ số gây alert |
| `value` | `String(50)` | NULLABLE | Giá trị thực tế |
| `threshold` | `String(50)` | NULLABLE | Ngưỡng bị vượt |
| `message` | `Text` | NOT NULL | Thông báo cảnh báo (tiếng Việt) |
| `is_acknowledged` | `Boolean` | DEFAULT `False` | Đã xác nhận chưa |
| `acknowledged_at` | `DateTime` | NULLABLE | Thời điểm xác nhận |
| `acknowledged_by` | `String(100)` | NULLABLE | Người xác nhận |
| `created_at` | `DateTime` | DEFAULT `utcnow` | Thời điểm tạo |

Bảng này không unique-constraint theo `(patient_id, parameter, created_at)` hay tương tự — mỗi lần record được đánh giá lại (update), alert cũ có thể vẫn còn tồn tại song song với alert mới cùng loại nếu code không tự dọn. Kiểm tra `AlertService` xem có logic xóa/deduplicate alert cũ trước khi insert alert mới hay không nếu bạn thấy danh sách alert phình to bất thường.

### Giá trị `parameter`

| Parameter | Alert Type | Mô tả |
|-----------|-----------|-------|
| `pulse` | `mother` | Mạch |
| `systolic_bp` | `mother` | Huyết áp tâm thu |
| `temperature` | `mother` | Nhiệt độ |
| `ctg` | `fetus` | Điểm CTG |
| `fetal_heart_rate` | `fetus` | Tim thai |
| `cervix_dilation_rate` | `labor` | Tốc độ mở cổ tử cung |
| `contractions` | `labor` | Cơn co tử cung |

`diastolic_bp` có threshold định nghĩa (xem bảng threshold bên dưới) nhưng không xuất hiện trong danh sách parameter thực tế được check — đúng như ghi chú trong `Backend_Architecture.md`, đây là tính năng chưa implement, không phải tài liệu thiếu sót.

---

## Bảng `outcomes`

> Kết cục cuối cùng (kết quả sinh).

| Column | Type | Constraints | Mô tả |
|--------|------|------------|-------|
| `id` | `Integer` | **PK**, AUTO | ID tự tăng |
| `patient_id` | `String(10)` | **FK** → `patients.id`, NOT NULL | Mã bệnh nhân |
| `outcome_type` | `String(50)` | NOT NULL | Loại kết cục (Sinh thường, Mổ lấy thai...) |
| `outcome_details` | `Text` | NULLABLE | Chi tiết kết cục |
| `delivery_time` | `DateTime` | NULLABLE | Thời điểm sinh |
| `baby_weight` | `Float` | NULLABLE | Cân nặng bé (gram) |
| `baby_gender` | `String(10)` | NULLABLE | Giới tính |
| `apgar_1min` | `Integer` | NULLABLE | Điểm Apgar phút 1 (0-10) |
| `apgar_5min` | `Integer` | NULLABLE | Điểm Apgar phút 5 (0-10) |
| `complications` | `Text` | NULLABLE | Biến chứng |
| `notes` | `Text` | NULLABLE | Ghi chú thêm |
| `recorded_at` | `DateTime` | DEFAULT `utcnow` | Thời điểm ghi nhận |
| `recorded_by` | `String(100)` | NULLABLE | Người ghi nhận |

Quan hệ với `patients` là One-to-Many trong ERD, nhưng API (`POST /api/assessments/<patient_id>/outcome`) hoạt động theo kiểu upsert — mỗi bệnh nhân trong thực tế chỉ nên có 1 outcome. Không có unique constraint nào enforce điều này ở tầng DB; nếu có race condition (hai request POST outcome gần như đồng thời), có thể tạo ra 2 row outcome cho cùng 1 patient thay vì update 1 row.

---

## Cấu hình Threshold

> Ngưỡng cảnh báo định nghĩa trong class `ThresholdConfig` — không lưu DB, hardcode trong code.

### Mother's Vital Signs

| Parameter | Min (Normal) | Max (Normal) | Warning | Critical |
|-----------|:---:|:---:|:---:|:---:|
| Mạch (bpm) | 60 | 100 | <60 or >100 | <50 or >120 |
| HA tâm thu (mmHg) | 90 | 140 | <90 or >140 | <80 or >160 |
| HA tâm trương (mmHg) | 60 | 90 | — | — |
| Nhiệt độ (°C) | 36.0 | 37.5 | >37.5 | >38.0 |

Diastolic BP có ngưỡng normal định nghĩa nhưng cột Warning/Critical để trống — vì code chưa check giá trị này (xem ghi chú ở bảng `alerts` phía trên). Đừng nhầm hai ô trống này là "không có ngưỡng lâm sàng", mà là "chưa implement".

### Fetus Monitoring

| Parameter | Min (Normal) | Max (Normal) | Warning | Critical |
|-----------|:---:|:---:|:---:|:---:|
| Tim thai (bpm) | 110 | 160 | <110 or >160 | <100 or >180 |
| CTG Score | 0 | 1 | = 2 | ≥ 3 |

### Labor Progress

| Parameter | Ngưỡng | Mô tả |
|-----------|--------|-------|
| Tốc độ mở CTC | ≥ 0.5 cm/h | Đánh giá sau ≥ 2 giờ, so với record trước |

### Quy tắc tính Status tổng thể

1. **CTG ưu tiên tuyệt đối**: CTG ≥ 3 → `critical`, CTG = 2 → `warning` — bất kể các chỉ số khác thế nào.
2. **Đếm vi phạm**: ≥1 `critical_violation` → `critical`.
3. **Warning**: ≥1 `violation` (không critical) → `warning`.
4. **Normal**: không có vi phạm nào.

Ngưỡng này hardcode trong code Python, nghĩa là thay đổi protocol lâm sàng = code change + deploy, không có audit trail về việc "ngưỡng này được đổi khi nào, bởi ai, dựa trên hướng dẫn nào". Nếu khoa sản có nhu cầu điều chỉnh ngưỡng theo thời gian, đây là ưu tiên nên chuyển sang bảng DB có versioning.
