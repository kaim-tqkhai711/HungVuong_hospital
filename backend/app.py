import os
from dotenv import load_dotenv
from src import create_app

# Load environment variables from .env file first
load_dotenv()

# Create Flask app - Flask will auto-discover this as 'app'
app = create_app(os.environ.get('FLASK_ENV', 'development'))

# Make the app discoverable by Flask CLI
application = app

# Import after app creation to avoid circular imports
from src import db
from src.models import Patient, PartogramRecord, Assessment, Alert, Outcome

# Make sure Flask can find the app instance
def create_tables():
    """Create database tables."""
    with app.app_context():
        db.create_all()
        print("✅ Database tables created successfully!")

def seed_data():
    """Seed the database with sample data."""
    from datetime import datetime, timedelta
    
    with app.app_context():
        # Create sample patients
        patients_data = [
        {
            'id': 'BN001',
            'name': 'Nguyễn Thị Hồng',
            'age': 28,
            'room': 'P301',
            'gestational_week': '39 tuần',
            'parity': 'Para 0',
            'labor_diagnosis_time': datetime.now() - timedelta(hours=6)
        },
        {
            'id': 'BN002', 
            'name': 'Trần Thị Mai',
            'age': 32,
            'room': 'P302',
            'gestational_week': '38 tuần 5 ngày',
            'parity': 'Para 1',
            'labor_diagnosis_time': datetime.now() - timedelta(hours=3)
        },
        {
            'id': 'BN003',
            'name': 'Lê Thị Lan',
            'age': 25,
            'room': 'P303', 
            'gestational_week': '40 tuần 1 ngày',
            'parity': 'Para 0',
            'labor_diagnosis_time': datetime.now() - timedelta(hours=8)
        }
        ]
        
        for patient_data in patients_data:
            existing = Patient.query.get(patient_data['id'])
            if not existing:
                patient = Patient(**patient_data)
                db.session.add(patient)
        
        db.session.commit()
        
        # Add sample partogram records
        sample_records = [
        {
            'patient_id': 'BN001',
            'recorded_at': datetime.now() - timedelta(hours=3),
            'time_since_dilation': 3.0,
            'pulse': 88,
            'systolic_bp': 165,  # High - will trigger alert
            'diastolic_bp': 95,
            'temperature': 36.8,
            'fetal_heart_rate': 145,
            'ctg_score': 3,  # Critical - will trigger alert
            'cervix_dilation': 4,
            'contractions_per_10min': 4
        },
        {
            'patient_id': 'BN002', 
            'recorded_at': datetime.now() - timedelta(hours=1),
            'time_since_dilation': 2.0,
            'pulse': 75,
            'systolic_bp': 125,
            'diastolic_bp': 80,
            'temperature': 36.9,
            'fetal_heart_rate': 150,
            'ctg_score': 1,
            'cervix_dilation': 6,
            'contractions_per_10min': 5
        },
        {
            'patient_id': 'BN003',
            'recorded_at': datetime.now() - timedelta(minutes=30),
            'time_since_dilation': 1.5,
            'pulse': 105,  # Slightly high
            'systolic_bp': 130,
            'diastolic_bp': 85,
            'temperature': 37.8,  # High - will trigger alert
            'fetal_heart_rate': 140,
            'ctg_score': 2,  # Warning
            'cervix_dilation': 3,
            'contractions_per_10min': 3
            }
        ]
        
        for record_data in sample_records:
            record = PartogramRecord(**record_data)
            db.session.add(record)
        
        db.session.commit()
        print("✅ Sample data created successfully!")

# Add CLI commands
@app.cli.command()
def init_db():
    """Initialize the database."""
    create_tables()

@app.cli.command()
def seed_db():
    """Seed the database with sample data."""
    create_tables()  # Ensure tables exist first
    seed_data()

# Auto-create tables on startup (works with both dev and gunicorn)
with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)