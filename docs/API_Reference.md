# API Reference — Hệ thống Partogram Bệnh viện Hùng Vương

> **Base URL**: `http://localhost:5000/api`
> **Version**: 1.0.0
> **Content-Type**: `application/json`

Tài liệu này liệt kê tất cả endpoint hiện có, request/response thật (lấy từ code, không phải spec lý tưởng). Nếu bạn thấy chỗ nào khó hiểu hoặc không khớp với behavior thực tế, đó nhiều khả năng là bug — xem phần ghi chú ở cuối mỗi endpoint trước khi report.

---

## Mục lục

- [Quy ước chung](#quy-ước-chung)
- [Health Check](#health-check)
- [Patient API](#patient-api)
- [Partogram API](#partogram-api)
- [Assessment API](#assessment-api)

---

## Quy ước chung

### Response Format

```json
{
  "success": true|false,
  "data": { ... },          // có khi success=true
  "message": "...",         // tùy chọn
  "error": "...",           // có khi success=false
  "count": 0                // tùy endpoint, không phải lúc nào cũng có
}
```

Không có envelope version hay request-id. Nếu cần trace request qua log, tự thêm correlation ID ở tầng reverse proxy.

### HTTP Status Codes

| Code | Ý nghĩa |
|------|---------|
| `200` | Thành công |
| `201` | Tạo mới thành công |
| `400` | Request không hợp lệ (thiếu field bắt buộc) |
| `404` | Không tìm thấy tài nguyên |
| `500` | Lỗi server nội bộ |

Không có `401`/`403` vì hệ thống hiện chưa có authentication — mọi request được chấp nhận vô điều kiện. Đừng expose API này ra internet mà không có lớp auth/reverse-proxy phía trước.

### Error Response

```json
{
  "success": false,
  "error": "Mô tả lỗi bằng tiếng Việt",
  "message": "Chi tiết lỗi kỹ thuật"
}
```

`error` là message hiển thị cho người dùng cuối, `message` là debug detail. Không nhất quán 100% giữa các endpoint — một số chỗ chỉ trả `error`, không có `message`.

---

## Health Check

### `GET /api/health`

Kiểm tra server còn sống. Không kiểm tra kết nối DB — server có thể trả `healthy` trong khi DB down.

**Response `200`**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T10:30:00",
  "version": "1.0.0"
}
```

---

## Patient API

> **Prefix**: `/api/patients`

---

### `GET /api/patients/`

Lấy danh sách tất cả bệnh nhân kèm trạng thái hiện tại. Không phân trang — với vài chục bệnh nhân thì ổn, nhưng nếu số lượng patient tăng lên hàng nghìn, endpoint này sẽ chậm dần vì load toàn bộ + tính status real-time cho từng người.

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "BN001",
      "name": "Nguyễn Thị Hồng",
      "age": 28,
      "room": "P301",
      "gestational_week": "39 tuần",
      "parity": "Para 0",
      "labor_diagnosis_time": "2025-11-07T04:30:00",
      "membrane_rupture_date": null,
      "risk_factors": null,
      "labor_induction_method": null,
      "created_at": "2025-11-07T03:00:00",
      "updated_at": "2025-11-07T10:00:00",
      "status": "warning",
      "last_check": "30 phút trước",
      "alerts": [
        {
          "alert_type": "mother",
          "severity": "warning",
          "parameter": "systolic_bp",
          "value": "145",
          "message": "Huyết áp tâm thu 145 mmHg - Cao hơn bình thường"
        }
      ]
    }
  ],
  "count": 3
}
```

**Ghi chú**:
- `status` được tính real-time từ record mới nhất: `"normal"` | `"warning"` | `"critical"` — không cache, nên mỗi lần gọi endpoint này là N query tính status (N = số bệnh nhân).
- `last_check` là chuỗi đã format sẵn ("X phút trước"), không phải timestamp — không dùng được để sort ở client.
- `alerts` chỉ chứa tối đa 3 alert mới nhất của record cuối. Muốn xem đầy đủ, gọi `/api/patients/<id>/alerts`.

---

### `POST /api/patients/`

Tạo bệnh nhân mới.

**Request Body** (tất cả bắt buộc):
```json
{
  "id": "BN004",
  "name": "Phạm Thị Hoa",
  "age": 30,
  "room": "P304",
  "gestational_week": "38 tuần 3 ngày",
  "parity": "Para 1",
  "labor_diagnosis_time": "2025-11-07T08:00:00"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `id` | `string(10)` | ✅ | Mã bệnh nhân (VD: BN001) |
| `name` | `string(100)` | ✅ | Họ tên bệnh nhân |
| `age` | `integer` | ✅ | Tuổi |
| `room` | `string(10)` | ✅ | Phòng (VD: P301) |
| `gestational_week` | `string(20)` | ✅ | Tuổi thai (VD: "39 tuần") |
| `parity` | `string(20)` | ✅ | Số lần sinh (VD: "Para 0") |
| `labor_diagnosis_time` | `ISO 8601` | ✅ | Thời điểm chẩn đoán chuyển dạ |

Validation chỉ check field có mặt hay không, không check type hay range — gửi `age: "abc"` hoặc `age: -5` vẫn có thể lọt qua tùy driver serialize. Đừng tin tưởng input này ở tầng service.

**Response `201`**:
```json
{
  "success": true,
  "data": { "id": "BN004", "name": "Phạm Thị Hoa", "..." },
  "message": "Tạo bệnh nhân thành công"
}
```

**Response `400`** (thiếu field):
```json
{
  "success": false,
  "error": "Thiếu trường bắt buộc: age"
}
```

---

### `GET /api/patients/<patient_id>`

Lấy chi tiết bệnh nhân — tất cả records, assessments, alerts trong một response duy nhất. Với bệnh nhân đã nằm viện lâu và có nhiều record, payload này có thể lớn; chưa có giới hạn hay lazy-load.

**Path Parameters**:
| Param | Type | Mô tả |
|-------|------|-------|
| `patient_id` | `string` | Mã bệnh nhân (VD: BN001) |

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "id": "BN001",
    "name": "Nguyễn Thị Hồng",
    "status": "warning",
    "partogram_records": [ { "..." } ],
    "assessments": [ { "..." } ],
    "alerts": [ { "..." } ]
  }
}
```

**Response `404`**:
```json
{
  "success": false,
  "error": "Không tìm thấy bệnh nhân"
}
```

---

### `PUT /api/patients/<patient_id>`

Cập nhật thông tin bệnh nhân. Body yêu cầu đầy đủ field như POST — không hỗ trợ partial update (khác với PUT của Partogram/Assessment, vốn cho phép gửi field lẻ). Không nhất quán giữa các resource, cẩn thận khi tích hợp client.

**Request Body**:
```json
{
  "id": "BN001",
  "name": "Nguyễn Thị Hồng (Updated)",
  "age": 28,
  "room": "P305",
  "gestational_week": "39 tuần 2 ngày",
  "parity": "Para 0",
  "labor_diagnosis_time": "2025-11-07T04:30:00"
}
```

**Ghi chú**: Nếu đổi `id`, hệ thống check trùng lặp và trả `400` nếu mã mới đã tồn tại. Đổi PK của một entity đang có nhiều FK trỏ vào (records, assessments, alerts) qua REST là thiết kế rủi ro — cân nhắc khóa field này lại thay vì cho sửa tự do.

**Response `200`**:
```json
{
  "success": true,
  "data": { "..." },
  "message": "Cập nhật thông tin bệnh nhân thành công"
}
```

---

### `GET /api/patients/dashboard/summary`

Thống kê tổng quan cho Dashboard.

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "total_patients": 3,
    "status_counts": {
      "normal": 1,
      "warning": 1,
      "critical": 1
    },
    "last_updated": "2025-11-07T10:30:00"
  }
}
```

---

### `GET /api/patients/<patient_id>/alerts`

Danh sách cảnh báo của bệnh nhân.

**Query Parameters**:
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `include_acknowledged` | `string` | `"false"` | Bao gồm cảnh báo đã xác nhận |

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "patient_id": "BN001",
      "partogram_record_id": 5,
      "alert_type": "mother",
      "severity": "warning",
      "parameter": "systolic_bp",
      "value": "145",
      "threshold": "<140",
      "message": "Huyết áp tâm thu 145 mmHg - Cao hơn bình thường",
      "is_acknowledged": false,
      "acknowledged_at": null,
      "acknowledged_by": null,
      "created_at": "2025-11-07T10:30:00"
    }
  ],
  "count": 2
}
```

---

### `POST /api/patients/alerts/<alert_id>/acknowledge`

Xác nhận (acknowledge) một cảnh báo.

**Request Body**:
```json
{
  "acknowledged_by": "BS. Nguyễn Văn A"
}
```

| Field | Type | Default | Mô tả |
|-------|------|---------|-------|
| `acknowledged_by` | `string` | `"Unknown User"` | Người xác nhận |

Không có xác thực danh tính người gọi — `acknowledged_by` là free-text client gửi lên, ai cũng có thể tự xưng là bác sĩ khác. Nếu đây là dữ liệu cần audit trail đáng tin, cần gắn với session/user thật, không phải string tự khai.

**Response `200`**:
```json
{
  "success": true,
  "message": "Đã xác nhận cảnh báo"
}
```

---

## Partogram API

> **Prefix**: `/api/partogram`

---

### `GET /api/partogram/<patient_id>/records`

Tất cả bản ghi partogram của bệnh nhân, không phân trang, không lọc theo khoảng thời gian.

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "patient_id": "BN001",
      "recorded_at": "2025-11-07T07:30:00",
      "examination_time": "07:30",
      "time_since_dilation": 3.0,
      "supportive_care": {
        "companion": true,
        "vas_score": 5,
        "vas": 5,
        "drinking": true,
        "eating": false
      },
      "mother": {
        "pulse": 88,
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "temperature": 36.8,
        "urine": "trong"
      },
      "fetus": {
        "fetal_heart_rate": 145,
        "ctg_score": 1,
        "amniotic_fluid": "trong",
        "fetal_position": "chỏm",
        "caput": "0",
        "molding": "0"
      },
      "labor": {
        "contractions_per_10min": 4,
        "contraction_duration": 40,
        "cervix_dilation": 5,
        "station": "-2"
      },
      "medication": {
        "oral": null,
        "injection": null,
        "infusion": "Oxytocin 5UI"
      },
      "assessment": {
        "nurse_assessment": "Sản phụ tỉnh, tiến triển tốt",
        "doctor_assessment": null,
        "treatment_plan": null
      },
      "recorded_by_role": "nurse",
      "acknowledged_by_doctor_id": null,
      "acknowledged_at": null,
      "doctor_signature": null,
      "created_at": "2025-11-07T07:30:00"
    }
  ]
}
```

Lưu ý `vas_score` xuất hiện lặp lại trong `supportive_care` với 2 key khác nhau (`vas_score` và `vas`) cho cùng một giá trị — không phải typo trong tài liệu, đây là behavior thật của `to_dict()`. Đừng ngạc nhiên khi thấy trong response.

---

### `POST /api/partogram/<patient_id>/records`

Thêm bản ghi partogram mới. Hệ thống tự động đánh giá và tạo alert nếu chỉ số vượt ngưỡng — không cần gọi thêm endpoint nào khác để trigger alert.

Chú ý: request body ở đây là **flat** (mọi field ở top-level), trong khi response của `GET .../records` ở trên lại **nested** theo nhóm (`mother`, `fetus`, `labor`, ...). Đây không phải hai format tương đương, mà là input schema và output schema khác nhau của cùng một resource — nếu bạn build client generic theo kiểu "response shape = request shape", nó sẽ vỡ ở đây.

**Request Body** (tất cả tùy chọn):
```json
{
  "recorded_at": "2025-11-07T10:00:00",
  "examination_time": "10:00",
  "time_since_dilation": 5.5,
  "recorded_by_role": "nurse",

  "companion": true,
  "vas_score": 6,
  "drinking": true,
  "eating": false,

  "pulse": 92,
  "systolic_bp": 130,
  "diastolic_bp": 85,
  "temperature": 37.0,
  "urine": "trong",

  "fetal_heart_rate": 150,
  "ctg_score": 1,
  "amniotic_fluid": "trong",
  "fetal_position": "chỏm",
  "caput": "0",
  "molding": "0",

  "contractions_per_10min": 4,
  "contraction_duration": 45,
  "cervix_dilation": 6,
  "station": "-1",

  "oral_medication": null,
  "injection_medication": null,
  "infusion_medication": "Oxytocin 5UI",

  "nurse_assessment": "Sản phụ tỉnh, chuyển dạ tiến triển",
  "doctor_assessment": null,
  "treatment_plan": null
}
```

| Field | Type | Mô tả |
|-------|------|-------|
| `recorded_at` | `ISO 8601` | Thời điểm ghi nhận |
| `examination_time` | `string(10)` | Giờ khám (HH:MM) |
| `time_since_dilation` | `float` | Số giờ kể từ bắt đầu pha tích cực |
| `recorded_by_role` | `string` | `"nurse"` hoặc `"doctor"` |
| `companion` | `boolean` | Có người thân đi kèm |
| `vas_score` | `integer` | Điểm đau VAS (1-10) |
| `drinking` / `eating` | `boolean` | Uống nước / Ăn |
| `pulse` | `integer` | Mạch (bpm) |
| `systolic_bp` | `integer` | Huyết áp tâm thu (mmHg) |
| `diastolic_bp` | `integer` | Huyết áp tâm trương (mmHg) |
| `temperature` | `float` | Nhiệt độ (°C) |
| `urine` | `string` | Nước tiểu |
| `fetal_heart_rate` | `integer` | Tim thai (bpm) |
| `ctg_score` | `integer` | Điểm CTG (0-3) |
| `amniotic_fluid` | `string` | Dịch ối |
| `fetal_position` | `string` | Ngôi thai |
| `caput` | `string` | Bướu huyết thanh |
| `molding` | `string` | Chồng xương sọ |
| `contractions_per_10min` | `integer` | Số cơn co/10 phút |
| `contraction_duration` | `integer` | Thời gian co (giây) |
| `cervix_dilation` | `integer` | Độ mở cổ tử cung (cm) |
| `station` | `string` | Độ lọt |
| `oral_medication` | `text` | Thuốc uống |
| `injection_medication` | `text` | Thuốc tiêm |
| `infusion_medication` | `text` | Thuốc truyền |
| `nurse_assessment` | `text` | Nhận xét điều dưỡng |
| `doctor_assessment` | `text` | Nhận xét bác sĩ |
| `treatment_plan` | `text` | Kế hoạch điều trị |

**Response `201`**:
```json
{
  "success": true,
  "data": { "..." },
  "message": "Thêm dữ liệu khám thành công"
}
```

---

### `PUT /api/partogram/records/<record_id>`

Cập nhật bản ghi partogram — chỉ cần gửi field muốn đổi (partial update, khác PUT của Patient). Alert được re-evaluate ngay sau khi cập nhật, không phải cron job hay job riêng.

```json
{
  "pulse": 85,
  "systolic_bp": 125,
  "nurse_assessment": "Cập nhật: Sản phụ ổn định"
}
```

**Response `200`**:
```json
{
  "success": true,
  "data": { "..." },
  "message": "Cập nhật dữ liệu thành công"
}
```

---

### `DELETE /api/partogram/records/<record_id>`

Xóa bản ghi partogram. Hard delete — không soft-delete, không audit log của record đã xóa. Với dữ liệu lâm sàng, cân nhắc xem có nên giữ lại lịch sử thay vì xóa cứng hay không.

**Response `200`**:
```json
{
  "success": true,
  "message": "Xóa dữ liệu thành công"
}
```

---

### `POST /api/partogram/records/<record_id>/acknowledge`

Bác sĩ xác nhận bản ghi, đính kèm y lệnh và chữ ký.

```json
{
  "doctor_id": "BS001",
  "treatment_plan": "Tiếp tục theo dõi, tăng Oxytocin nếu cần",
  "signature_data": "data:image/png;base64,iVBOR..."
}
```

| Field | Type | Default | Mô tả |
|-------|------|---------|-------|
| `doctor_id` | `string` | `"doc_demo"` | Mã bác sĩ |
| `treatment_plan` | `text` | `null` | Y lệnh / Kế hoạch điều trị |
| `signature_data` | `text` | `null` | Chữ ký dạng Base64 |

Default `doctor_id` là `"doc_demo"` — nghĩa là nếu client quên gửi field này, record vẫn được "xác nhận" bởi một tài khoản giả. Đây là hành vi nguy hiểm cho một hệ thống lâm sàng, nên fail loud (400) thay vì fallback âm thầm.

**Response `200`**:
```json
{
  "success": true,
  "data": { "..." },
  "message": "Đã xác nhận dữ liệu thành công"
}
```

---

### `GET /api/partogram/<patient_id>/timeline`

Dữ liệu timeline cho biểu đồ partogram.

**Query Parameters**:
| Param | Type | Default | Giá trị hợp lệ | Mô tả |
|-------|------|---------|----------------|-------|
| `zoom` | `string` | `"1h"` | `"30m"`, `"1h"`, `"2h"`, `"4h"` | Mức zoom thời gian |

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "timeline": [
      {
        "time": "2025-11-07T07:30:00",
        "time_since_dilation": 3.0,
        "data": {
          "pulse": { "value": 88, "status": "normal" },
          "systolic_bp": { "value": 165, "status": "critical" },
          "fetal_heart_rate": { "value": 145, "status": "normal" },
          "ctg_score": { "value": 1, "status": "normal" },
          "cervix_dilation": { "value": 5, "status": "normal" }
        }
      }
    ],
    "parameters": [
      { "key": "pulse", "label": "Mạch (bpm)", "category": "mother", "type": "line" },
      { "key": "systolic_bp", "label": "HA tâm thu (mmHg)", "category": "mother", "type": "line" },
      { "key": "temperature", "label": "Nhiệt độ (°C)", "category": "mother", "type": "line" },
      { "key": "fetal_heart_rate", "label": "Tim thai (bpm)", "category": "fetus", "type": "line" },
      { "key": "ctg_score", "label": "CTG", "category": "fetus", "type": "points" },
      { "key": "cervix_dilation", "label": "Mở cổ tử cung (cm)", "category": "labor", "type": "line" },
      { "key": "contractions_per_10min", "label": "Cơn co/10p", "category": "labor", "type": "points" }
    ],
    "alerts": [
      {
        "time": "2025-11-07T07:30:00",
        "parameter": "systolic_bp",
        "severity": "critical",
        "message": "Huyết áp tâm thu 165 mmHg - Cao hơn bình thường",
        "value": "165"
      }
    ],
    "time_range": {
      "start": "2025-11-07T04:30:00",
      "end": "2025-11-07T10:30:00",
      "interval_hours": 1.0
    }
  }
}
```

