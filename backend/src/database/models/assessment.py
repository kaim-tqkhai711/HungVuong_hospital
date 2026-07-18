from datetime import datetime
from src import db


class Assessment(db.Model):
    """Assessment and treatment plan model"""
    __tablename__ = 'assessments'

    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(10), db.ForeignKey('patients.id'), nullable=False)
    partogram_record_id = db.Column(db.Integer, db.ForeignKey('partogram_records.id'), nullable=True)

    nurse_assessment = db.Column(db.Text)
    doctor_assessment = db.Column(db.Text)
    treatment_plan = db.Column(db.Text)

    assessor_role = db.Column(db.String(20), nullable=False, default='doctor')
    assessed_at = db.Column(db.DateTime, default=datetime.utcnow)
    assessed_by = db.Column(db.String(100))

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
