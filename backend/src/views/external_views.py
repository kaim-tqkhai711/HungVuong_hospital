from flask import Blueprint, request, jsonify
from src.services.hospital_api_service import HospitalApiService

external_bp = Blueprint("external", __name__)
hospital_api = HospitalApiService()


@external_bp.route("/dieutri-chamsoc/<mabn>", methods=["GET"])
def get_dieutri_chamsoc(mabn):
    """Get patient treatment/care data from BV Hung Vuong Hospital"""
    try:
        ngay = request.args.get("ngay", None)
        maql = request.args.get("maql", "")
        id = request.args.get("id", "")

        data = hospital_api.get_dieutri_chamsoc(mabn, ngay, maql, id)

        if data:
            return jsonify({"success": True, "data": data}), 200
        else:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Không tìm thấy dữ liệu điều trị cho bệnh nhân này",
                    }
                ),
                404,
            )

    except Exception as e:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Lỗi khi lấy dữ liệu từ hệ thống bệnh viện",
                    "message": str(e),
                }
            ),
            500,
        )


@external_bp.route("/health", methods=["GET"])
def check_health():
    """Check connectivity to BV Hung Vuong Hospital API"""
    try:
        is_healthy = hospital_api.check_health()
        return (
            jsonify({"success": True, "data": {"hospital_api_reachable": is_healthy}}),
            200,
        )
    except Exception as e:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Không thể kiểm tra kết nối",
                    "message": str(e),
                }
            ),
            500,
        )
