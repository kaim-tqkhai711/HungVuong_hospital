# API Documentation - Hệ thống theo dõi Chuyển dạ

## Base URL
```
http://127.0.0.1:5000/api
```

## Authentication
Hiện tại API không yêu cầu authentication. Trong production nên thêm JWT hoặc session-based auth.

## Response Format
Tất cả API responses đều có format:

```json
{
    "success": boolean,
    "data": object|array|null,
    "error": string|null,
    "message": string|null,
    "count": number (for list endpoints)
}
```

## Health Check

### GET /health
Kiểm tra tình trạng server

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2025-10-16T10:30:00.000Z",
    "version": "1.0.0"
}
```

---

## Patients Endpoints

### GET /patients/
Lấy danh sách tất cả bệnh nhân với trạng thái hiện tại

**Response:**
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
            "labor_diagnosis_time": "2025-10-16T03:00:00.000Z",
            "status": "critical",
            "last_check": "10 phút trước",
            "alerts": [
                {
                    "id": 1,
                    "severity": "critical",
                    "message": "Huyết áp cao 160/100 mmHg",
                    "parameter": "systolic_bp",
                    "created_at": "2025-10-16T09:20:00.000Z"
                }
            ]
        }
    ],
    "count": 1
}
```

### POST /patients/
Tạo bệnh nhân mới

**Request Body:**
```json
{
    "id": "BN004",
    "name": "Phạm Thị Linh",
    "age": 30,
    "room": "P304",
    "gestational_week": "38 tuần 3 ngày",
    "parity": "Para 1",
    "labor_diagnosis_time": "2025-10-16T08:00:00.000Z"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": "BN004",
        "name": "Phạm Thị Linh",
        // ... other patient fields
    },
    "message": "Tạo bệnh nhân thành công"
}
```

### GET /patients/{patient_id}
Lấy thông tin chi tiết bệnh nhân

**Response:**
```json
{
    "success": true,
    "data": {
        "id": "BN001",
        "name": "Nguyễn Thị Hồng",
        "age": 28,
        "room": "P301",
        "gestational_week": "39 tuần",
        "parity": "Para 0",
        "labor_diagnosis_time": "2025-10-16T03:00:00.000Z",
        "status": "critical",
        "partogram_records": [
            {
                "id": 1,
                "recorded_at": "2025-10-16T06:00:00.000Z",
                "time_since_dilation": 3.0,
                "mother": {
                    "pulse": 88,
                    "systolic_bp": 165,
                    "diastolic_bp": 95,
                    "temperature": 36.8,
                    "urine": "Bình thường"
                },
                "fetus": {
                    "fetal_heart_rate": 145,
                    "ctg_score": 3,
                    "amniotic_fluid": "Trong",
                    "fetal_position": "Chẩm trước"
                },
                "labor": {
                    "contractions_per_10min": 4,
                    "contraction_duration": 45,
                    "cervix_dilation": 4,
                    "station": "-2"
                }
            }
        ],
        "assessments": [],
        "alerts": []
    }
}
```

### GET /patients/dashboard/summary
Lấy thống kê tổng quan cho dashboard

**Response:**
```json
{
    "success": true,
    "data": {
        "total_patients": 5,
        "status_counts": {
            "normal": 2,
            "warning": 2,
            "critical": 1
        },
        "last_updated": "2025-10-16T09:30:00.000Z"
    }
}
```

### GET /patients/{patient_id}/alerts
Lấy danh sách cảnh báo của bệnh nhân

