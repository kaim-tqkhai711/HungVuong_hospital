// API Service for communicating with backend
class ApiService {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:5000/api';
        this.headers = {
            'Content-Type': 'application/json',
        };
    }

    async makeRequest(endpoint, options = {}) {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const config = {
                headers: this.headers,
                ...options
            };

            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    // Patient endpoints
    async getAllPatients() {
        return this.makeRequest('/patients/');
    }

    async getPatient(patientId) {
        return this.makeRequest(`/patients/${patientId}`);
    }

    async createPatient(patientData) {
        return this.makeRequest('/patients/', {
            method: 'POST',
            body: JSON.stringify(patientData)
        });
    }

    async updatePatient(patientId, patientData) {
        return this.makeRequest(`/patients/${patientId}`, {
            method: 'PUT',
            body: JSON.stringify(patientData)
        });
    }

    async getDashboardSummary() {
        return this.makeRequest('/patients/dashboard/summary');
    }

    // Partogram endpoints
    async getPartogramRecords(patientId) {
        return this.makeRequest(`/partogram/${patientId}/records`);
    }

    async createPartogramRecord(recordData) {
        return this.makeRequest(`/partogram/${recordData.patient_id}/records`, {
            method: 'POST',
            body: JSON.stringify(recordData)
        });
    }

    async addPartogramRecord(patientId, recordData) {
        return this.makeRequest(`/partogram/${patientId}/records`, {
            method: 'POST',
            body: JSON.stringify(recordData)
        });
    }

    async updatePartogramRecord(recordId, recordData) {
        return this.makeRequest(`/partogram/records/${recordId}`, {
            method: 'PUT',
            body: JSON.stringify(recordData)
        });
    }

    async deletePartogramRecord(recordId) {
        return this.makeRequest(`/partogram/records/${recordId}`, {
            method: 'DELETE'
        });
    }

    async getTimelineData(patientId, zoomLevel = '1h') {
        return this.makeRequest(`/partogram/${patientId}/timeline?zoom=${zoomLevel}`);
    }

    async getChartData(patientId, chartType = 'timeline', zoomLevel = '1h') {
        return this.makeRequest(`/partogram/${patientId}/chart-data?type=${chartType}&zoom=${zoomLevel}`);
    }

    // Assessment endpoints
    async getAssessment(patientId) {
        return this.makeRequest(`/assessments/${patientId}`);
    }

    async getPatientAssessments(patientId) {
        return this.makeRequest(`/assessments/${patientId}`);
    }

    async createAssessment(patientId, assessmentData) {
        return this.makeRequest(`/assessments/${patientId}`, {
            method: 'POST',
            body: JSON.stringify(assessmentData)
        });
    }

    async updateAssessment(assessmentId, assessmentData) {
        return this.makeRequest(`/assessments/${assessmentId}`, {
            method: 'PUT',
            body: JSON.stringify(assessmentData)
        });
    }

    async getPatientOutcome(patientId) {
        return this.makeRequest(`/assessments/${patientId}/outcome`);
    }

    async saveOutcome(outcomeData) {
        return this.makeRequest(`/assessments/${outcomeData.patient_id}/outcome`, {
            method: 'POST',
            body: JSON.stringify(outcomeData)
        });
    }

    async savePatientOutcome(patientId, outcomeData) {
        return this.makeRequest(`/assessments/${patientId}/outcome`, {
            method: 'POST',
            body: JSON.stringify(outcomeData)
        });
    }

    async getPatientStatusAssessment(patientId) {
        return this.makeRequest(`/assessments/${patientId}/status`);
    }

    async acknowledgePartogramRecord(recordId, payload = {}) {
        return this.makeRequest(`/partogram/records/${recordId}/acknowledge`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    // Alert endpoints
    async getPatientAlerts(patientId, includeAcknowledged = false) {
        return this.makeRequest(`/patients/${patientId}/alerts?include_acknowledged=${includeAcknowledged}`);
    }

    async acknowledgeAlert(alertId, acknowledgedBy) {
        return this.makeRequest(`/patients/alerts/${alertId}/acknowledge`, {
            method: 'POST',
            body: JSON.stringify({ acknowledged_by: acknowledgedBy })
        });
    }

    // Utility methods
    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getStatusColor(status) {
        const colors = {
            'normal': '#48bb78',
            'warning': '#ecc94b', 
            'critical': '#f56565'
        };
        return colors[status] || colors.normal;
    }

    getStatusText(status) {
        const texts = {
            'normal': 'Bình thường',
            'warning': 'Cần theo dõi',
            'critical': 'Nghiêm trọng'
        };
        return texts[status] || texts.normal;
    }
}

// Export for use in other modules
window.ApiService = ApiService;