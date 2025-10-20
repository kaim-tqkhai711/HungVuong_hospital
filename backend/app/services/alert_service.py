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
        """Calculate overall patient status based on LATEST partogram record only"""
        from app.models import PartogramRecord
        
        # 🚨 FIX: Get only the LATEST partogram record instead of all recent alerts
        latest_record = PartogramRecord.query.filter_by(patient_id=patient_id)\
            .order_by(PartogramRecord.recorded_at.desc()).first()
        
        if not latest_record:
            return 'normal'
        
        # 🔥 RULE 1: CTG Score có ưu tiên tuyệt đối cho thai nhi
        if latest_record.ctg_score is not None:
            if latest_record.ctg_score >= 3:  # CTG = 3
                return 'critical'  # 🔴 ĐỎ - Nguy hiểm
            elif latest_record.ctg_score >= 2:  # CTG = 2
                return 'warning'   # 🟡 VÀNG - Cần theo dõi
        
        # 🔥 RULE 2: Kiểm tra chỉ số của record cuối cùng
        violations = 0
        critical_violations = 0
        
        # Check mother's vitals from latest record
        if latest_record.pulse:
            if latest_record.pulse < 50 or latest_record.pulse > 120:
                critical_violations += 1
            elif latest_record.pulse < 60 or latest_record.pulse >= 120:
                violations += 1
        
        if latest_record.systolic_bp:
            if latest_record.systolic_bp > 160:
                critical_violations += 1
            elif latest_record.systolic_bp < 80 or latest_record.systolic_bp >= 140:
                violations += 1
        
        if latest_record.temperature:
            if latest_record.temperature > 38.0:
                critical_violations += 1
            elif latest_record.temperature < 35 or latest_record.temperature >= 37.5:
                violations += 1
        
        # Check fetal heart rate from latest record
        if latest_record.fetal_heart_rate:
            if latest_record.fetal_heart_rate < 100 or latest_record.fetal_heart_rate > 180:
                critical_violations += 1
            elif latest_record.fetal_heart_rate < 110 or latest_record.fetal_heart_rate >= 160:
                violations += 1
        
        # Check contractions from latest record
        if latest_record.contractions_per_10min:
            if latest_record.contractions_per_10min < 2 or latest_record.contractions_per_10min > 5:
                violations += 1
        
        # 🔥 RULE 3: Áp dụng quy tắc theo số lần vi phạm trong record cuối
        if critical_violations > 0:
            return 'critical'  # 🔴 ĐỎ - Có vi phạm nghiêm trọng
        elif violations >= 1:
            return 'warning'   # 🟡 VÀNG - Có vi phạm cảnh báo
        else:
            return 'normal'    # 🟢 XANH - Không có vi phạm
    
    def get_current_alerts_for_patient(self, patient_id: str) -> List[Dict]:
        """Generate current alerts for a patient based on LATEST record only"""
        from app.models import PartogramRecord
        
        # Get the latest partogram record
        latest_record = PartogramRecord.query.filter_by(patient_id=patient_id)\
            .order_by(PartogramRecord.recorded_at.desc()).first()
        
        if not latest_record:
            return []
        
        current_alerts = []
        
        # Check CTG (highest priority for fetus)
        if latest_record.ctg_score is not None:
            if latest_record.ctg_score >= 3:
                current_alerts.append({
                    'alert_type': 'fetus',
                    'severity': 'critical',
                    'parameter': 'ctg',
                    'value': str(latest_record.ctg_score),
                    'message': f"CTG cấp {latest_record.ctg_score} - Nguy hiểm, cần can thiệp ngay"
                })
            elif latest_record.ctg_score >= 2:
                current_alerts.append({
                    'alert_type': 'fetus',
                    'severity': 'warning',
                    'parameter': 'ctg',
                    'value': str(latest_record.ctg_score),
                    'message': f"CTG cấp {latest_record.ctg_score} - Cần theo dõi thêm"
                })
        
        # Check mother's vitals
        if latest_record.pulse:
            if latest_record.pulse < 60 or latest_record.pulse >= 120:
                severity = 'critical' if latest_record.pulse < 50 or latest_record.pulse > 120 else 'warning'
                current_alerts.append({
                    'alert_type': 'mother',
                    'severity': severity,
                    'parameter': 'pulse',
                    'value': str(latest_record.pulse),
                    'message': f"Mạch {latest_record.pulse} bpm - Ngoài phạm vi bình thường (60-100 bpm)"
                })
        
        if latest_record.systolic_bp:
            if latest_record.systolic_bp < 80 or latest_record.systolic_bp >= 140:
                severity = 'critical' if latest_record.systolic_bp > 160 else 'warning'
                current_alerts.append({
                    'alert_type': 'mother',
                    'severity': severity,
                    'parameter': 'systolic_bp',
                    'value': str(latest_record.systolic_bp),
                    'message': f"Huyết áp tâm thu {latest_record.systolic_bp} mmHg - {'Cao' if latest_record.systolic_bp >= 140 else 'Thấp'} hơn bình thường"
                })
        
        if latest_record.temperature:
            if latest_record.temperature < 35 or latest_record.temperature >= 37.5:
                severity = 'critical' if latest_record.temperature > 38.0 else 'warning'
                current_alerts.append({
                    'alert_type': 'mother',
                    'severity': severity,
                    'parameter': 'temperature',
                    'value': str(latest_record.temperature),
                    'message': f"Nhiệt độ {latest_record.temperature}°C - {'Sốt' if latest_record.temperature >= 37.5 else 'Hạ thân nhiệt'}"
                })
        
        # Check fetal heart rate
        if latest_record.fetal_heart_rate:
            if latest_record.fetal_heart_rate < 110 or latest_record.fetal_heart_rate >= 160:
                severity = 'critical' if latest_record.fetal_heart_rate < 100 or latest_record.fetal_heart_rate > 180 else 'warning'
                current_alerts.append({
                    'alert_type': 'fetus',
                    'severity': severity,
                    'parameter': 'fetal_heart_rate',
                    'value': str(latest_record.fetal_heart_rate),
                    'message': f"Tim thai {latest_record.fetal_heart_rate} bpm - Ngoài phạm vi bình thường (110-160 bpm)"
                })
        
        # Check contractions
        if latest_record.contractions_per_10min:
            if latest_record.contractions_per_10min < 2 or latest_record.contractions_per_10min > 5:
                current_alerts.append({
                    'alert_type': 'labor',
                    'severity': 'warning',
                    'parameter': 'contractions',
                    'value': str(latest_record.contractions_per_10min),
                    'message': f"Cơn co {latest_record.contractions_per_10min} TC/10 phút - {'Quá ít' if latest_record.contractions_per_10min < 2 else 'Quá nhiều'}"
                })
        
        return current_alerts
    
    def get_patient_alerts_latest_only(self, patient_id: str) -> List[Alert]:
        """Get alerts for a patient from the LATEST partogram record only"""
        from app.models import PartogramRecord
        
        # Get the latest partogram record
        latest_record = PartogramRecord.query.filter_by(patient_id=patient_id)\
            .order_by(PartogramRecord.recorded_at.desc()).first()
        
        if not latest_record:
            return []
        
        # Get alerts only from the latest record
        alerts = Alert.query.filter(
            Alert.patient_id == patient_id,
            Alert.partogram_record_id == latest_record.id,
            Alert.is_acknowledged == False
        ).order_by(Alert.created_at.desc()).all()
        
        return alerts
    
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