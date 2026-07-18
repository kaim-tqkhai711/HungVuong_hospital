from datetime import datetime
from src import db


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
