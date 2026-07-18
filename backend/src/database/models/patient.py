from datetime import datetime
from src import db


class Patient(db.Model):
    """Patient model for storing patient information"""
    __tablename__ = 'patients'

    id = db.Column(db.String(10), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    room = db.Column(db.String(10), nullable=False)
    gestational_week = db.Column(db.String(20), nullable=False)
    parity = db.Column(db.String(20), nullable=False)
    labor_diagnosis_time = db.Column(db.DateTime, nullable=False)

    membrane_rupture_date = db.Column(db.DateTime)
    risk_factors = db.Column(db.Text)
    labor_induction_method = db.Column(db.String(20))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
        from src.services.alert_service import AlertService
        latest_record = self.partogram_records[-1] if self.partogram_records else None
        if not latest_record:
            return 'normal'
        alert_service = AlertService()
        return alert_service.calculate_patient_status(self.id)

    def get_last_check_time(self):
        latest_record = self.partogram_records[-1] if self.partogram_records else None
        if not latest_record:
            return None
        return latest_record.recorded_at
