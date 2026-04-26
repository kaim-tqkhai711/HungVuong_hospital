// Main application logic for the patient list page - Updated 2025/10/21
class PatientListApp {
    constructor() {
        this.apiService = new ApiService();
        this.patients = [];
        this.filteredPatients = [];
        this.currentFilter = 'all';
        this.clockInterval = null;
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        this.initializeClock();
        this.bindEvents();
        await this.loadInitialData();
        this.startAutoRefresh();
    }

    initializeClock() {
        this.clockInterval = DateUtils.updateClock('currentDate', 'currentTime');
    }

    bindEvents() {
        // Filter tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        // Modal events
        const modal = document.getElementById('quickViewModal');
        const closeModal = document.getElementById('closeModal');
        
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Close modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Add Patient button
        const addPatientBtn = document.getElementById('btnAddPatient');
        const addPatientModal = document.getElementById('addPatientModal');
        const closeAddPatientModal = document.getElementById('closeAddPatientModal');
        
        if (addPatientBtn) {
            addPatientBtn.addEventListener('click', () => {
                this.showAddPatientModal();
            });
        }

        if (closeAddPatientModal) {
            closeAddPatientModal.addEventListener('click', () => {
                addPatientModal.style.display = 'none';
            });
        }

        // Close add patient modal on outside click
        window.addEventListener('click', (e) => {
            if (e.target === addPatientModal) {
                addPatientModal.style.display = 'none';
            }
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadPatients(),
                this.loadDashboardSummary()
            ]);
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi tải dữ liệu: ' + error.message, 'error');
        }
    }

    async loadPatients() {
        try {
            const response = await this.apiService.getAllPatients();
            
            if (response.success) {
                this.patients = response.data;
                console.log('Loaded patients data:', this.patients);
                console.log('First patient structure:', this.patients[0]);
                this.applyFilter();
                this.renderPatientList();
            } else {
                throw new Error(response.error || 'Lỗi khi tải danh sách bệnh nhân');
            }
        } catch (error) {
            console.error('Error loading patients:', error);
            this.renderError(error.message);
        }
    }

    async loadDashboardSummary() {
        try {
            const response = await this.apiService.getDashboardSummary();
            
            if (response.success) {
                this.renderStatusSummary(response.data);
            }
        } catch (error) {
            console.error('Error loading dashboard summary:', error);
        }
    }

    renderStatusSummary(summary) {
        const { status_counts } = summary;
        
        document.getElementById('criticalCount').textContent = status_counts.critical || 0;
        document.getElementById('warningCount').textContent = status_counts.warning || 0;
        document.getElementById('normalCount').textContent = status_counts.normal || 0;
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.applyFilter();
        this.renderPatientList();
    }

    applyFilter() {
        if (this.currentFilter === 'all') {
            this.filteredPatients = [...this.patients];
        } else {
            this.filteredPatients = this.patients.filter(patient => 
                patient.status === this.currentFilter
            );
        }
    }

    renderPatientList() {
        const patientList = document.getElementById('patientList');
        
        if (!this.filteredPatients.length) {
            patientList.innerHTML = this.renderEmptyState();
            return;
        }

        patientList.innerHTML = this.filteredPatients.map(patient => 
            this.renderPatientCard(patient)
        ).join('');
        
        // Bind click events to patient cards
        patientList.querySelectorAll('.patient-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const patientId = card.dataset.patientId;
                console.log('Clicked patient card, ID:', patientId);
                console.log('Card data:', card.dataset);
                this.openPatientDetail(patientId);
            });
        });
    }

    renderPatientCard(patient) {
        const statusBadge = AlertUtils.getStatusBadgeHtml(patient.status);
        console.log('Patient status:', patient.status, 'Badge HTML:', statusBadge); // Debug log
        const alertsHtml = patient.alerts ? patient.alerts.map(alert => 
            `<div class="alert-item ${alert.severity}">${alert.message}</div>`
        ).join('') : '';

        return `
            <div class="patient-card" data-patient-id="${patient.id}">
                <div class="patient-card-header">
                    <div class="patient-info">
                        <h3>${patient.name}</h3>
                        <div class="patient-meta">
                            <span>📋 ${patient.id} - Phòng ${patient.room}</span>
                            <span>🤰 ${patient.gestational_week} - ${patient.parity}</span>
                            <span>🕐 Vào chuyển dạ: ${DateUtils.formatDateTime(patient.labor_diagnosis_time)}</span>
                        </div>
                    </div>
                    ${statusBadge}
                </div>
                <div class="patient-card-body">
                    ${alertsHtml ? `
                        <div class="patient-alerts">
                            ${alertsHtml}
                        </div>
                    ` : ''}
                    <div class="patient-last-check">
                        Khám lần cuối: ${patient.last_check || 'Chưa có dữ liệu'}
                    </div>
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        const messages = {
            all: 'Chưa có bệnh nhân nào',
            critical: 'Không có bệnh nhân nghiêm trọng',
            warning: 'Không có bệnh nhân cần theo dõi',
            normal: 'Không có bệnh nhân bình thường'
        };

        return `
            <div class="empty-state">
                <div class="empty-icon">👥</div>
                <h3>${messages[this.currentFilter]}</h3>
                <p>Danh sách sẽ cập nhật tự động khi có thêm dữ liệu</p>
            </div>
        `;
    }

    renderError(message) {
        const patientList = document.getElementById('patientList');
        patientList.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Có lỗi xảy ra</h3>
                <p>${message}</p>
                <button class="btn-primary" onclick="location.reload()">Thử lại</button>
            </div>
        `;
    }

    openPatientDetail(patientId) {
        // Navigate to patient detail page
        console.log('Navigating to patient detail, ID:', patientId);
        
        // Backup ID vào sessionStorage đề phòng trường hợp web server (như npx serve)
        // tự động cắt bỏ phần ?id=... trong URL (Clean URLs config).
        sessionStorage.setItem('current_patient_id', patientId);
        
        const url = `patient-detail.html?id=${patientId}`;
        console.log('Generated URL:', url);
        window.location.href = url;
    }

    async showQuickView(patientId) {
        try {
            const response = await this.apiService.getPatient(patientId);
            
            if (response.success) {
                this.renderQuickViewModal(response.data);
            }
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi tải thông tin bệnh nhân: ' + error.message, 'error');
        }
    }

    renderQuickViewModal(patient) {
        const modal = document.getElementById('quickViewModal');
        const modalBody = document.getElementById('modalBody');
        
        const latestRecord = patient.partogram_records?.[patient.partogram_records.length - 1];
        const recentAlerts = patient.alerts?.slice(0, 5) || [];
        
        modalBody.innerHTML = `
            <h2>${patient.name} (${patient.id})</h2>
            <div class="quick-view-grid">
                <div class="quick-view-section">
                    <h4>Thông tin cơ bản</h4>
                    <p><strong>Tuổi:</strong> ${patient.age}</p>
                    <p><strong>Phòng:</strong> ${patient.room}</p>
                    <p><strong>Tuần thai:</strong> ${patient.gestational_week}</p>
                    <p><strong>Para:</strong> ${patient.parity}</p>
                </div>
                
                ${latestRecord ? `
                    <div class="quick-view-section">
                        <h4>Khám lần cuối (${DateUtils.formatDateTime(latestRecord.recorded_at)})</h4>
                        <div class="vitals-grid">
                            <div>Mạch: ${latestRecord.mother.pulse || 'N/A'} bpm</div>
                            <div>HA: ${latestRecord.mother.systolic_bp || 'N/A'}/${latestRecord.mother.diastolic_bp || 'N/A'} mmHg</div>
                            <div>Nhiệt độ: ${latestRecord.mother.temperature || 'N/A'}°C</div>
                            <div>Tim thai: ${latestRecord.fetus.fetal_heart_rate || 'N/A'} bpm</div>
                            <div>CTG: ${latestRecord.fetus.ctg_score !== null ? 'Cấp ' + latestRecord.fetus.ctg_score : 'N/A'}</div>
                            <div>Mở cổ: ${latestRecord.labor.cervix_dilation || 'N/A'} cm</div>
                        </div>
                    </div>
                ` : ''}
                
                ${recentAlerts.length ? `
                    <div class="quick-view-section">
                        <h4>Cảnh báo gần đây</h4>
                        ${recentAlerts.map(alert => AlertUtils.createAlertCard(alert)).join('')}
                    </div>
                ` : ''}
            </div>
            
            <div class="quick-view-actions">
                <button class="btn-primary" onclick="patientListApp.openPatientDetail('${patient.id}')">
                    Xem chi tiết
                </button>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    showAddPatientModal() {
        const modal = document.getElementById('addPatientModal');
        const formContainer = document.getElementById('addPatientForm');
        
        formContainer.innerHTML = `
            <form id="newPatientForm" class="add-patient-form">
                <div class="form-section">
                    <h3>👤 Thông tin cơ bản</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Mã bệnh nhân:</label>
                            <input type="text" name="id" placeholder="Để trống để tự động tạo (BN00001, BN00002...)">
                            <small class="form-hint">Có thể để trống, hệ thống sẽ tự động tạo mã duy nhất</small>
                        </div>
                        <div class="form-group">
                            <label>Họ và tên *:</label>
                            <input type="text" name="name" placeholder="VD: Nguyễn Thị Hoa" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tuổi *:</label>
                            <input type="number" name="age" min="15" max="50" value="28" required>
                        </div>
                        <div class="form-group">
                            <label>Phòng *:</label>
                            <input type="text" name="room" placeholder="VD: P301" required>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>🤰 Thông tin sản khoa</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Tuần thai *:</label>
                            <input type="text" name="gestational_week" placeholder="VD: 39 tuần 2 ngày" required>
                        </div>
                        <div class="form-group">
                            <label>Para * (4 chữ số):</label>
                            <input type="text" name="parity" placeholder="VD: 0000, 0100, 0210" pattern="[0-9]{4}" maxlength="4" required>
                            <small class="form-hint">Nhập 4 chữ số: Số lần có thai - Số lần sinh đủ tháng - Số lần sinh non - Số lần sảy</small>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group full-width">
                            <label>Thời gian chẩn đoán chuyển dạ *:</label>
                            <input type="datetime-local" name="labor_diagnosis_time" required>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Ngày giờ ối vỡ:</label>
                            <input type="datetime-local" name="membrane_rupture_date">
                            <small class="form-hint">Để trống nếu ối chưa vỡ</small>
                        </div>
                        <div class="form-group">
                            <label>Phương pháp:</label>
                            <select name="labor_induction_method">
                                <option value="">-- Chọn --</option>
                                <option value="CDTN">Chuyển dạ tự nhiên (CDTN)</option>
                                <option value="KPCD">Kích phát chuyển dạ (KPCD)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group full-width">
                            <label>Yếu tố nguy cơ:</label>
                            <textarea name="risk_factors" rows="3" placeholder="VD: Tiền sản giật, tiểu đường thai kỳ, thai to, ..."></textarea>
                            <small class="form-hint">Ghi rõ các yếu tố nguy cơ nếu có</small>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-cancel" onclick="document.getElementById('addPatientModal').style.display='none'">Hủy</button>
                    <button type="submit" class="btn-save">💾 Thêm bệnh nhân</button>
                </div>
            </form>
        `;
        
        // Set default datetime to current time
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const datetimeInput = formContainer.querySelector('input[name="labor_diagnosis_time"]');
        datetimeInput.value = now.toISOString().slice(0, 16);
        
        // Add parity input formatting
        const parityInput = formContainer.querySelector('input[name="parity"]');
        parityInput.addEventListener('input', function(e) {
            // Only allow digits
            let value = e.target.value.replace(/\D/g, '');
            // Limit to 4 digits
            if (value.length > 4) {
                value = value.slice(0, 4);
            }
            e.target.value = value;
        });
        
        // Handle form submission
        const form = document.getElementById('newPatientForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate parity format
            const parityInput = form.querySelector('input[name="parity"]');
            const parityValue = parityInput.value.trim();
            
            if (!/^\d{4}$/.test(parityValue)) {
                AlertUtils.showNotification('Para phải là 4 chữ số (VD: 0000, 0100)', 'warning');
                parityInput.focus();
                return;
            }
            
            await this.saveNewPatient(form);
        });
        
        modal.style.display = 'block';
    }

    async generateUniquePatientId() {
        try {
            // Start from BN00001 and increment until we find an unused ID
            let counter = 1;
            let patientId;
            
            do {
                patientId = 'BN' + counter.toString().padStart(5, '0');
                
                // Check if this ID already exists
                const response = await this.apiService.getPatient(patientId);
                
                if (!response.success) {
                    // ID not found, so it's available
                    break;
                }
                
                counter++;
                
                // Safety check to prevent infinite loop
                if (counter > 99999) {
                    throw new Error('Không thể tạo mã bệnh nhân mới. Vui lòng liên hệ quản trị viên.');
                }
                
            } while (true);
            
            return patientId;
            
        } catch (error) {
            console.error('Error generating unique patient ID:', error);
            // Fallback: use current timestamp
            const timestamp = Date.now().toString().slice(-5);
            return 'BN' + timestamp;
        }
    }

    async saveNewPatient(form) {
        try {
            const formData = new FormData(form);
            
            let patientId = formData.get('id').trim();
            
            // Auto-generate ID if left blank
            if (!patientId) {
                patientId = await this.generateUniquePatientId();
            }
            
            const patientData = {
                id: patientId,
                name: formData.get('name').trim(),
                age: parseInt(formData.get('age')),
                room: formData.get('room').trim(),
                gestational_week: formData.get('gestational_week').trim(),
                parity: formData.get('parity'),
                labor_diagnosis_time: formData.get('labor_diagnosis_time'),
                membrane_rupture_date: formData.get('membrane_rupture_date') || null,
                risk_factors: formData.get('risk_factors').trim() || null,
                labor_induction_method: formData.get('labor_induction_method') || null
            };
            
            // Validate required fields (ID is now auto-generated if blank)
            if (!patientData.name || !patientData.age || !patientData.room || !patientData.gestational_week || !patientData.parity || !patientData.labor_diagnosis_time) {
                AlertUtils.showNotification('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
                return;
            }
            
            // Save to backend
            const response = await this.apiService.createPatient(patientData);
            
            if (response.success) {
                // Close modal
                document.getElementById('addPatientModal').style.display = 'none';
                
                // Reload patient list
                await this.loadPatients();
                await this.loadDashboardSummary();
                
                AlertUtils.showNotification('✓ Đã thêm bệnh nhân mới thành công! Đang chuyển đến trang chi tiết...', 'success');
                
                // Automatically navigate to patient detail
                setTimeout(() => {
                    this.openPatientDetail(patientData.id);
                }, 1500);
                
            } else {
                // Handle specific error cases
                let errorMessage = response.error || 'Không thể thêm bệnh nhân';
                
                if (errorMessage.toLowerCase().includes('duplicate') || 
                    errorMessage.toLowerCase().includes('unique') ||
                    errorMessage.toLowerCase().includes('already exists')) {
                    errorMessage = `Mã bệnh nhân "${patientData.id}" đã tồn tại. Vui lòng sử dụng mã khác hoặc để trống để hệ thống tự tạo.`;
                } else if (errorMessage.toLowerCase().includes('validation')) {
                    errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các thông tin đã nhập.';
                }
                
                throw new Error(errorMessage);
            }
            
        } catch (error) {
            console.error('Error saving new patient:', error);
            AlertUtils.showNotification('Lỗi khi thêm bệnh nhân: ' + error.message, 'error');
        }
    }

    startAutoRefresh() {
        // Refresh every 2 minutes
        this.refreshInterval = setInterval(() => {
            this.loadPatients();
            this.loadDashboardSummary();
        }, 120000);
    }

    destroy() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.patientListApp = new PatientListApp();
});

// Handle page visibility change to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
    if (window.patientListApp) {
        if (document.hidden) {
            if (window.patientListApp.refreshInterval) {
                clearInterval(window.patientListApp.refreshInterval);
            }
        } else {
            window.patientListApp.startAutoRefresh();
        }
    }
});