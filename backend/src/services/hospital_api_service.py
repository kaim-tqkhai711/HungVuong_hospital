import json
import os
from datetime import datetime
from typing import Optional, Dict

import requests


class HospitalApiService:
    """Service to communicate with BV Hung Vuong Hospital GraphQL API"""

    def __init__(self):
        self.graphql_url = os.environ.get(
            "HOSPITAL_GRAPHQL_URL", "https://hsoftapigraph.bvhungvuong.vn/graphql/"
        )
        self.api_key = os.environ.get("HOSPITAL_API_KEY", "")
        self.timeout = int(os.environ.get("HOSPITAL_API_TIMEOUT", "15"))

    def get_dieutri_chamsoc(
        self, mabn: str, ngay: Optional[str] = None, maql: str = "", id: str = ""
    ) -> Optional[Dict]:
        """
        Get patient treatment/care data from hospital system.

        Args:
            mabn: Patient ID (e.g. "25261589")
            ngay: Date in dd/mm/yyyy format (defaults to today)
            maql: Management code
            id: Record ID

        Returns:
            Dict with keys: hoten, mabn, ngay, features, nhandinh, kehoach
            or None on error
        """
        if ngay is None:
            ngay = datetime.now().strftime("%d/%m/%Y")

        query = (
            "query {{ dieutriChamsocSk("
            'key: "{key}", '
            'mabn: "{mabn}", '
            'maql: "{maql}", '
            'ngay: "{ngay}", '
            'id: "{id}"'
            ") }}"
        ).format(key=self.api_key, mabn=mabn, maql=maql, ngay=ngay, id=id)

        try:
            response = requests.post(
                self.graphql_url,
                json={"query": query},
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()

            raw_data = result.get("data", {}).get("dieutriChamsocSk")
            if raw_data:
                parsed = json.loads(raw_data)
                if "error" not in parsed:
                    return parsed
            return None
        except requests.exceptions.Timeout:
            print(f"Hospital API timeout for mabn={mabn}")
            return None
        except requests.exceptions.RequestException as e:
            print(f"Hospital API error for mabn={mabn}: {e}")
            return None
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Hospital API parse error for mabn={mabn}: {e}")
            return None

    def check_health(self) -> bool:
        """Test connectivity to the hospital GraphQL API"""
        try:
            response = requests.post(
                self.graphql_url,
                json={"query": "{}"},
                headers={"Content-Type": "application/json"},
                timeout=self.timeout,
            )
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
