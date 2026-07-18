from datetime import datetime
from src import db


class Alert(db.Model):
    """Alert model for storing system-generated alerts"""
    __tablename__ = 'alerts'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    partogram_record_id = db.Column(db.Integer, db.ForeignKey('partogram_records.id'), nullable=True)

    alert_type = db.Column(db.String(20), nullable=False)
    severity = db.Column(db.String(10), nullable=False)
    parameter = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(50))
    threshold = db.Column(db.String(50))
    message = db.Column(db.Text, nullable=False)

    is_acknowledged = db.Column(db.Boolean, default=False)
    acknowledged_at = db.Column(db.DateTime)
    acknowledged_by = db.Column(db.String(100))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