---

### `GET /api/partogram/<patient_id>/chart-data`

Dữ liệu biểu đồ, nhiều loại view khác nhau.

**Query Parameters**:
| Param | Type | Default | Giá trị hợp lệ | Mô tả |
|-------|------|---------|----------------|-------|
| `type` | `string` | `"timeline"` | `"timeline"`, `"table"`, `"overview"` | Loại biểu đồ |
| `zoom` | `string` | `"1h"` | `"30m"`, `"1h"`, `"2h"`, `"4h"` | Mức zoom (cho timeline) |

**Response `200`**:
```json
{
  "success": true,
  "data": { "..." },
  "chart_type": "timeline"
}
```

---

### `GET /api/partogram/<patient_id>/export`

Xuất dữ liệu partogram.

**Query Parameters**:
| Param | Type | Default | Mô tả |
|-------|------|---------|-------|
| `format` | `string` | `"json"` | Định dạng xuất (hiện chỉ hỗ trợ JSON) |

> **Broken**: endpoint này crash. Dòng 219 của `partogram_views.py` gọi `partogram_service.alert_service.alert_service.datetime` — attribute chain sai (double `.alert_service`), sẽ raise `AttributeError` bất kể input. CSV/PDF cũng chưa implement. Đừng gọi endpoint này ở production cho tới khi bug được fix.

