from flask import Blueprint, request, jsonify
from app.services.partogram_service import PartogramService

partogram_bp = Blueprint('partogram', __name__)
partogram_service = PartogramService()


@partogram_bp.route('/<patient_id>/records', methods=['GET'])
def get_partogram_records(patient_id):
    """Get all partogram records for a patient"""
    try:
        patient_data = partogram_service.get_patient_detail(patient_id)
        
        if not patient_data:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy bệnh nhân'
            }), 404
        
        return jsonify({
            'success': True,
            'data': patient_data['partogram_records']
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy dữ liệu partogram',
            'message': str(e)
        }), 500


@partogram_bp.route('/<patient_id>/records', methods=['POST'])
def add_partogram_record(patient_id):
    """Add a new partogram record"""
    try:
        data = request.get_json()
        
        record = partogram_service.add_partogram_record(patient_id, data)
        
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': 'Thêm dữ liệu khám thành công'
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi thêm dữ liệu khám',
            'message': str(e)
        }), 500


@partogram_bp.route('/records/<int:record_id>', methods=['PUT'])
def update_partogram_record(record_id):
    """Update an existing partogram record"""
    try:
        data = request.get_json()
        
        record = partogram_service.update_partogram_record(record_id, data)
        
        if not record:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy bản ghi'
            }), 404
        
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': 'Cập nhật dữ liệu thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi cập nhật dữ liệu',
            'message': str(e)
        }), 500


@partogram_bp.route('/records/<int:record_id>', methods=['DELETE'])
def delete_partogram_record(record_id):
    """Delete a partogram record"""
    try:
        success = partogram_service.delete_partogram_record(record_id)
        
        if not success:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy bản ghi'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'Xóa dữ liệu thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi xóa dữ liệu',
            'message': str(e)
        }), 500

@partogram_bp.route('/records/<int:record_id>/acknowledge', methods=['POST'])
def acknowledge_partogram_record(record_id):
    """Acknowledge a partogram record"""
    try:
        # Lấy thông tin từ request
        if request.is_json:
            data = request.json
            doctor_id = data.get('doctor_id', 'doc_demo')
            treatment_plan = data.get('treatment_plan')
            signature_data = data.get('signature_data')
        else:
            doctor_id = 'doc_demo'
            treatment_plan = None
            signature_data = None
            
        record = partogram_service.acknowledge_partogram_record(record_id, doctor_id, treatment_plan, signature_data)
        
        if not record:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy bản ghi'
            }), 404
        
        return jsonify({
            'success': True,
            'data': record.to_dict(),
            'message': 'Đã xác nhận dữ liệu thành công'
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi xác nhận dữ liệu',
            'message': str(e)
        }), 500


@partogram_bp.route('/<patient_id>/timeline', methods=['GET'])
def get_timeline_data(patient_id):
    """Get timeline visualization data"""
    try:
        zoom_level = request.args.get('zoom', '1h')
        
        timeline_data = partogram_service.get_timeline_data(patient_id, zoom_level)
        
        return jsonify({
            'success': True,
            'data': timeline_data
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy dữ liệu timeline',
            'message': str(e)
        }), 500


@partogram_bp.route('/<patient_id>/chart-data', methods=['GET'])
def get_chart_data(patient_id):
    """Get data formatted for chart display"""
    try:
        # Get chart type from query params
        chart_type = request.args.get('type', 'timeline')  # timeline, table, overview
        zoom_level = request.args.get('zoom', '1h')
        
        if chart_type == 'timeline':
            data = partogram_service.get_timeline_data(patient_id, zoom_level)
        else:
            # For other chart types, get basic patient data
            data = partogram_service.get_patient_detail(patient_id)
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Không tìm thấy bệnh nhân'
                }), 404
        
        return jsonify({
            'success': True,
            'data': data,
            'chart_type': chart_type
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi lấy dữ liệu biểu đồ',
            'message': str(e)
        }), 500


@partogram_bp.route('/<patient_id>/export', methods=['GET'])
def export_partogram_data(patient_id):
    """Export partogram data for printing or external use"""
    try:
        export_format = request.args.get('format', 'json')  # json, csv, pdf
        
        patient_data = partogram_service.get_patient_detail(patient_id)
        
        if not patient_data:
            return jsonify({
                'success': False,
                'error': 'Không tìm thấy bệnh nhân'
            }), 404
        
        # For now, return JSON format
        # TODO: Implement CSV and PDF export formats
        
        return jsonify({
            'success': True,
            'data': patient_data,
            'export_format': export_format,
            'exported_at': partogram_service.alert_service.alert_service.datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Lỗi khi xuất dữ liệu',
            'message': str(e)
        }), 500