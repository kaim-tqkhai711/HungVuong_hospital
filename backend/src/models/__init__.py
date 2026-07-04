from datetime import datetime
from sqlalchemy import func

# Import db from app package
from .. import db


class Patient(db.Model):
    """Patient model for storing patient information"""
    __tablename__ = 'patients'
    
    id = db.Column(db.String(10), primary_key=True)  # BN001, BN002, etc.
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    room = db.Column(db.String(10), nullable=False)
    gestational_week = db.Column(db.String(20), nullable=False)
    parity = db.Column(db.String(20), nullable=False)
    labor_diagnosis_time = db.Column(db.DateTime, nullable=False)
    
    # New fields - Thông tin tổng quan
    membrane_rupture_date = db.Column(db.DateTime)  # Ngày giờ ối vỡ
    risk_factors = db.Column(db.Text)  # Yếu tố nguy cơ
    labor_induction_method = db.Column(db.String(20))  # CDTN hoặc KPCD
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    partogram_records = db.relationship('PartogramRecord', backref='patient', lazy=True, cascade='all, delete-orphan')
    assessments = db.relationship('Assessment', backref='patient', lazy=True, cascade='all, delete-orphan')
    outcomes = db.relationship('Outcome', backref='patient', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<Patient {self.id}: {self.name}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'age': self.age,
            'room': self.room,
            'gestational_week': self.gestational_week,
            'parity': self.parity,
            'labor_diagnosis_time': self.labor_diagnosis_time.isoformat() if self.labor_diagnosis_time else None,
            'membrane_rupture_date': self.membrane_rupture_date.isoformat() if self.membrane_rupture_date else None,
            'risk_factors': self.risk_factors,
            'labor_induction_method': self.labor_induction_method,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_current_status(self):
        """Calculate current patient status based on latest records"""
        from src.services.alert_service import AlertService
        latest_record = PartogramRecord.query.filter_by(patient_id=self.id)\
            .order_by(PartogramRecord.recorded_at.desc()).first()
        
        if not latest_record:
            return 'normal'
        
        alert_service = AlertService()
        return alert_service.calculate_patient_status(self.id)
    
    def get_last_check_time(self):
        """Get time of last partogram record"""
        latest_record = PartogramRecord.query.filter_by(patient_id=self.id)\
            .order_by(PartogramRecord.recorded_at.desc()).first()
        
        if not latest_record:
            return None
        
        return latest_record.recorded_at


class PartogramRecord(db.Model):
    """Partogram record for storing monitoring data"""
    __tablename__ = 'partogram_records'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)
    examination_time = db.Column(db.String(10))  # Time of examination (HH:MM)
    time_since_dilation = db.Column(db.Float)  # Hours since dilation started
    
    # Supportive Care
    companion = db.Column(db.Boolean, default=False)
    vas_score = db.Column(db.Integer)  # Pain score 1-10
    drinking = db.Column(db.Boolean, default=False)
    eating = db.Column(db.Boolean, default=False)
    
    # Mother's Vital Signs
    pulse = db.Column(db.Integer)
    systolic_bp = db.Column(db.Integer)
    diastolic_bp = db.Column(db.Integer)
    temperature = db.Column(db.Float)
    urine = db.Column(db.String(50))
    
    # Fetus Monitoring
    fetal_heart_rate = db.Column(db.Integer)
    ctg_score = db.Column(db.Integer)  # 0-3 (0-1: normal, 2: warning, 3: critical)
    amniotic_fluid = db.Column(db.String(50))
    fetal_position = db.Column(db.String(50))
    caput = db.Column(db.String(10))
    molding = db.Column(db.String(10))
    
    # Labor Progress
    contractions_per_10min = db.Column(db.Integer)
    contraction_duration = db.Column(db.Integer)  # seconds
    cervix_dilation = db.Column(db.Integer)  # cm
    station = db.Column(db.String(10))
    
    # Medication
    oral_medication = db.Column(db.Text)
    injection_medication = db.Column(db.Text)
    infusion_medication = db.Column(db.Text)
    
    # Assessment and evaluation (for convenience - also stored in Assessment table)
    nurse_assessment = db.Column(db.Text)
    doctor_assessment = db.Column(db.Text)
    treatment_plan = db.Column(db.Text)
    
    # Workflow tracking (who recorded and who verified)
    recorded_by_role = db.Column(db.String(20), default='nurse')
    acknowledged_by_doctor_id = db.Column(db.String(100), nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    doctor_signature = db.Column(db.Text, nullable=True)  # Base64 signature image
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<PartogramRecord {self.patient_id} at {self.recorded_at}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
            'examination_time': self.examination_time,
            'time_since_dilation': self.time_since_dilation,
            'supportive_care': {
                'companion': self.companion,
                'vas_score': self.vas_score,
                'vas': self.vas_score,  # Alias for convenience
                'drinking': self.drinking,
                'eating': self.eating
            },
            # Also add flat structure for convenience
            'companion': self.companion,
            'vas_score': self.vas_score,
            'vas': self.vas_score,  # Alias for convenience
            'drinking': self.drinking,
            'eating': self.eating,
            'mother': {
                'pulse': self.pulse,
                'systolic_bp': self.systolic_bp,
                'diastolic_bp': self.diastolic_bp,
                'temperature': self.temperature,
                'urine': self.urine
            },
            'fetus': {
                'fetal_heart_rate': self.fetal_heart_rate,
                'ctg_score': self.ctg_score,
                'amniotic_fluid': self.amniotic_fluid,
                'fetal_position': self.fetal_position,
                'caput': self.caput,
                'molding': self.molding
            },
            'labor': {
                'contractions_per_10min': self.contractions_per_10min,
                'contraction_duration': self.contraction_duration,
                'cervix_dilation': self.cervix_dilation,
                'station': self.station
            },
            'medication': {
                'oral': self.oral_medication,
                'injection': self.injection_medication,
                'infusion': self.infusion_medication
            },
            'assessment': {
                'nurse_assessment': self.nurse_assessment,
                'doctor_assessment': self.doctor_assessment,
                'treatment_plan': self.treatment_plan
            },
            # Also add flat structure for convenience
            'nurse_assessment': self.nurse_assessment,
            'doctor_assessment': self.doctor_assessment,
            'treatment_plan': self.treatment_plan,
            'recorded_by_role': self.recorded_by_role,
            'acknowledged_by_doctor_id': self.acknowledged_by_doctor_id,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'doctor_signature': self.doctor_signature,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Assessment(db.Model):
    """Assessment and treatment plan model"""
    __tablename__ = 'assessments'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    partogram_record_id = db.Column(db.Integer, db.ForeignKey('partogram_records.id'), nullable=True)
    
    nurse_assessment = db.Column(db.Text)
    doctor_assessment = db.Column(db.Text)
    treatment_plan = db.Column(db.Text)
    
    assessor_role = db.Column(db.String(20), nullable=False, default='doctor') # 'doctor', 'nurse'
    assessed_at = db.Column(db.DateTime, default=datetime.utcnow)
    assessed_by = db.Column(db.String(100))  # User who made the assessment
    
    def __repr__(self):
        return f'<Assessment {self.patient_id} at {self.assessed_at}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'partogram_record_id': self.partogram_record_id,
            'nurse_assessment': self.nurse_assessment,
            'doctor_assessment': self.doctor_assessment,
            'treatment_plan': self.treatment_plan,
            'assessor_role': self.assessor_role,
            'assessed_at': self.assessed_at.isoformat() if self.assessed_at else None,
            'assessed_by': self.assessed_by
        }


