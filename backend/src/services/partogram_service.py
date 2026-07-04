from src.models import Patient, PartogramRecord, Assessment
from src.services.alert_service import AlertService
from src import db
from datetime import datetime
from typing import List, Dict, Optional


class PartogramService:
    """Service for managing partogram data and calculations"""
    
    def __init__(self):
        self.alert_service = AlertService()
    
    def create_patient(self, patient_data: Dict) -> Patient:
        """Create a new patient"""
        patient = Patient(
            id=patient_data['id'],
            name=patient_data['name'],
            age=patient_data['age'],
            room=patient_data['room'],
            gestational_week=patient_data['gestational_week'],
            parity=patient_data['parity'],
            labor_diagnosis_time=datetime.fromisoformat(patient_data['labor_diagnosis_time'])
        )
        
        db.session.add(patient)
        db.session.commit()
        return patient
    
    def get_patient_by_id(self, patient_id: str) -> Optional[Patient]:
        """Get patient by ID"""
        return Patient.query.get(patient_id)
    
    def update_patient(self, patient_id: str, patient_data: Dict) -> Patient:
        """Update patient information"""
        patient = self.get_patient_by_id(patient_id)
        if not patient:
            raise ValueError(f"Patient {patient_id} not found")
        
        # Update fields
        patient.id = patient_data['id']
        patient.name = patient_data['name']
        patient.age = patient_data['age']
        patient.room = patient_data['room']
        patient.gestational_week = patient_data['gestational_week']
        patient.parity = patient_data['parity']
        patient.labor_diagnosis_time = datetime.fromisoformat(patient_data['labor_diagnosis_time'])
        patient.updated_at = datetime.utcnow()
        
        db.session.commit()
        return patient
    
    def get_all_patients(self) -> List[Dict]:
        """Get all patients with their current status"""
        patients = Patient.query.all()
        result = []
        
        for patient in patients:
            patient_dict = patient.to_dict()
            
            # Add current status
            patient_dict['status'] = patient.get_current_status()
            
            # Add last check time
            last_check = patient.get_last_check_time()
            if last_check:
                time_diff = datetime.utcnow() - last_check
                minutes_ago = int(time_diff.total_seconds() / 60)
                if minutes_ago < 60:
                    patient_dict['last_check'] = f"{minutes_ago} phút trước"
                else:
                    hours_ago = int(minutes_ago / 60)
                    patient_dict['last_check'] = f"{hours_ago} giờ trước"
            else:
                patient_dict['last_check'] = "Chưa có dữ liệu"
            
            # Add current alerts - CHỈ TÍNH TOÁN TỪ LATEST RECORD
            current_alerts = self.alert_service.get_current_alerts_for_patient(patient.id)
            patient_dict['alerts'] = current_alerts[:3]  # Top 3 current alerts from latest record only
            
            result.append(patient_dict)
        
        return result
    
    def get_patient_detail(self, patient_id: str) -> Optional[Dict]:
        """Get detailed patient information"""
        patient = Patient.query.get(patient_id)
        if not patient:
            return None
        
        patient_dict = patient.to_dict()
        patient_dict['status'] = patient.get_current_status()
        
        # Get partogram records
        records = PartogramRecord.query.filter_by(patient_id=patient_id)\
            .order_by(PartogramRecord.recorded_at).all()
        patient_dict['partogram_records'] = [record.to_dict() for record in records]
        
        # Get assessments
        assessments = Assessment.query.filter_by(patient_id=patient_id)\
            .order_by(Assessment.assessed_at.desc()).all()
        patient_dict['assessments'] = [assessment.to_dict() for assessment in assessments]
        
        # Get alerts
        alerts = self.alert_service.get_patient_alerts(patient_id, include_acknowledged=True)
        patient_dict['alerts'] = [alert.to_dict() for alert in alerts]
        
        return patient_dict
    
    def add_partogram_record(self, patient_id: str, record_data: Dict) -> PartogramRecord:
        """Add a new partogram record"""
        print(f"Received record data: {record_data}")  # Debug log
        
        # Parse recorded time
        if isinstance(record_data.get('recorded_at'), str):
            recorded_at = datetime.fromisoformat(record_data['recorded_at'])
        else:
            recorded_at = record_data.get('recorded_at', datetime.utcnow())
        
        # Create record with flat structure from frontend
        record = PartogramRecord(
            patient_id=patient_id,
            recorded_at=recorded_at,
            examination_time=record_data.get('examination_time'),
            time_since_dilation=record_data.get('time_since_dilation'),
            recorded_by_role=record_data.get('recorded_by_role', 'nurse'),
            
            # Supportive care - flat structure
            companion=record_data.get('companion', False),
            vas_score=record_data.get('vas_score') or record_data.get('vas'),
            drinking=record_data.get('drinking', False),
            eating=record_data.get('eating', False),
            
            # Mother's vitals - flat structure  
            pulse=record_data.get('pulse'),
            systolic_bp=record_data.get('systolic_bp'),
            diastolic_bp=record_data.get('diastolic_bp'),
            temperature=record_data.get('temperature'),
            urine=record_data.get('urine'),
            
            # Fetus monitoring - flat structure
            fetal_heart_rate=record_data.get('fetal_heart_rate'),
            ctg_score=record_data.get('ctg_score'),
            amniotic_fluid=record_data.get('amniotic_fluid'),
            fetal_position=record_data.get('fetal_position'),
            caput=record_data.get('caput'),
            molding=record_data.get('molding'),
            
            # Labor progress - flat structure
            contractions_per_10min=record_data.get('contractions_per_10min'),
            contraction_duration=record_data.get('contraction_duration'),
            cervix_dilation=record_data.get('cervix_dilation'),
            station=record_data.get('station'),
            
            # Medication - flat structure
            oral_medication=record_data.get('oral_medication'),
            injection_medication=record_data.get('injection_medication'),
            infusion_medication=record_data.get('infusion_medication'),
            
            # Assessment and evaluation - flat structure
            nurse_assessment=record_data.get('nurse_assessment'),
            doctor_assessment=record_data.get('doctor_assessment'),
            treatment_plan=record_data.get('treatment_plan')
        )
        
        db.session.add(record)
        db.session.commit()
        
        # Generate alerts for this record
        alerts = self.alert_service.evaluate_partogram_record(record)
        db.session.commit()
        
        return record
    
    def get_timeline_data(self, patient_id: str, zoom_level: str = '1h') -> Dict:
        """Get timeline data for partogram visualization"""
        records = PartogramRecord.query.filter_by(patient_id=patient_id)\
            .order_by(PartogramRecord.recorded_at).all()
        
        if not records:
            return {'timeline': [], 'parameters': [], 'alerts': []}
        
        # Define parameters to display
        parameters = [
            {'key': 'pulse', 'label': 'Mạch (bpm)', 'category': 'mother', 'type': 'line'},
            {'key': 'systolic_bp', 'label': 'HA tâm thu (mmHg)', 'category': 'mother', 'type': 'line'},
            {'key': 'temperature', 'label': 'Nhiệt độ (°C)', 'category': 'mother', 'type': 'line'},
            {'key': 'fetal_heart_rate', 'label': 'Tim thai (bpm)', 'category': 'fetus', 'type': 'line'},
            {'key': 'ctg_score', 'label': 'CTG', 'category': 'fetus', 'type': 'points'},
            {'key': 'cervix_dilation', 'label': 'Mở cổ tử cung (cm)', 'category': 'labor', 'type': 'line'},
            {'key': 'contractions_per_10min', 'label': 'Cơn co/10p', 'category': 'labor', 'type': 'points'},
        ]
        
        # Calculate time range and intervals based on zoom level
        start_time = records[0].recorded_at
        end_time = records[-1].recorded_at
        
        zoom_intervals = {
            '30m': 0.5,
            '1h': 1.0,
            '2h': 2.0,
            '4h': 4.0
        }
        
        interval_hours = zoom_intervals.get(zoom_level, 1.0)
        
        # Prepare timeline data
        timeline_data = []
        
        for record in records:
            time_point = {
                'time': record.recorded_at.isoformat(),
                'time_since_dilation': record.time_since_dilation,
                'data': {}
            }
            
            # Add all parameter values
            for param in parameters:
                if param['category'] == 'mother':
                    value = getattr(record, param['key'], None)
                elif param['category'] == 'fetus':
                    value = getattr(record, param['key'], None)
                elif param['category'] == 'labor':
                    value = getattr(record, param['key'], None)
                else:
                    value = None
                
                if value is not None:
                    time_point['data'][param['key']] = {
                        'value': value,
                        'status': self._get_parameter_status(param['key'], value)
                    }
            
            timeline_data.append(time_point)
        
        # Get alerts for this patient
        alerts = self.alert_service.get_patient_alerts(patient_id, include_acknowledged=True)
        alert_data = []
        
        for alert in alerts:
            if alert.partogram_record_id:
                record = PartogramRecord.query.get(alert.partogram_record_id)
                if record:
                    alert_data.append({
                        'time': record.recorded_at.isoformat(),
                        'parameter': alert.parameter,
                        'severity': alert.severity,
                        'message': alert.message,
                        'value': alert.value
                    })
        
        return {
            'timeline': timeline_data,
            'parameters': parameters,
            'alerts': alert_data,
            'time_range': {
                'start': start_time.isoformat(),
                'end': end_time.isoformat(),
                'interval_hours': interval_hours
            }
        }
    
    def _get_parameter_status(self, parameter: str, value) -> str:
        """Determine parameter status (normal/warning/critical) based on thresholds"""
        thresholds = AlertService().thresholds
        
        if parameter == 'pulse':
            if value < thresholds.MOTHER_THRESHOLDS['pulse']['min'] or \
               value > thresholds.MOTHER_THRESHOLDS['pulse']['max']:
                return 'critical' if value < 50 or value > 120 else 'warning'
        
        elif parameter == 'systolic_bp':
            if value > thresholds.MOTHER_THRESHOLDS['systolic_bp']['max']:
                return 'critical' if value > 160 else 'warning'
            elif value < thresholds.MOTHER_THRESHOLDS['systolic_bp']['min']:
                return 'warning'
        
        elif parameter == 'temperature':
            if value > thresholds.MOTHER_THRESHOLDS['temperature']['max']:
                return 'critical' if value > 38.0 else 'warning'
        
        elif parameter == 'fetal_heart_rate':
            if value < thresholds.FETUS_THRESHOLDS['fetal_heart_rate']['min'] or \
               value > thresholds.FETUS_THRESHOLDS['fetal_heart_rate']['max']:
                return 'critical' if value < 100 or value > 180 else 'warning'
        
        elif parameter == 'ctg_score':
            if value >= thresholds.FETUS_THRESHOLDS['ctg_score']['critical']:
                return 'critical'
            elif value >= thresholds.FETUS_THRESHOLDS['ctg_score']['warning']:
                return 'warning'
        
        return 'normal'
    
    def update_partogram_record(self, record_id: int, record_data: Dict) -> Optional[PartogramRecord]:
        """Update an existing partogram record"""
        record = PartogramRecord.query.get(record_id)
        if not record:
            return None
        
        # Update fields
        for key, value in record_data.items():
            if hasattr(record, key):
                setattr(record, key, value)
        
        db.session.commit()
        
        # Re-evaluate alerts for this record
        self.alert_service.evaluate_partogram_record(record)
        db.session.commit()
        
        return record
    
    def delete_partogram_record(self, record_id: int) -> bool:
        """Delete a partogram record"""
        record = PartogramRecord.query.get(record_id)
        if not record:
            return False
        
        db.session.delete(record)
        db.session.commit()
        return True

    def acknowledge_partogram_record(self, record_id: int, doctor_id: str, treatment_plan: str = None, signature_data: str = None) -> Optional[PartogramRecord]:
        """Acknowledge a partogram record and attach doctor's orders/signature"""
        record = PartogramRecord.query.get(record_id)
        if not record:
            return None
        
        record.acknowledged_at = datetime.utcnow()
        record.acknowledged_by_doctor_id = doctor_id
        
        if treatment_plan:
            record.treatment_plan = treatment_plan
            
        if signature_data:
            record.doctor_signature = signature_data
        
        db.session.commit()
        return record