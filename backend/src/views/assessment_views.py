from flask import Blueprint, request, jsonify
from src.database.models import Assessment, Outcome
from src.services.partogram_service import PartogramService
from src import db
from datetime import datetime

assessment_bp = Blueprint('assessments', __name__)
partogram_service = PartogramService()


@assessment_bp.route('/<patient_id>', methods=['GET'])
def get_patient_assessments(patient_id):
    """Get all assessments for a patient"""
    try:
        assessments = Assessment.query.filter_by(patient_id=patient_id)\
            .order_by(Assessment.assessed_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [assessment.to_dict() for assessment in assessments],
            'count': len(assessments)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy đánh giá',
            'message': str(e)
        }), 500


@assessment_bp.route('/<patient_id>', methods=['POST'])
def create_assessment(patient_id):
    """Create a new assessment"""
    try:
        data = request.get_json()
        
        assessment = Assessment(
            patient_id=patient_id,
            partogram_record_id=data.get('partogram_record_id'),
            nurse_assessment=data.get('nurse_assessment'),
            doctor_assessment=data.get('doctor_assessment'),
            treatment_plan=data.get('treatment_plan'),
            assessed_by=data.get('assessed_by', 'Unknown User')
        )
        
        db.session.add(assessment)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': assessment.to_dict(),
            'message': 'Tạo đánh giá thành công'
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi tạo đánh giá',
            'message': str(e)
        }), 500


@assessment_bp.route('/<int:assessment_id>', methods=['PUT'])
def update_assessment(assessment_id):
    """Update an existing assessment"""
    try:
        data = request.get_json()
        
        assessment = Assessment.query.get(assessment_id)
        if not assessment:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy đánh giá'
            }), 404
        
        # Update fields
        if 'nurse_assessment' in data:
            assessment.nurse_assessment = data['nurse_assessment']
        if 'doctor_assessment' in data:
            assessment.doctor_assessment = data['doctor_assessment']
        if 'treatment_plan' in data:
            assessment.treatment_plan = data['treatment_plan']
        if 'assessed_by' in data:
            assessment.assessed_by = data['assessed_by']
        
        assessment.assessed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': assessment.to_dict(),
            'message': 'Cập nhật đánh giá thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi cập nhật đánh giá',
            'message': str(e)
        }), 500


@assessment_bp.route('/<patient_id>/outcome', methods=['GET'])
def get_patient_outcome(patient_id):
    """Get outcome for a patient"""
    try:
        outcome = Outcome.query.filter_by(patient_id=patient_id)\
            .order_by(Outcome.recorded_at.desc()).first()
        
        if not outcome:
            return jsonify({
                'success': False,
                'error': 'Chưa có kết cục'
            }), 404
        
        return jsonify({
            'success': True,
            'data': outcome.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy kết cục',
            'message': str(e)
        }), 500


@assessment_bp.route('/<patient_id>/outcome', methods=['POST'])
def create_outcome(patient_id):
    """Create or update outcome for a patient"""
    try:
        data = request.get_json()
        
        # Check if outcome already exists
        existing_outcome = Outcome.query.filter_by(patient_id=patient_id).first()
        
        if existing_outcome:
            # Update existing outcome
            outcome = existing_outcome
            for key, value in data.items():
                if hasattr(outcome, key):
                    setattr(outcome, key, value)
            outcome.recorded_at = datetime.utcnow()
        else:
            # Create new outcome
            outcome_data = {
                'patient_id': patient_id,
                'outcome_type': data.get('outcome_type'),
                'outcome_details': data.get('outcome_details'),
                'recorded_by': data.get('recorded_by', 'Unknown User')
            }
            
            # Optional fields
            if 'delivery_time' in data and data['delivery_time']:
                outcome_data['delivery_time'] = datetime.fromisoformat(data['delivery_time'])
            
            for field in ['baby_weight', 'baby_gender', 'apgar_1min', 'apgar_5min', 'complications', 'notes']:
                if field in data:
                    outcome_data[field] = data[field]
            
            outcome = Outcome(**outcome_data)
            db.session.add(outcome)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': outcome.to_dict(),
            'message': 'Lưu kết cục thành công'
        }), 201 if not existing_outcome else 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lưu kết cục',
            'message': str(e)
        }), 500


@assessment_bp.route('/<patient_id>/status', methods=['GET'])
def get_patient_status_assessment(patient_id):
    """Get comprehensive status assessment for a patient"""
    try:
        # Get current patient status from alert service
        current_status = partogram_service.alert_service.calculate_patient_status(patient_id)
        
        # Get recent alerts
        recent_alerts = partogram_service.alert_service.get_patient_alerts(patient_id)
        
        # Categorize alerts by type
        mother_alerts = [a for a in recent_alerts if a.alert_type == 'mother']
        fetus_alerts = [a for a in recent_alerts if a.alert_type == 'fetus']
        labor_alerts = [a for a in recent_alerts if a.alert_type == 'labor']
        
        # Determine status for each category
        def get_category_status(alerts):
            if any(a.severity == 'critical' for a in alerts):
                return 'critical'
            elif any(a.severity == 'warning' for a in alerts):
                return 'warning'
            else:
                return 'normal'
        
        # Special rule for fetus: CTG score overrides everything
        fetus_status = 'normal'
        ctg_alerts = [a for a in fetus_alerts if a.parameter == 'ctg']
        if ctg_alerts:
            for alert in ctg_alerts:
                if alert.severity == 'critical':
                    fetus_status = 'critical'
                    break
                elif alert.severity == 'warning':
                    fetus_status = 'warning'
        else:
            fetus_status = get_category_status(fetus_alerts)
        
        status_assessment = {
            'overall_status': current_status,
            'mother_status': get_category_status(mother_alerts),
            'fetus_status': fetus_status,
            'labor_status': get_category_status(labor_alerts),
            'alert_counts': {
                'total': len(recent_alerts),
                'critical': len([a for a in recent_alerts if a.severity == 'critical']),
                'warning': len([a for a in recent_alerts if a.severity == 'warning']),
                'mother': len(mother_alerts),
                'fetus': len(fetus_alerts),
                'labor': len(labor_alerts)
            },
            'recommendations': []
        }
        
        # Generate recommendations based on status
        if current_status == 'critical':
            status_assessment['recommendations'].append('CẦN CAN THIỆP NGAY - Liên hệ bác sĩ trực')
        elif current_status == 'warning':
            status_assessment['recommendations'].append('Cần theo dõi thêm - Tăng tần suất monitoring')
        
        if fetus_status == 'critical':
            status_assessment['recommendations'].append('Thai nhi có nguy cơ cao - Xem xét can thiệp sản khoa')
        
        return jsonify({
            'success': True,
            'data': status_assessment
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi đánh giá tình trạng',
            'message': str(e)
        }), 500