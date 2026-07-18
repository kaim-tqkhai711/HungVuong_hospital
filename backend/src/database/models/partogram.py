from datetime import datetime
from src import db


class PartogramRecord(db.Model):
    """Partogram record for storing monitoring data"""
    __tablename__ = 'partogram_records'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    recorded_at = db.Column(db.DateTime, nullable=False)
    examination_time = db.Column(db.String(10))
    time_since_dilation = db.Column(db.Float)

    companion = db.Column(db.Boolean, default=False)
    vas_score = db.Column(db.Integer)
    drinking = db.Column(db.Boolean, default=False)
    eating = db.Column(db.Boolean, default=False)

    pulse = db.Column(db.Integer)
    systolic_bp = db.Column(db.Integer)
    diastolic_bp = db.Column(db.Integer)
    temperature = db.Column(db.Float)
    urine = db.Column(db.String(50))

    fetal_heart_rate = db.Column(db.Integer)
    ctg_score = db.Column(db.Integer)
    amniotic_fluid = db.Column(db.String(50))
    fetal_position = db.Column(db.String(50))
    caput = db.Column(db.String(10))
    molding = db.Column(db.String(10))

    contractions_per_10min = db.Column(db.Integer)
    contraction_duration = db.Column(db.Integer)
    cervix_dilation = db.Column(db.Integer)
    station = db.Column(db.String(10))

    oral_medication = db.Column(db.Text)
    injection_medication = db.Column(db.Text)
    infusion_medication = db.Column(db.Text)

    nurse_assessment = db.Column(db.Text)
    doctor_assessment = db.Column(db.Text)
    treatment_plan = db.Column(db.Text)

    recorded_by_role = db.Column(db.String(20), default='nurse')
    acknowledged_by_doctor_id = db.Column(db.String(100), nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    doctor_signature = db.Column(db.Text, nullable=True)

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
                'vas': self.vas_score,
                'drinking': self.drinking,
                'eating': self.eating
            },
            'companion': self.companion,
            'vas_score': self.vas_score,
            'vas': self.vas_score,
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
            'nurse_assessment': self.nurse_assessment,
            'doctor_assessment': self.doctor_assessment,
            'treatment_plan': self.treatment_plan,
            'recorded_by_role': self.recorded_by_role,
            'acknowledged_by_doctor_id': self.acknowledged_by_doctor_id,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'doctor_signature': self.doctor_signature,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
