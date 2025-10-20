from flask import Blueprint, request, jsonify
from app.services.partogram_service import PartogramService
from app.services.alert_service import AlertService
from datetime import datetime

patient_bp = Blueprint('patients', __name__)
partogram_service = PartogramService()
alert_service = AlertService()


@patient_bp.route('/', methods=['GET'])
def get_all_patients():
    """Get all patients with current status"""
    try:
        patients = partogram_service.get_all_patients()
        return jsonify({
            'success': True,
            'data': patients,
            'count': len(patients)
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy danh sách bệnh nhân',
            'message': str(e)
        }), 500


@patient_bp.route('/', methods=['POST'])
def create_patient():
    """Create a new patient"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['id', 'name', 'age', 'room', 'gestational_week', 'parity', 'labor_diagnosis_time']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Thiếu trường bắt buộc: {field}'
                }), 400
        
        patient = partogram_service.create_patient(data)
        
        return jsonify({
            'success': True,
            'data': patient.to_dict(),
            'message': 'Tạo bệnh nhân thành công'
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi tạo bệnh nhân',
            'message': str(e)
        }), 500


@patient_bp.route('/<patient_id>', methods=['GET'])
def get_patient_detail(patient_id):
    """Get detailed patient information"""
    try:
        patient_data = partogram_service.get_patient_detail(patient_id)
        
        if not patient_data:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy bệnh nhân'
            }), 404
        
        return jsonify({
            'success': True,
            'data': patient_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy thông tin bệnh nhân',
            'message': str(e)
        }), 500


@patient_bp.route('/dashboard/summary', methods=['GET'])
def get_dashboard_summary():
    """Get dashboard summary statistics"""
    try:
        summary = alert_service.get_dashboard_summary()
        
        return jsonify({
            'success': True,
            'data': summary
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy thống kê tổng quan',
            'message': str(e)
        }), 500


@patient_bp.route('/<patient_id>/alerts', methods=['GET'])
def get_patient_alerts(patient_id):
    """Get alerts for a specific patient"""
    try:
        include_acknowledged = request.args.get('include_acknowledged', 'false').lower() == 'true'
        alerts = alert_service.get_patient_alerts(patient_id, include_acknowledged)
        
        return jsonify({
            'success': True,
            'data': [alert.to_dict() for alert in alerts],
            'count': len(alerts)
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy cảnh báo',
            'message': str(e)
        }), 500


@patient_bp.route('/alerts/<int:alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    """Acknowledge an alert"""
    try:
        data = request.get_json()
        acknowledged_by = data.get('acknowledged_by', 'Unknown User')
        
        success = alert_service.acknowledge_alert(alert_id, acknowledged_by)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Đã xác nhận cảnh báo'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy cảnh báo'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi xác nhận cảnh báo',
            'message': str(e)
        }), 500