class Alert(db.Model):
    """Alert model for storing system-generated alerts"""
    __tablename__ = 'alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    partogram_record_id = db.Column(db.Integer, db.ForeignKey('partogram_records.id'), nullable=True)
    
    alert_type = db.Column(db.String(20), nullable=False)  # 'mother', 'fetus', 'labor'
    severity = db.Column(db.String(10), nullable=False)  # 'normal', 'warning', 'critical'
    parameter = db.Column(db.String(50), nullable=False)  # 'blood_pressure', 'ctg', etc.
    value = db.Column(db.String(50))  # The actual value that triggered alert
    threshold = db.Column(db.String(50))  # The threshold that was exceeded
    message = db.Column(db.Text, nullable=False)
    
    is_acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_at = db.Column(db.DateTime)
    acknowledged_by = db.Column(db.String(100))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    patient = db.relationship('Patient', backref='alerts')
    
    def __repr__(self):
        return f'<Alert {self.patient_id}: {self.severity} - {self.parameter}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'partogram_record_id': self.partogram_record_id,
            'alert_type': self.alert_type,
            'severity': self.severity,
            'parameter': self.parameter,
            'value': self.value,
            'threshold': self.threshold,
            'message': self.message,
            'is_acknowledged': self.is_acknowledged,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'acknowledged_by': self.acknowledged_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Outcome(db.Model):
    """Final outcome model"""
    __tablename__ = 'outcomes'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    
    outcome_type = db.Column(db.String(50), nullable=False)
    outcome_details = db.Column(db.Text)
    
    delivery_time = db.Column(db.DateTime)
    baby_weight = db.Column(db.Float)
    baby_gender = db.Column(db.String(10))
    apgar_1min = db.Column(db.Integer)
    apgar_5min = db.Column(db.Integer)
    
    complications = db.Column(db.Text)
    notes = db.Column(db.Text)
    
    recorded_at = db.Column(db.DateTime, default=datetime.utcnow)
    recorded_by = db.Column(db.String(100))
    
    def __repr__(self):
        return f'<Outcome {self.patient_id}: {self.outcome_type}>'
    
    def to_dict(self):
        return {
            'id': self.id,
            'patient_id': self.patient_id,
            'outcome_type': self.outcome_type,
            'outcome_details': self.outcome_details,
            'delivery_time': self.delivery_time.isoformat() if self.delivery_time else None,
            'baby_weight': self.baby_weight,
            'baby_gender': self.baby_gender,
            'apgar_1min': self.apgar_1min,
            'apgar_5min': self.apgar_5min,
            'complications': self.complications,
            'notes': self.notes,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
            'recorded_by': self.recorded_by
        }


# Thresholds configuration for alerts
class ThresholdConfig:
    """Configuration class for medical thresholds"""
    
    # Mother's vital signs thresholds
    MOTHER_THRESHOLDS = {
        'pulse': {'min': 60, 'max': 100},
        'systolic_bp': {'min': 90, 'max': 140},
        'diastolic_bp': {'min': 60, 'max': 90},
        'temperature': {'min': 36.0, 'max': 37.5}
    }
    
    # Fetus monitoring thresholds
    FETUS_THRESHOLDS = {
        'fetal_heart_rate': {'min': 110, 'max': 160},
        'ctg_score': {'warning': 2, 'critical': 3}
    }
    
    # Labor progress thresholds
    LABOR_THRESHOLDS = {
        'cervix_dilation_rate': {'min_rate': 0.5}  # cm per hour minimum
    }