**Query Parameters:**
- `include_acknowledged`: boolean (default: false)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "patient_id": "BN001",
            "alert_type": "mother",
            "severity": "critical",
            "parameter": "systolic_bp",
            "value": "165",
            "threshold": "<140",
            "message": "Huyết áp tâm thu 165 mmHg - Cao hơn bình thường",
            "is_acknowledged": false,
            "created_at": "2025-10-16T09:20:00.000Z"
        }
    ],
    "count": 1
}
```

### POST /patients/alerts/{alert_id}/acknowledge
Xác nhận cảnh báo

**Request Body:**
```json
{
    "acknowledged_by": "BS. Nguyễn Văn A"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Đã xác nhận cảnh báo"
}
```

---

## Partogram Endpoints

### GET /partogram/{patient_id}/records
Lấy tất cả bản ghi partogram của bệnh nhân

### POST /partogram/{patient_id}/records
Thêm bản ghi partogram mới

**Request Body:**
```json
{
    "recorded_at": "2025-10-16T10:00:00.000Z",
    "time_since_dilation": 4.0,
    "supportive_care": {
        "companion": true,
        "vas_score": 5,
        "drinking": true,
        "eating": false
    },
    "mother": {
        "pulse": 85,
        "systolic_bp": 130,
        "diastolic_bp": 80,
        "temperature": 36.9,
        "urine": "Bình thường"
    },
    "fetus": {
        "fetal_heart_rate": 150,
        "ctg_score": 1,
        "amniotic_fluid": "Trong",
        "fetal_position": "Chẩm trước",
        "caput": "0",
        "molding": "0"
    },
    "labor": {
        "contractions_per_10min": 4,
        "contraction_duration": 50,
        "cervix_dilation": 5,
        "station": "-1"
    },
    "medication": {
        "oral": "-",
        "injection": "-",
        "infusion": "Ringer Lactate 500ml"
    }
}
```

### PUT /partogram/records/{record_id}
Cập nhật bản ghi partogram

### DELETE /partogram/records/{record_id}
Xóa bản ghi partogram

### GET /partogram/{patient_id}/timeline
Lấy dữ liệu timeline cho visualization

**Query Parameters:**
- `zoom`: string (30m, 1h, 2h, 4h) - default: 1h

**Response:**
```json
{
    "success": true,
    "data": {
        "timeline": [
            {
                "time": "2025-10-16T06:00:00.000Z",
                "time_since_dilation": 3.0,
                "data": {
                    "pulse": {
                        "value": 88,
                        "status": "normal"
                    },
                    "systolic_bp": {
                        "value": 165,
                        "status": "critical"
                    },
                    "fetal_heart_rate": {
                        "value": 145,
                        "status": "normal"
                    },
                    "ctg_score": {
                        "value": 3,
                        "status": "critical"
                    }
                }
            }
        ],
        "parameters": [
            {
                "key": "pulse",
                "label": "Mạch (bpm)",
                "category": "mother",
                "type": "line"
            }
        ],
        "alerts": [
            {
                "time": "2025-10-16T06:00:00.000Z",
                "parameter": "systolic_bp",
                "severity": "critical",
                "message": "Huyết áp cao"
            }
        ],
        "time_range": {
            "start": "2025-10-16T03:00:00.000Z",
            "end": "2025-10-16T09:00:00.000Z",
            "interval_hours": 1.0
        }
    }
}
```

---

## Assessment Endpoints

### GET /assessments/{patient_id}
Lấy tất cả đánh giá của bệnh nhân

### POST /assessments/{patient_id}
Tạo đánh giá mới

**Request Body:**
```json
{
    "partogram_record_id": 1,
    "nurse_assessment": "Sản phụ vào giai đoạn đầu chuyển dạ...",
    "doctor_assessment": "Thai nhi tình trạng ổn định...",
    "treatment_plan": "Theo dõi tiến triển chuyển dạ...",
    "assessed_by": "BS. Nguyễn Văn A"
}
```

### PUT /assessments/{assessment_id}
Cập nhật đánh giá

### GET /assessments/{patient_id}/outcome
Lấy kết cục của bệnh nhân

### POST /assessments/{patient_id}/outcome
Lưu kết cục

**Request Body:**
```json
{
    "outcome_type": "sinh-thuong",
    "outcome_details": "Sinh thường thành công",
    "delivery_time": "2025-10-16T12:30:00.000Z",
    "baby_weight": 3.2,
    "baby_gender": "Nữ",
    "apgar_1min": 8,
    "apgar_5min": 9,
    "complications": "",
    "notes": "Mẹ và con khỏe mạnh",
    "recorded_by": "BS. Nguyễn Văn A"
}
```

### GET /assessments/{patient_id}/status
Lấy đánh giá tình trạng tổng thể

**Response:**
```json
{
    "success": true,
    "data": {
        "overall_status": "critical",
        "mother_status": "warning",
        "fetus_status": "critical",
        "labor_status": "normal",
        "alert_counts": {
            "total": 3,
            "critical": 1,
            "warning": 2,
            "mother": 1,
            "fetus": 1,
            "labor": 1
        },
        "recommendations": [
            "CẦN CAN THIỆP NGAY - Liên hệ bác sĩ trực",
            "Thai nhi có nguy cơ cao - Xem xét can thiệp sản khoa"
        ]
    }
}
```

---

## Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request - Invalid input data
- **404**: Not Found - Resource doesn't exist
- **500**: Internal Server Error

## Error Handling

Tất cả errors đều trả về format:
```json
{
    "success": false,
    "error": "Mô tả lỗi tiếng Việt",
    "message": "Chi tiết kỹ thuật (nếu có)"
}
```

## Business Rules

### Alert System Rules

#### Mother Status:
- **Normal (0 violations)**: Xanh
- **Warning (1-3 violations)**: Vàng 
- **Critical (4+ violations or any critical violation)**: Đỏ

#### Fetus Status:
- **CTG Score 3**: Đỏ (override tất cả)
- **CTG Score 2**: Vàng (override tất cả)
- **CTG Score 0-1**: Theo quy tắc chung

#### Thresholds:

**Mother:**
- Pulse: 60-100 bpm (warning: 50-120)
- Systolic BP: 90-140 mmHg (critical: >160)
- Temperature: 36.0-37.5°C (critical: >38.0)

**Fetus:**
- Heart Rate: 110-160 bpm (critical: <100 or >180)
- CTG: 0-1 normal, 2 warning, 3 critical

**Labor:**
- Cervix dilation rate: ≥0.5 cm/hour

## Rate Limiting

Hiện tại chưa có rate limiting. Trong production nên thêm:
- 100 requests/minute cho read operations
- 20 requests/minute cho write operations

## Caching

Recommend caching:
- Dashboard summary: 1 minute
- Patient list: 30 seconds  
- Timeline data: 2 minutes