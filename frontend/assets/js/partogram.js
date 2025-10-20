// Main application for partogram page
class PartogramApp {
    constructor() {
        this.apiService = new ApiService();
        this.timeline = null;
        this.currentPatient = null;
        this.patientId = null;
        this.clockInterval = null;
        
        this.init();
    }

    async init() {
        this.initializeClock();
        this.parseUrlParams();
        this.bindEvents();
        
        if (this.patientId) {
            await this.loadPatientData();
            this.initializeTimeline();
        } else {
            AlertUtils.showNotification('Không tìm thấy ID bệnh nhân', 'error');
        }
    }

    initializeClock() {
        this.clockInterval = DateUtils.updateClock('currentDate', 'currentTime');
    }

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.patientId = urlParams.get('patient');
    }

    bindEvents() {
        // Overview button
        const btnOverview = document.getElementById('btnOverview');
        if (btnOverview) {
            btnOverview.addEventListener('click', () => this.showOverview());
        }

        // Add record button
        const btnAddRecord = document.getElementById('btnAddRecord');
        if (btnAddRecord) {
            btnAddRecord.addEventListener('click', () => this.showAddRecordForm());
        }

        // Assessment form
        const btnSaveAssessment = document.querySelector('.btn-save-assessment');
        if (btnSaveAssessment) {
            btnSaveAssessment.addEventListener('click', () => this.saveAssessment());
        }

        // Outcome form
        const btnSaveOutcome = document.querySelector('.btn-save-outcome');
        if (btnSaveOutcome) {
            btnSaveOutcome.addEventListener('click', () => this.saveOutcome());
        }

        // Modal events
        this.bindModalEvents();
    }

    bindModalEvents() {
        // Close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    async loadPatientData() {
        try {
            const response = await this.apiService.getPatient(this.patientId);
            
            if (response.success) {
                this.currentPatient = response.data;
                this.renderPatientHeader();
                this.renderAssessmentStatus();
                await this.loadOutcome();
            } else {
                throw new Error(response.error || 'Lỗi khi tải thông tin bệnh nhân');
            }
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi tải thông tin bệnh nhân: ' + error.message, 'error');
        }
    }

    renderPatientHeader() {
        const container = document.getElementById('patientHeaderCard');
        if (!container) return;

        const patient = this.currentPatient;
        const statusBadge = AlertUtils.getStatusBadgeHtml(patient.status);

        container.innerHTML = `
            <div class="patient-header-content">
                <div class="patient-basic-info">
                    <h2>${patient.name} (${patient.id})</h2>
                    <div class="patient-details">
                        <div class="detail-item">
                            <span class="detail-label">Tuổi</span>
                            <span class="detail-value">${patient.age} tuổi</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phòng</span>
                            <span class="detail-value">${patient.room}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Tuần thai</span>
                            <span class="detail-value">${patient.gestational_week}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Para</span>
                            <span class="detail-value">${patient.parity}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Vào chuyển dạ</span>
                            <span class="detail-value">${DateUtils.formatDateTime(patient.labor_diagnosis_time)}</span>
                        </div>
                    </div>
                </div>
                <div class="patient-status-overview">
                    <div class="overall-status ${patient.status}">
                        ${AlertUtils.getStatusText(patient.status)}
                    </div>
                    <div class="status-time">
                        Cập nhật: ${DateUtils.getTimeAgo(patient.updated_at)}
                    </div>
                </div>
            </div>
        `;
    }

    async renderAssessmentStatus() {
        try {
            const response = await this.apiService.getPatientStatusAssessment(this.patientId);
            
            if (response.success) {
                const status = response.data;
                
                // Update status indicators
                this.updateStatusBadge('motherStatusBadge', status.mother_status);
                this.updateStatusBadge('fetusStatusBadge', status.fetus_status);
                this.updateStatusBadge('overallStatusBadge', status.overall_status);
            }
        } catch (error) {
            console.error('Error loading assessment status:', error);
        }
    }

    updateStatusBadge(elementId, status) {
        const element = document.getElementById(elementId);
        if (element) {
            element.className = `status-badge ${AlertUtils.getStatusClass(status)}`;
            element.textContent = AlertUtils.getStatusText(status);
        }
    }

    initializeTimeline() {
        if (!this.timeline) {
            this.timeline = new Timeline('timelineContainer', {
                zoomLevel: '1h',
                showGrid: true,
                showThresholds: true
            });
        }
        
        this.timeline.loadData(this.patientId);
    }

    showOverview() {
        const modal = document.getElementById('overviewModal');
        const content = document.getElementById('overviewContent');
        
        if (this.currentPatient) {
            content.innerHTML = this.renderOverviewContent();
            modal.style.display = 'block';
        }
    }

    renderOverviewContent() {
        const patient = this.currentPatient;
        const records = patient.partogram_records || [];
        const alerts = patient.alerts || [];
        
        // Calculate statistics
        const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
        const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
        const totalRecords = records.length;
        
        const laborDuration = patient.labor_diagnosis_time ? 
            DateUtils.getDifferenceInHours(new Date(), patient.labor_diagnosis_time) : 0;

        return `
            <div class="overview-grid">
                <div class="overview-section">
                    <h4>📊 Thống kê chung</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Thời gian chuyển dạ:</span>
                            <span class="stat-value">${DateUtils.formatDuration(laborDuration * 60)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Số lần khám:</span>
                            <span class="stat-value">${totalRecords}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Cảnh báo nghiêm trọng:</span>
                            <span class="stat-value critical">${criticalAlerts}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Cảnh báo cần theo dõi:</span>
                            <span class="stat-value warning">${warningAlerts}</span>
                        </div>
                    </div>
                </div>

                <div class="overview-section">
                    <h4>📈 Diễn biến gần đây</h4>
                    <div class="recent-records">
                        ${records.slice(-3).map(record => `
                            <div class="record-summary">
                                <div class="record-time">${DateUtils.formatTime(record.recorded_at)}</div>
                                <div class="record-vitals">
                                    Mạch: ${record.mother.pulse || 'N/A'} | 
                                    HA: ${record.mother.systolic_bp || 'N/A'}/${record.mother.diastolic_bp || 'N/A'} | 
                                    Tim thai: ${record.fetus.fetal_heart_rate || 'N/A'} |
                                    Mở cổ: ${record.labor.cervix_dilation || 'N/A'}cm
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="overview-section">
                    <h4>⚠️ Cảnh báo hiện tại</h4>
                    <div class="current-alerts">
                        ${alerts.slice(0, 5).map(alert => AlertUtils.createAlertCard(alert)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    showAddRecordForm() {
        const modal = document.getElementById('addRecordModal');
        const form = document.getElementById('addRecordForm');
        
        form.innerHTML = this.renderAddRecordForm();
        this.bindAddRecordEvents();
        modal.style.display = 'block';
    }

    renderAddRecordForm() {
        const now = new Date();
        const timeString = now.toISOString().slice(0, 16); // Format for datetime-local input
        
        return `
            <form class="add-record-form" id="partogramForm">
                <div class="form-sections">
                    <div class="form-section">
                        <h4>⏰ Thời gian khám</h4>
                        <div class="form-group">
                            <label class="form-label">Thời gian</label>
                            <input type="datetime-local" class="form-input" name="recorded_at" value="${timeString}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Giờ từ khi bắt đầu mở cổ</label>
                            <input type="number" class="form-input" name="time_since_dilation" step="0.5" placeholder="VD: 3.5">
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>👩 Chăm sóc hỗ trợ</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" name="companion"> Có người thân đi cùng
                                </label>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Thang điểm đau (VAS)</label>
                                <select class="form-select" name="vas_score">
                                    <option value="">Chọn điểm</option>
                                    ${Array.from({length: 11}, (_, i) => 
                                        `<option value="${i}">${i} - ${this.getVASDescription(i)}</option>`
                                    ).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" name="drinking"> Được uống nước
                                </label>
                            </div>
                            <div class="form-group">
                                <label class="form-label">
                                    <input type="checkbox" name="eating"> Được ăn
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>🫀 Tình trạng mẹ</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Mạch (bpm)</label>
                                <input type="number" class="form-input" name="pulse" placeholder="VD: 80">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Huyết áp tâm thu (mmHg)</label>
                                <input type="number" class="form-input" name="systolic_bp" placeholder="VD: 120">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Huyết áp tâm trương (mmHg)</label>
                                <input type="number" class="form-input" name="diastolic_bp" placeholder="VD: 80">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Nhiệt độ (°C)</label>
                                <input type="number" class="form-input" name="temperature" step="0.1" placeholder="VD: 36.5">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Nước tiểu</label>
                                <select class="form-select" name="urine">
                                    <option value="">Chọn</option>
                                    <option value="Bình thường">Bình thường</option>
                                    <option value="Protein +">Protein +</option>
                                    <option value="Protein ++">Protein ++</option>
                                    <option value="Protein +++">Protein +++</option>
                                    <option value="Glucose +">Glucose +</option>
                                    <option value="Ketones +">Ketones +</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>👶 Thai nhi</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Tim thai (bpm)</label>
                                <input type="number" class="form-input" name="fetal_heart_rate" placeholder="VD: 140">
                            </div>
                            <div class="form-group">
                                <label class="form-label">CTG</label>
                                <select class="form-select" name="ctg_score">
                                    <option value="">Chọn cấp độ</option>
                                    <option value="0">Cấp 0 - Bình thường</option>
                                    <option value="1">Cấp 1 - Bình thường</option>
                                    <option value="2">Cấp 2 - Nguy cơ</option>
                                    <option value="3">Cấp 3 - Nguy hiểm</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Nước ối</label>
                                <select class="form-select" name="amniotic_fluid">
                                    <option value="">Chọn</option>
                                    <option value="Trong">Trong</option>
                                    <option value="Đục nhẹ">Đục nhẹ</option>
                                    <option value="Đục nặng">Đục nặng</option>
                                    <option value="Có máu">Có máu</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Vị trí thai</label>
                                <input type="text" class="form-input" name="fetal_position" placeholder="VD: Chẩm trước">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>🤰 Tiến triển chuyển dạ</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Cơn co/10 phút</label>
                                <input type="number" class="form-input" name="contractions_per_10min" placeholder="VD: 4">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Thời gian cơn co (giây)</label>
                                <input type="number" class="form-input" name="contraction_duration" placeholder="VD: 45">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">Mở cổ tử cung (cm)</label>
                                <input type="number" class="form-input" name="cervix_dilation" min="0" max="10" placeholder="VD: 5">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Station</label>
                                <input type="text" class="form-input" name="station" placeholder="VD: -2">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4>💊 Thuốc và truyền dịch</h4>
                        <div class="form-group">
                            <label class="form-label">Thuốc uống</label>
                            <input type="text" class="form-input" name="oral_medication" placeholder="Tên thuốc, liều lượng">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Thuốc tiêm</label>
                            <input type="text" class="form-input" name="injection_medication" placeholder="Tên thuốc, liều lượng">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Truyền dịch</label>
                            <input type="text" class="form-input" name="infusion_medication" placeholder="VD: Ringer Lactate 500ml">
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('addRecordModal').style.display='none'">
                        Hủy
                    </button>
                    <button type="submit" class="btn-primary">
                        💾 Lưu lần khám
                    </button>
                </div>
            </form>
        `;
    }

    getVASDescription(score) {
        const descriptions = {
            0: 'Không đau',
            1: 'Đau rất nhẹ',
            2: 'Đau nhẹ', 
            3: 'Đau vừa',
            4: 'Đau khá',
            5: 'Đau trung bình',
            6: 'Đau nhiều',
            7: 'Đau rất nhiều',
            8: 'Đau dữ dội',
            9: 'Đau cực độ',
            10: 'Đau không chịu nổi'
        };
        return descriptions[score] || '';
    }

    bindAddRecordEvents() {
        const form = document.getElementById('partogramForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.savePartogramRecord(e.target);
            });
        }
    }

    async savePartogramRecord(form) {
        try {
            const formData = new FormData(form);
            const recordData = this.formatPartogramData(formData);
            
            const response = await this.apiService.addPartogramRecord(this.patientId, recordData);
            
            if (response.success) {
                AlertUtils.showNotification('Đã lưu dữ liệu khám thành công', 'success');
                
                // Close modal
                document.getElementById('addRecordModal').style.display = 'none';
                
                // Reload data
                await this.loadPatientData();
                this.timeline.loadData(this.patientId);
                
            } else {
                throw new Error(response.error || 'Lỗi khi lưu dữ liệu');
            }
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi lưu dữ liệu: ' + error.message, 'error');
        }
    }

    formatPartogramData(formData) {
        const data = {};
        
        // Convert FormData to object
        for (let [key, value] of formData.entries()) {
            if (value !== '') {
                // Handle checkboxes
                if (form.querySelector(`[name="${key}"]`).type === 'checkbox') {
                    data[key] = true;
                } else {
                    // Convert numbers
                    const numValue = Number(value);
                    data[key] = isNaN(numValue) ? value : numValue;
                }
            }
        }
        
        // Handle unchecked checkboxes
        const checkboxes = form.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                data[checkbox.name] = false;
            }
        });
        
        return {
            recorded_at: data.recorded_at,
            time_since_dilation: data.time_since_dilation,
            supportive_care: {
                companion: data.companion || false,
                vas_score: data.vas_score,
                drinking: data.drinking || false,
                eating: data.eating || false
            },
            mother: {
                pulse: data.pulse,
                systolic_bp: data.systolic_bp,
                diastolic_bp: data.diastolic_bp,
                temperature: data.temperature,
                urine: data.urine
            },
            fetus: {
                fetal_heart_rate: data.fetal_heart_rate,
                ctg_score: data.ctg_score,
                amniotic_fluid: data.amniotic_fluid,
                fetal_position: data.fetal_position
            },
            labor: {
                contractions_per_10min: data.contractions_per_10min,
                contraction_duration: data.contraction_duration,
                cervix_dilation: data.cervix_dilation,
                station: data.station
            },
            medication: {
                oral: data.oral_medication,
                injection: data.injection_medication,
                infusion: data.infusion_medication
            }
        };
    }

    async saveAssessment() {
        try {
            const nurseAssessment = document.getElementById('nurseAssessment').value;
            const doctorAssessment = document.getElementById('doctorAssessment').value;
            const treatmentPlan = document.getElementById('treatmentPlan').value;
            
            const assessmentData = {
                nurse_assessment: nurseAssessment,
                doctor_assessment: doctorAssessment,
                treatment_plan: treatmentPlan,
                assessed_by: 'Người dùng hiện tại' // TODO: Get from auth
            };
            
            const response = await this.apiService.createAssessment(this.patientId, assessmentData);
            
            if (response.success) {
                AlertUtils.showNotification('Đã lưu đánh giá thành công', 'success');
            } else {
                throw new Error(response.error || 'Lỗi khi lưu đánh giá');
            }
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi lưu đánh giá: ' + error.message, 'error');
        }
    }

    async saveOutcome() {
        try {
            const selectedOutcome = document.querySelector('input[name="outcome"]:checked');
            const outcomeOther = document.getElementById('outcomeOther').value;
            
            if (!selectedOutcome) {
                AlertUtils.showNotification('Vui lòng chọn kết cục', 'warning');
                return;
            }
            
            const outcomeData = {
                outcome_type: selectedOutcome.value,
                outcome_details: selectedOutcome.value === 'khac' ? outcomeOther : null,
                recorded_by: 'Người dùng hiện tại' // TODO: Get from auth
            };
            
            const response = await this.apiService.savePatientOutcome(this.patientId, outcomeData);
            
            if (response.success) {
                AlertUtils.showNotification('Đã lưu kết cục thành công', 'success');
            } else {
                throw new Error(response.error || 'Lỗi khi lưu kết cục');
            }
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi lưu kết cục: ' + error.message, 'error');
        }
    }

    async loadOutcome() {
        try {
            const response = await this.apiService.getPatientOutcome(this.patientId);
            
            if (response.success) {
                // Pre-fill outcome form
                const outcome = response.data;
                const outcomeRadio = document.querySelector(`input[name="outcome"][value="${outcome.outcome_type}"]`);
                if (outcomeRadio) {
                    outcomeRadio.checked = true;
                }
                
                if (outcome.outcome_details) {
                    document.getElementById('outcomeOther').value = outcome.outcome_details;
                }
            }
        } catch (error) {
            // Outcome not found is OK - means it hasn't been set yet
        }
    }

    destroy() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        
        if (this.timeline) {
            this.timeline.destroy();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.partogramApp = new PartogramApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.partogramApp) {
        window.partogramApp.destroy();
    }
});