---

## Assessment API

> **Prefix**: `/api/assessments`

---

### `GET /api/assessments/<patient_id>`

Tất cả đánh giá của bệnh nhân.

**Response `200`**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "patient_id": "BN001",
      "partogram_record_id": 5,
      "nurse_assessment": "Sản phụ tỉnh, tiến triển tốt",
      "doctor_assessment": "Đồng ý nhận xét, tiếp tục theo dõi",
      "treatment_plan": "Tăng Oxytocin nếu sau 2 giờ không tiến triển",
      "assessor_role": "doctor",
      "assessed_at": "2025-11-07T10:30:00",
      "assessed_by": "BS. Nguyễn Văn A"
    }
  ],
  "count": 1
}
```

---

### `POST /api/assessments/<patient_id>`

Tạo đánh giá mới. Lưu ý: `nurse_assessment`/`doctor_assessment`/`treatment_plan` cũng tồn tại trên `PartogramRecord` — hai nơi lưu cùng loại dữ liệu, không có ràng buộc đồng bộ giữa chúng. Nếu bạn update một bên mà quên bên kia, hai nguồn sẽ lệch nhau âm thầm.

```json
{
  "partogram_record_id": 5,
  "nurse_assessment": "Sản phụ tỉnh, chuyển dạ tiến triển",
  "doctor_assessment": "Đồng ý, tiếp tục theo dõi",
  "treatment_plan": "Duy trì Oxytocin, khám lại sau 2 giờ",
  "assessed_by": "BS. Nguyễn Văn A"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `partogram_record_id` | `integer` | ❌ | ID bản ghi partogram liên quan |
| `nurse_assessment` | `text` | ❌ | Nhận xét điều dưỡng |
| `doctor_assessment` | `text` | ❌ | Nhận xét bác sĩ |
| `treatment_plan` | `text` | ❌ | Kế hoạch điều trị |
| `assessed_by` | `string` | ❌ | Người đánh giá (default: "Unknown User") |

**Response `201`**:
```json
{
  "success": true,
  "data": { "..." },
  "message": "Tạo đánh giá thành công"
}
```

---

### `PUT /api/assessments/<assessment_id>`

Cập nhật đánh giá — partial update, chỉ gửi field muốn đổi.

```json
{
  "doctor_assessment": "Cập nhật: Cần theo dõi sát hơn",
  "treatment_plan": "Chuyển mổ lấy thai nếu không tiến triển sau 1 giờ"
}
```

**Response `200`**:
```json
{
  "success": true,
  "data": { "..." },
  "message": "Cập nhật đánh giá thành công"
}
```

---

### `GET /api/assessments/<patient_id>/outcome`

Kết cục cuối cùng (outcome) của bệnh nhân.

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "patient_id": "BN001",
    "outcome_type": "Sinh thường",
    "outcome_details": "Sinh thường ngôi chỏm",
    "delivery_time": "2025-11-07T14:00:00",
    "baby_weight": 3200.0,
    "baby_gender": "Nữ",
    "apgar_1min": 8,
    "apgar_5min": 9,
    "complications": null,
    "notes": "Mẹ và bé khỏe mạnh",
    "recorded_at": "2025-11-07T14:30:00",
    "recorded_by": "BS. Trần Thị B"
  }
}
```

**Response `404`** (chưa có kết cục):
```json
{
  "success": false,
  "error": "Chưa có kết cục"
}
```

---

### `POST /api/assessments/<patient_id>/outcome`

Upsert — nếu đã có outcome thì update, chưa có thì tạo mới. Endpoint không phân biệt hai case này bằng status code khác nhau một cách nhất quán ở mọi field, nên đừng dựa vào status code để suy luận "đây là lần đầu ghi outcome".

```json
{
  "outcome_type": "Sinh thường",
  "outcome_details": "Sinh thường ngôi chỏm",
  "delivery_time": "2025-11-07T14:00:00",
  "baby_weight": 3200,
  "baby_gender": "Nữ",
  "apgar_1min": 8,
  "apgar_5min": 9,
  "complications": null,
  "notes": "Mẹ và bé khỏe mạnh",
  "recorded_by": "BS. Trần Thị B"
}
```

| Field | Type | Required | Mô tả |
|-------|------|----------|-------|
| `outcome_type` | `string(50)` | ✅ | Loại kết cục (Sinh thường, Mổ lấy thai, ...) |
| `outcome_details` | `text` | ❌ | Chi tiết |
| `delivery_time` | `ISO 8601` | ❌ | Thời điểm sinh |
| `baby_weight` | `float` | ❌ | Cân nặng em bé (gram) |
| `baby_gender` | `string(10)` | ❌ | Giới tính (Nam/Nữ) |
| `apgar_1min` | `integer` | ❌ | Điểm Apgar phút 1 |
| `apgar_5min` | `integer` | ❌ | Điểm Apgar phút 5 |
| `complications` | `text` | ❌ | Biến chứng |
| `notes` | `text` | ❌ | Ghi chú |
| `recorded_by` | `string` | ❌ | Người ghi nhận |

**Response `201`** (tạo mới) hoặc **`200`** (cập nhật):
```json
{
  "success": true,
  "data": { "..." },
  "message": "Lưu kết cục thành công"
}
```

---

### `GET /api/assessments/<patient_id>/status`

Đánh giá tổng hợp tình trạng bệnh nhân, phân loại theo mẹ/thai/chuyển dạ. Đây là aggregate được tính lại mỗi lần gọi (không cache) — nếu dashboard poll endpoint này liên tục cho nhiều bệnh nhân, tính lại toàn bộ mỗi lần là điểm cần để ý khi scale.

**Response `200`**:
```json
{
  "success": true,
  "data": {
    "overall_status": "warning",
    "mother_status": "warning",
    "fetus_status": "normal",
    "labor_status": "normal",
    "alert_counts": {
      "total": 2,
      "critical": 0,
      "warning": 2,
      "mother": 1,
      "fetus": 0,
      "labor": 1
    },
    "recommendations": [
      "Cần theo dõi thêm - Tăng tần suất monitoring"
    ]
  }
}
```

**Ghi chú về `recommendations`** — được sinh từ rule cứng trong code, không phải LLM hay hệ chuyên gia:
- `critical` → `"CẦN CAN THIỆP NGAY - Liên hệ bác sĩ trực"`
- `warning` → `"Cần theo dõi thêm - Tăng tần suất monitoring"`
- `fetus_status == critical` → `"Thai nhi có nguy cơ cao - Xem xét can thiệp sản khoa"`
