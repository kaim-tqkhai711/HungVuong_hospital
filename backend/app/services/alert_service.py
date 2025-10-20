from app.models import Patient, PartogramRecord, Alert, ThresholdConfig
from app import db
from datetime import datetime, timedelta
from typing import Dict, List, Tuple


class AlertService:
    """Service for managing and generating alerts based on partogram data"""
    
    def __init__(self):
        self.thresholds = ThresholdConfig()
    
    def evaluate_partogram_record(self, record: PartogramRecord) -> List[Alert]:
        """Evaluate a partogram record and generate alerts if needed"""
        alerts = []
        
        # Check mother's vital signs
        mother_alerts = self._check_mother_vitals(record)
        alerts.extend(mother_alerts)
        
        # Check fetus status
        fetus_alerts = self._check_fetus_status(record)
        alerts.extend(fetus_alerts)
        
        # Check labor progress
        labor_alerts = self._check_labor_progress(record)
        alerts.extend(labor_alerts)
        
        # Save alerts to database
        for alert in alerts:
            db.session.add(alert)
        
        return alerts
    
    def _check_mother_vitals(self, record: PartogramRecord) -> List[Alert]:
        """Check mother's vital signs against thresholds"""
        alerts = []
        
        # Check pulse
        if record.pulse:
            if record.pulse < self.thresholds.MOTHER_THRESHOLDS['pulse']['min'] or \
               record.pulse > self.thresholds.MOTHER_THRESHOLDS['pulse']['max']:
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='mother',
                    severity='warning' if 50 <= record.pulse <= 120 else 'critical',
                    parameter='pulse',
                    value=str(record.pulse),
                    threshold=f"{self.thresholds.MOTHER_THRESHOLDS['pulse']['min']}-{self.thresholds.MOTHER_THRESHOLDS['pulse']['max']}",
                    message=f"Mạch {record.pulse} bpm - Ngoài phạm vi bình thường (60-100 bpm)"
                ))
        
        # Check blood pressure
        if record.systolic_bp:
            if record.systolic_bp > self.thresholds.MOTHER_THRESHOLDS['systolic_bp']['max']:
                severity = 'critical' if record.systolic_bp > 160 else 'warning'
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='mother',
                    severity=severity,
                    parameter='systolic_bp',
                    value=str(record.systolic_bp),
                    threshold=f"<{self.thresholds.MOTHER_THRESHOLDS['systolic_bp']['max']}",
                    message=f"Huyết áp tâm thu {record.systolic_bp} mmHg - Cao hơn bình thường"
                ))
            elif record.systolic_bp < self.thresholds.MOTHER_THRESHOLDS['systolic_bp']['min']:
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='mother',
                    severity='warning',
                    parameter='systolic_bp',
                    value=str(record.systolic_bp),
                    threshold=f">{self.thresholds.MOTHER_THRESHOLDS['systolic_bp']['min']}",
                    message=f"Huyết áp tâm thu {record.systolic_bp} mmHg - Thấp hơn bình thường"
                ))
        
        # Check temperature
        if record.temperature:
            if record.temperature > self.thresholds.MOTHER_THRESHOLDS['temperature']['max']:
                severity = 'critical' if record.temperature > 38.0 else 'warning'
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='mother',
                    severity=severity,
                    parameter='temperature',
                    value=str(record.temperature),
                    threshold=f"<{self.thresholds.MOTHER_THRESHOLDS['temperature']['max']}",
                    message=f"Nhiệt độ {record.temperature}°C - Sốt"
                ))
        
        return alerts
    
    def _check_fetus_status(self, record: PartogramRecord) -> List[Alert]:
        """Check fetus status against thresholds"""
        alerts = []
        
        # Check CTG score (highest priority)
        if record.ctg_score is not None:
            if record.ctg_score >= self.thresholds.FETUS_THRESHOLDS['ctg_score']['critical']:
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='fetus',
                    severity='critical',
                    parameter='ctg',
                    value=str(record.ctg_score),
                    threshold='<3',
                    message=f"CTG cấp {record.ctg_score} - Nguy hiểm, cần can thiệp ngay"
                ))
            elif record.ctg_score >= self.thresholds.FETUS_THRESHOLDS['ctg_score']['warning']:
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='fetus',
                    severity='warning',
                    parameter='ctg',
                    value=str(record.ctg_score),
                    threshold='<2',
                    message=f"CTG cấp {record.ctg_score} - Cần theo dõi thêm"
                ))
        
        # Check fetal heart rate
        if record.fetal_heart_rate:
            if record.fetal_heart_rate < self.thresholds.FETUS_THRESHOLDS['fetal_heart_rate']['min'] or \
               record.fetal_heart_rate > self.thresholds.FETUS_THRESHOLDS['fetal_heart_rate']['max']:
                severity = 'critical' if record.fetal_heart_rate < 100 or record.fetal_heart_rate > 180 else 'warning'
                alerts.append(Alert(
                    patient_id=record.patient_id,
                    partogram_record_id=record.id,
                    alert_type='fetus',
                    severity=severity,
                    parameter='fetal_heart_rate',
                    value=str(record.fetal_heart_rate),
                    threshold=f"{self.thresholds.FETUS_THRESHOLDS['fetal_heart_rate']['min']}-{self.thresholds.FETUS_THRESHOLDS['fetal_heart_rate']['max']}",
                    message=f"Tim thai {record.fetal_heart_rate} bpm - Ngoài phạm vi bình thường (110-160 bpm)"
                ))
        
        return alerts
    
    def _check_labor_progress(self, record: PartogramRecord) -> List[Alert]:
        """Check labor progress for potential issues"""
        alerts = []
        
        # Check for labor arrest (cervical dilation not progressing)
        if record.cervix_dilation is not None and record.time_since_dilation is not None:
            # Get previous records to calculate dilation rate
            previous_records = PartogramRecord.query.filter_by(patient_id=record.patient_id)\
                .filter(PartogramRecord.recorded_at < record.recorded_at)\
                .filter(PartogramRecord.cervix_dilation.isnot(None))\
                .order_by(PartogramRecord.recorded_at.desc())\
                .limit(2).all()
            
            if len(previous_records) >= 1:
                prev_record = previous_records[0]
                time_diff = (record.recorded_at - prev_record.recorded_at).total_seconds() / 3600  # hours
                
                if time_diff >= 2:  # Check if at least 2 hours apart
                    dilation_change = record.cervix_dilation - prev_record.cervix_dilation
                    dilation_rate = dilation_change / time_diff if time_diff > 0 else 0
                    
                    if dilation_rate < self.thresholds.LABOR_THRESHOLDS['cervix_dilation_rate']['min_rate']:
                        alerts.append(Alert(
                            patient_id=record.patient_id,
                            partogram_record_id=record.id,
                            alert_type='labor',
                            severity='warning' if dilation_rate > 0 else 'critical',
                            parameter='cervix_dilation_rate',
                            value=f"{dilation_rate:.1f} cm/h",
                            threshold=f">={self.thresholds.LABOR_THRESHOLDS['cervix_dilation_rate']['min_rate']} cm/h",
                            message=f"Tiến triển mở cổ tử cung chậm ({dilation_rate:.1f} cm/giờ) - Nguy cơ đình trệ"
                        ))
        
        return alerts
    
    def calculate_patient_status(self, patient_id: str) -> str:
        """Calculate overall patient status based on recent alerts"""
        # Get recent alerts (last 4 hours)
        cutoff_time = datetime.utcnow() - timedelta(hours=4)
        recent_alerts = Alert.query.filter(
            Alert.patient_id == patient_id,
            Alert.created_at >= cutoff_time,
            Alert.is_acknowledged == False
        ).all()
        
        # 🔥 RULE 1: CTG Score có ưu tiên tuyệt đối
        ctg_alerts = [a for a in recent_alerts if a.parameter == 'ctg']
        if ctg_alerts:
            latest_ctg = ctg_alerts[0]  # Lấy CTG mới nhất
            if latest_ctg.severity == 'critical':  # CTG = 3
                return 'critical'  # 🔴 ĐỎ - Toàn bộ thai nhi = ĐỎ
            elif latest_ctg.severity == 'warning':  # CTG = 2
                return 'warning'   # 🟡 VÀNG - Toàn bộ thai nhi = VÀNG
        
        # 🔥 RULE 2: Đếm số lần vượt ngưỡng của MẸ (không tính CTG)
        mother_alerts = [a for a in recent_alerts if a.alert_type == 'mother']
        critical_count = len([a for a in mother_alerts if a.severity == 'critical'])
        warning_count = len([a for a in mother_alerts if a.severity == 'warning'])
        total_violations = critical_count + warning_count
        
        # 🔥 RULE 3: Áp dụng quy tắc theo số lần vi phạm
        if critical_count > 0 or total_violations >= 4:
            return 'critical'  # 🔴 ĐỎ - 4-5 lần hoặc có Critical
        elif total_violations >= 1:
            return 'warning'   # 🟡 VÀNG - 1-3 lần
        else:
            return 'normal'    # 🟢 XANH - 0 lần
    
    def get_patient_alerts(self, patient_id: str, include_acknowledged: bool = False) -> List[Alert]:
        """Get all alerts for a patient"""
        query = Alert.query.filter_by(patient_id=patient_id)
        
        if not include_acknowledged:
            query = query.filter_by(is_acknowledged=False)
        
        return query.order_by(Alert.created_at.desc()).all()
    
    def acknowledge_alert(self, alert_id: int, acknowledged_by: str) -> bool:
        """Acknowledge an alert"""
        alert = Alert.query.get(alert_id)
        if alert:
            alert.is_acknowledged = True
            alert.acknowledged_at = datetime.utcnow()
            alert.acknowledged_by = acknowledged_by
            db.session.commit()
            return True
        return False
    
    def get_dashboard_summary(self) -> Dict:
        """Get summary for dashboard display"""
        # Get all patients with their current status
        patients = Patient.query.all()
        
        status_counts = {'normal': 0, 'warning': 0, 'critical': 0}
        
        for patient in patients:
            status = self.calculate_patient_status(patient.id)
            status_counts[status] += 1
        
        return {
            'total_patients': len(patients),
            'status_counts': status_counts,
            'last_updated': datetime.utcnow().isoformat()
        }