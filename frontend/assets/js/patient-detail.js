// Patient detail page functionality
let currentPatient = null;

// Initialize patient detail page
function initializePatientDetail() {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    const patientId = getPatientIdFromUrl();
    
    if (!patientId) {
        showToast('Không tìm thấy mã bệnh nhân trong URL. Ví dụ URL: patient-detail.html?id=BN001', 'error');
        console.error('Missing patient ID in URL. Current URL:', window.location.href);
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
        return;
    }

    console.log('Loading patient detail for ID:', patientId);
    loadPatientDetail(patientId);
    setupEventListeners();
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    const dateStr = now.toLocaleDateString('vi-VN', dateOptions);
    document.getElementById('currentDate').textContent = dateStr;
    
    const timeStr = now.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('currentTime').textContent = timeStr;
}

// Get patient ID from URL parameters
function getPatientIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Load patient detail data
async function loadPatientDetail(patientId) {
    try {
        showLoading(true);
        
        // Initialize API service
        const apiService = new ApiService();
        
        // Load patient basic info
        const patientResponse = await apiService.getPatient(patientId);
        if (!patientResponse.success) {
            throw new Error(patientResponse.error || 'Bệnh nhân không tồn tại');
        }
        
        currentPatient = patientResponse.data;
        
        // Load partogram records
        const recordsResponse = await apiService.getPartogramRecords(patientId);
        if (recordsResponse.success) {
            currentPatient.partogramData = recordsResponse.data || [];
        } else {
            currentPatient.partogramData = [];
        }
        
        // Load assessment if exists
        try {
            const assessmentResponse = await apiService.getAssessment(patientId);
            if (assessmentResponse.success && assessmentResponse.data) {
                currentPatient.assessment = assessmentResponse.data;
            }
        } catch (error) {
            // Assessment might not exist, which is OK
            console.log('No assessment found for patient');
        }
        
        // Render UI
        renderPatientHeader(currentPatient);
        renderPartogramTable(currentPatient);
        
        showLoading(false);
        
    } catch (error) {
        console.error('Error loading patient detail:', error);
        showToast('Lỗi khi tải thông tin bệnh nhân: ' + error.message, 'error');
        showLoading(false);
        
        // Redirect back to index on error
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

// Render patient header information
function renderPatientHeader(patient) {
    const container = document.getElementById('patientHeaderCard');
    
    if (!patient) return;
    
    const birthYear = new Date().getFullYear() - patient.age;
    let overallStatus = 'normal';
    
    // Calculate overall status if we have partogram data
    if (patient.partogramData && patient.partogramData.length > 0) {
        const latestRecord = patient.partogramData[patient.partogramData.length - 1];
        overallStatus = calculateOverallStatus(latestRecord);
    }
    
    const statusBadge = {
        'critical': { text: 'NGUY HIỂM', class: 'critical' },
        'warning': { text: 'CẦN THEO DÕI', class: 'warning' },
        'normal': { text: 'BÌNH THƯỜNG', class: 'normal' }
    };
    
    const laborDiagnosisTime = patient.labor_diagnosis_time ? 
        new Date(patient.labor_diagnosis_time).toLocaleString('vi-VN') :
        'Chưa xác định';
    
    // Format membrane rupture date
    const membraneRuptureTime = patient.membrane_rupture_date ? 
        new Date(patient.membrane_rupture_date).toLocaleString('vi-VN') :
        'Chưa vỡ ối';
    
    // Labor induction method display
    const laborMethod = patient.labor_induction_method === 'CDTN' ? 'Chuyển dạ tự nhiên (CDTN)' :
                        patient.labor_induction_method === 'KPCD' ? 'Kích phát chuyển dạ (KPCD)' :
                        'Chưa xác định';
    
    container.innerHTML = `
        <div class="patient-header-info">
            <div class="info-main">
                <div class="patient-header-top">
                    <h2>${patient.name}</h2>
                    <button class="btn-edit-patient" onclick="showEditPatientModal()" title="Chỉnh sửa thông tin bệnh nhân">
                        ✏️ Sửa thông tin
                    </button>
                </div>
                <div class="info-row">
                    <span class="info-item"><strong>Năm sinh:</strong> ${birthYear}</span>
                    <span class="info-item"><strong>Tuổi:</strong> ${patient.age}</span>
                    <span class="info-item"><strong>Para:</strong> ${patient.parity}</span>
                    <span class="info-item"><strong>Phòng:</strong> ${patient.room}</span>
                </div>
                <div class="info-row">
                    <span class="info-item"><strong>Mã BN:</strong> ${patient.id}</span>
                    <span class="info-item"><strong>Tuần thai:</strong> ${patient.gestational_week}</span>
                    <span class="info-item"><strong>Phương pháp:</strong> ${laborMethod}</span>
                </div>
                <div class="info-row">
                    <span class="info-item"><strong>Chẩn đoán chuyển dạ:</strong> ${laborDiagnosisTime}</span>
                    <span class="info-item"><strong>Ngày giờ ối vỡ:</strong> ${membraneRuptureTime}</span>
                </div>
                ${patient.risk_factors ? `
                <div class="info-row">
                    <span class="info-item full-width"><strong>⚠️ Yếu tố nguy cơ:</strong> ${patient.risk_factors}</span>
                </div>
                ` : ''}
            </div>
            <div class="overall-status ${statusBadge[overallStatus].class}">
                <div class="status-icon">⚠️</div>
                <div class="status-text">${statusBadge[overallStatus].text}</div>
            </div>
        </div>
    `;
}

// Calculate overall status based on medical rules
function calculateOverallStatus(record) {
    if (!record) return 'normal';
    
    let warnings = 0;
    
    // Get values from both flat and nested structure
    const pulse = record.pulse || record.mother?.pulse;
    const systolicBP = record.systolic_bp || record.mother?.systolic_bp;
    const temperature = record.temperature || record.mother?.temperature;
    const fhr = record.fetal_heart_rate || record.fetus?.fetal_heart_rate;
    const ctg = record.ctg_score || record.fetus?.ctg_score;
    const contractions = record.contractions_per_10min || record.labor?.contractions_per_10min;
    
    // Check vital signs
    if (pulse && (pulse < 60 || pulse >= 120)) warnings++;
    if (systolicBP && (systolicBP < 80 || systolicBP >= 140)) warnings++;
    if (temperature && (temperature < 35 || temperature >= 37.5)) warnings++;
    
    // Check fetal heart rate
    if (fhr && (fhr < 110 || fhr >= 160)) warnings++;
    
    // Check CTG score (most critical)
    if (ctg === 3) return 'critical';
    if (ctg === 2) warnings += 2;
    
    // Check contractions
    if (contractions && (contractions < 2 || contractions > 5)) warnings++;
    
    // Determine overall status
    if (warnings >= 3) return 'critical';
    if (warnings >= 1) return 'warning';
    return 'normal';
}

// Render partogram table
function renderPartogramTable(patient) {
    const table = document.getElementById('partogramTable');
    const data = patient.partogramData || [];
    
    if (data.length === 0) {
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Chưa có dữ liệu theo dõi</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="empty-state">Nhấn "Thêm lần khám" để bắt đầu theo dõi</td>
                </tr>
            </tbody>
        `;
        return;
    }
    
    // Create header row with times
    let headerHTML = '<thead><tr class="time-header"><th class="sticky-col">Chỉ số</th>';
    data.forEach((record, index) => {
        // Use examination_time if available, otherwise fall back to recorded_at
        let displayTime;
        if (record.examination_time) {
            // If examination_time is just time (HH:MM), use it directly
            displayTime = record.examination_time.length <= 5 ? record.examination_time : 
                new Date(record.examination_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else {
            displayTime = new Date(record.recorded_at).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        headerHTML += `<th class="time-col">
            <div class="visit-label">Lần ${index + 1}</div>
            <div class="time-value">${displayTime}</div>
        </th>`;
    });
    headerHTML += '</tr></thead>';
    
    // Create body with parameters as rows
    let bodyHTML = '<tbody>';
    
    // Helper function to create row
    const createRow = (label, category, getValue, getClass) => {
        let row = `<tr class="data-row ${category}">
            <td class="sticky-col param-label"><strong>${label}</strong></td>`;
        
        data.forEach(record => {
            const value = getValue(record);
            const cellClass = getClass ? getClass(record) : '';
            row += `<td class="${cellClass}">${value || '-'}</td>`;
        });
        
        row += '</tr>';
        return row;
    };
    
    // Get cell class based on value and thresholds
    const getCellClass = (value, thresholds) => {
        if (!thresholds || value === null || value === undefined) return '';
        
        if (thresholds.critical) {
            for (let condition of thresholds.critical) {
                if (condition(value)) return 'cell-critical';
            }
        }
        
        if (thresholds.warning) {
            for (let condition of thresholds.warning) {
                if (condition(value)) return 'cell-warning';
            }
        }
        
        return 'cell-normal';
    };

    // 🔥 Calculate section status based on cell status in the latest record
    const calculateSectionStatus = (records, sectionType) => {
        if (!records || records.length === 0) return 'normal';
        
        // 🚨 FIX: Only check the LATEST (most recent) record for section header colors
        const latestRecord = records[records.length - 1];
        
        if (sectionType === 'fetus') {
            // 🔥 CTG có ưu tiên tuyệt đối cho thai nhi - giữ nguyên quy tắc
            const ctg = latestRecord.ctg_score || latestRecord.fetus?.ctg_score;
            if (ctg === 3) return 'critical';  // CTG=3 → ĐỎ ngay lập tức
            if (ctg === 2) return 'warning';   // CTG=2 → VÀNG ngay lập tức
            
            // Nếu CTG 0-1, kiểm tra tất cả cell trong section thai nhi
            const fhr = latestRecord.fetal_heart_rate || latestRecord.fetus?.fetal_heart_rate;
            
            // Determine cell statuses for fetal section
            let cellStatuses = [];
            
            // Tim thai cell status
            if (fhr) {
                if (fhr < 110 || fhr >= 160) {
                    cellStatuses.push('critical');
                } else {
                    cellStatuses.push('normal');
                }
            }
            
            // CTG cell status (already checked above, but include for completeness)
            if (ctg !== undefined && ctg !== null) {
                if (ctg === 3) cellStatuses.push('critical');
                else if (ctg === 2) cellStatuses.push('warning');
                else cellStatuses.push('normal');
            }
            
            return determineSectionStatus(cellStatuses);
        }
        
        if (sectionType === 'mother') {
            // Kiểm tra tất cả cell trong section mẹ
            const pulse = latestRecord.pulse || latestRecord.mother?.pulse;
            const systolic = latestRecord.systolic_bp || latestRecord.mother?.systolic_bp;
            const diastolic = latestRecord.diastolic_bp || latestRecord.mother?.diastolic_bp;
            const temperature = latestRecord.temperature || latestRecord.mother?.temperature;
            
            let cellStatuses = [];
            
            // Pulse cell status
            if (pulse) {
                if (pulse < 60 || pulse >= 120) {
                    cellStatuses.push('critical');
                } else {
                    cellStatuses.push('normal');
                }
            }
            
            // Systolic BP cell status
            if (systolic) {
                if (systolic < 80 || systolic >= 140) {
                    cellStatuses.push('critical');
                } else {
                    cellStatuses.push('normal');
                }
            }
            
            // Diastolic BP cell status
            if (diastolic) {
                if (diastolic < 50 || diastolic >= 90) {
                    cellStatuses.push('critical');
                } else {
                    cellStatuses.push('normal');
                }
            }
            
            // Temperature cell status
            if (temperature) {
                if (temperature < 35 || temperature >= 37.5) {
                    cellStatuses.push('critical');
                } else {
                    cellStatuses.push('normal');
                }
            }
            
            return determineSectionStatus(cellStatuses);
        }
        
        return 'normal';
    };
    
    // Helper function to determine section status based on cell statuses
    const determineSectionStatus = (cellStatuses) => {
        if (cellStatuses.length === 0) return 'normal';
        
        const normalCells = cellStatuses.filter(status => status === 'normal').length;
        const totalCells = cellStatuses.length;
        
        // Critical: when NO cells are normal
        if (normalCells === 0) return 'critical';
        
        // Normal: when ALL cells are normal
        if (normalCells === totalCells) return 'normal';
        
        // Warning: all other cases (some normal, some not)
        return 'warning';
    };
    
    // 🔥 Calculate section statuses
    const motherStatus = calculateSectionStatus(data, 'mother');
    const fetusStatus = calculateSectionStatus(data, 'fetus');
    
    // CHĂM SÓC HỖ TRỢ
    bodyHTML += `<tr class="section-header"><td colspan="${data.length + 1}">CHĂM SÓC HỖ TRỢ</td></tr>`;
    bodyHTML += createRow('Bạn đồng hành', 'support', r => (r.companion !== undefined) ? (r.companion ? 'Có' : 'Không') : '-');
    bodyHTML += createRow('VAS (0-10)', 'support', r => r.vas_score || r.vas || '-');
    bodyHTML += createRow('Uống nước', 'support', r => (r.drinking !== undefined) ? (r.drinking ? 'Có' : 'Không') : '-');
    bodyHTML += createRow('Ăn', 'support', r => (r.eating !== undefined) ? (r.eating ? 'Có' : 'Không') : '-');

    // TÌNH TRẠNG MẸ
    bodyHTML += `<tr class="section-header section-${motherStatus}"><td colspan="${data.length + 1}">TÌNH TRẠNG MẸ</td></tr>`;
    bodyHTML += createRow('Mạch (lần/phút)', 'mother', r => r.pulse || r.mother?.pulse,
        r => getCellClass(r.pulse || r.mother?.pulse, { critical: [(v) => v < 60, (v) => v >= 120] }));
    bodyHTML += createRow('HA tâm thu (mmHg)', 'mother', r => r.systolic_bp || r.mother?.systolic_bp,
        r => getCellClass(r.systolic_bp || r.mother?.systolic_bp, { critical: [(v) => v < 80, (v) => v >= 140] }));
    bodyHTML += createRow('HA tâm trương (mmHg)', 'mother', r => r.diastolic_bp || r.mother?.diastolic_bp,
        r => getCellClass(r.diastolic_bp || r.mother?.diastolic_bp, { critical: [(v) => v < 50, (v) => v >= 90] }));
    bodyHTML += createRow('Nhiệt độ (°C)', 'mother', r => r.temperature || r.mother?.temperature,
        r => getCellClass(r.temperature || r.mother?.temperature, { critical: [(v) => v < 35, (v) => v >= 37.5] }));
    bodyHTML += createRow('Nước tiểu', 'mother', r => r.urine || r.mother?.urine || '-');
    
    // TÌNH TRẠNG THAI NHI  
    bodyHTML += `<tr class="section-header section-${fetusStatus}"><td colspan="${data.length + 1}">TÌNH TRẠNG THAI NHI</td></tr>`;
    bodyHTML += createRow('Tim thai (lần/phút)', 'fetus', r => r.fetal_heart_rate || r.fetus?.fetal_heart_rate,
        r => getCellClass(r.fetal_heart_rate || r.fetus?.fetal_heart_rate, { critical: [(v) => v < 110, (v) => v >= 160] }));
    bodyHTML += createRow('CTG', 'fetus', r => r.ctg_score || r.fetus?.ctg_score,
        r => getCellClass(r.ctg_score || r.fetus?.ctg_score, { critical: [(v) => v === 3], warning: [(v) => v === 2] }));
    bodyHTML += createRow('Nước ối', 'fetus', r => r.amniotic_fluid || r.fetus?.amniotic_fluid || '-');
    bodyHTML += createRow('Kiểu thế', 'fetus', r => r.fetal_position || r.fetus?.fetal_position || '-');
    bodyHTML += createRow('Bướu HT', 'fetus', r => r.caput || r.fetus?.caput || '-');
    bodyHTML += createRow('Chống khớp', 'fetus', r => r.molding || r.fetus?.molding || '-');
    
    // DIỄN BIẾN CHUYỂN DẠ
    bodyHTML += '<tr class="section-header"><td colspan="' + (data.length + 1) + '">DIỄN BIẾN CHUYỂN DẠ</td></tr>';
    bodyHTML += createRow('Cơn co (TC/10 phút)', 'labor', r => r.contractions_per_10min || r.labor?.contractions_per_10min,
        r => getCellClass(r.contractions_per_10min || r.labor?.contractions_per_10min, { critical: [(v) => v < 2, (v) => v > 5] }));
    bodyHTML += createRow('Thời gian cơn co (s)', 'labor', r => r.contraction_duration || r.labor?.contraction_duration || '-');
    bodyHTML += createRow('Cổ tử cung (cm)', 'labor', r => r.cervix_dilation || r.labor?.cervix_dilation);
    bodyHTML += createRow('Độ lọt', 'labor', r => r.station || r.labor?.station || '-');
    bodyHTML += createRow('Thời gian từ lần trước (h)', 'labor', r => r.time_since_dilation ? r.time_since_dilation.toFixed(1) : '-');

    // SỬ DỤNG THUỐC
    bodyHTML += '<tr class="section-header"><td colspan="' + (data.length + 1) + '">SỬ DỤNG THUỐC</td></tr>';
    bodyHTML += createRow('Uống', 'medication', r => r.oral_medication || r.medication?.oral || '-');
    bodyHTML += createRow('Tiêm', 'medication', r => r.injection_medication || r.medication?.injection || '-');
    bodyHTML += createRow('Truyền', 'medication', r => r.infusion_medication || r.medication?.infusion || '-');

    // NHẬN ĐỊNH VÀ ĐÁNH GIÁ
    bodyHTML += '<tr class="section-header"><td colspan="' + (data.length + 1) + '">NHẬN ĐỊNH VÀ ĐÁNH GIÁ</td></tr>';
    bodyHTML += createRow('Nhận định Nữ hộ sinh', 'assessment', r => {
        const assessment = r.nurse_assessment || r.assessment?.nurse_assessment || '-';
        return assessment.length > 30 ? assessment.substring(0, 30) + '...' : assessment;
    });
    bodyHTML += createRow('Nhận định Bác sĩ', 'assessment', r => {
        const assessment = r.doctor_assessment || r.assessment?.doctor_assessment || '-';
        return assessment.length > 30 ? assessment.substring(0, 30) + '...' : assessment;
    });
    bodyHTML += createRow('Kế hoạch xử trí', 'assessment', r => {
        const plan = r.treatment_plan || r.assessment?.treatment_plan || '-';
        return plan.length > 30 ? plan.substring(0, 30) + '...' : plan;
    });
    
    bodyHTML += '</tbody>';
    
    table.innerHTML = headerHTML + bodyHTML;
}

// Show overview modal
function showOverviewModal() {
    if (!currentPatient || !currentPatient.partogramData) {
        showToast('Chưa có dữ liệu để hiển thị tổng quan', 'warning');
        return;
    }
    
    const modal = document.getElementById('overviewModal');
    const content = document.getElementById('overviewContent');
    
    const data = currentPatient.partogramData;
    
    let overviewHTML = '<div class="overview-grid">';
    
    data.forEach((record, index) => {
        const visitNumber = index + 1;
        const status = calculateOverallStatus(record);
        const recordTime = new Date(record.recorded_at).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusInfo = {
            'critical': { icon: '🔴', text: 'NGUY HIỂM', class: 'critical' },
            'warning': { icon: '🟡', text: 'CẦN THEO DÕI', class: 'warning' },
            'normal': { icon: '🟢', text: 'BÌNH THƯỜNG', class: 'normal' }
        };
        
        // Collect warnings
        let warnings = [];
        
        // Check mother vitals (support both flat and nested structure)
        const pulse = record.pulse || record.mother?.pulse;
        const systolicBP = record.systolic_bp || record.mother?.systolic_bp;
        const temperature = record.temperature || record.mother?.temperature;
        const fhr = record.fetal_heart_rate || record.fetus?.fetal_heart_rate;
        const ctg = record.ctg_score || record.fetus?.ctg_score;
        const contractions = record.contractions_per_10min || record.labor?.contractions_per_10min;
        
        if (pulse && (pulse < 60 || pulse >= 120)) warnings.push('Mạch bất thường');
        if (systolicBP && (systolicBP < 80 || systolicBP >= 140)) warnings.push('Huyết áp bất thường');
        if (temperature && (temperature < 35 || temperature >= 37.5)) warnings.push('Nhiệt độ bất thường');
        if (fhr && (fhr < 110 || fhr >= 160)) warnings.push('Tim thai bất thường');
        if (ctg === 3) warnings.push('CTG: Nguy hiểm (3)');
        else if (ctg === 2) warnings.push('CTG: Cần theo dõi (2)');
        if (contractions && (contractions < 2 || contractions > 5)) warnings.push('Tần suất cơn co bất thường');
        
        overviewHTML += `
            <div class="overview-card ${statusInfo[status].class}">
                <div class="overview-header">
                    <span class="overview-icon">${statusInfo[status].icon}</span>
                    <span class="overview-title">Lần khám ${visitNumber}</span>
                    <span class="overview-time">${recordTime}</span>
                </div>
                <div class="overview-status">${statusInfo[status].text}</div>
                <div class="overview-warnings">
                    ${warnings.length > 0 ? 
                        '<strong>⚠️ Cảnh báo:</strong><ul>' + warnings.map(w => '<li>' + w + '</li>').join('') + '</ul>' :
                        '<p class="no-warning">✓ Không có cảnh báo</p>'
                    }
                </div>
            </div>
        `;
    });
    
    overviewHTML += '</div>';
    
    content.innerHTML = overviewHTML;
    modal.style.display = 'block';
}

// Show add record modal
function showAddRecordModal() {
    const modal = document.getElementById('addRecordModal');
    const formContainer = document.getElementById('addRecordForm');
    
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);

        formContainer.innerHTML = `
            <form id="newRecordForm" class="add-record-form">
                <div class="form-section">
                    <h3>⏰ Thời gian</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Thời gian khám:</label>
                            <input type="time" name="examination_time" value="${currentTime}" required>
                        </div>
                        <div class="form-group">
                            <label>Thời gian từ lần khám trước (giờ):</label>
                            <input type="number" name="time_since_dilation" step="0.1" value="0.5" min="0" max="24" required>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>🤝 Chăm sóc hỗ trợ</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Bạn đồng hành:</label>
                            <select name="companion">
                                <option value="true">Có</option>
                                <option value="false">Không</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>VAS (Mức độ đau 0-10):</label>
                            <input type="number" name="vas" min="0" max="10" value="3" required>
                        </div>
                        <div class="form-group">
                            <label>Nước uống:</label>
                            <select name="drinking">
                                <option value="true">Có</option>
                                <option value="false">Không</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Ăn:</label>
                            <select name="eating">
                                <option value="true">Có</option>
                                <option value="false">Không</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>👩 Tình trạng mẹ</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Mạch (lần/phút):</label>
                            <input type="number" name="pulse" min="40" max="200" value="80" required>
                        </div>
                        <div class="form-group">
                            <label>HA tâm thu (mmHg):</label>
                            <input type="number" name="systolic_bp" min="60" max="220" value="120" required>
                        </div>
                        <div class="form-group">
                            <label>HA tâm trương (mmHg):</label>
                            <input type="number" name="diastolic_bp" min="40" max="120" value="80" required>
                        </div>
                        <div class="form-group">
                            <label>Nhiệt độ (°C):</label>
                            <input type="number" name="temperature" step="0.1" min="34" max="42" value="36.6" required>
                        </div>
                        <div class="form-group">
                            <label>Nước tiểu:</label>
                            <select name="urine">
                                <option value="Bình thường" selected>Bình thường</option>
                                <option value="P+">P+</option>
                                <option value="P++">P++</option>
                                <option value="A+">A+</option>
                                <option value="A++">A++</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>👶 Tình trạng thai nhi</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>TT cơ bản (Nhịp tim):</label>
                            <input type="number" name="fetal_heart_rate" min="60" max="200" value="140" required>
                        </div>
                        <div class="form-group">
                            <label>CTG (0-3):</label>
                            <select name="ctg_score" required>
                                <option value="0">0 - Tốt</option>
                                <option value="1" selected>1 - Tốt</option>
                                <option value="2">2 - Cần theo dõi</option>
                                <option value="3">3 - Nguy hiểm</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Nước ối:</label>
                            <select name="amniotic_fluid">
                                <option value="Trong" selected>Trong</option>
                                <option value="Hơi đục">Hơi đục</option>
                                <option value="Hết ối">Hết ối</option>
                                <option value="Phân su đặc">Phân su đặc</option>
                                <option value="Máu">Máu</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Kiểu thế:</label>
                            <select name="fetal_position">
                                <option value="Chẩm trước" selected>Chẩm trước</option>
                                <option value="Chẩm sau">Chẩm sau</option>
                                <option value="Sau">Sau (⚠️)</option>
                                <option value="Ngang">Ngang (⚠️)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Bướu HT:</label>
                            <select name="caput">
                                <option value="0" selected>0</option>
                                <option value="+">+</option>
                                <option value="++">++ (Cảnh báo)</option>
                                <option value="+++">+++ (Nguy hiểm)</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Chống khớp:</label>
                            <select name="molding">
                                <option value="0" selected>0</option>
                                <option value="+">+</option>
                                <option value="++">++ (Cảnh báo)</option>
                                <option value="+++">+++ (Nguy hiểm)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>⏱️ Diễn biến chuyển dạ</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Cơn co (TC/10 phút):</label>
                            <input type="number" name="contractions_per_10min" min="0" max="10" value="3" required>
                        </div>
                        <div class="form-group">
                            <label>Thời gian cơn co (giây):</label>
                            <input type="number" name="contraction_duration" min="10" max="120" value="40" required>
                        </div>
                        <div class="form-group">
                            <label>Cổ tử cung (cm):</label>
                            <input type="number" name="cervix_dilation" min="0" max="10" step="0.5" value="3" required>
                        </div>
                        <div class="form-group">
                            <label>Độ lọt:</label>
                            <select name="station">
                                <option value="-3">-3</option>
                                <option value="-2" selected>-2</option>
                                <option value="-1">-1</option>
                                <option value="0">0</option>
                                <option value="+1">+1</option>
                                <option value="+2">+2</option>
                                <option value="+3">+3</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>💊 Sử dụng thuốc</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Uống:</label>
                            <input type="text" name="oral_medication" placeholder="Tên thuốc hoặc -" value="-">
                        </div>
                        <div class="form-group">
                            <label>Tiêm:</label>
                            <input type="text" name="injection_medication" placeholder="Tên thuốc hoặc -" value="-">
                        </div>
                        <div class="form-group">
                            <label>Truyền:</label>
                            <input type="text" name="infusion_medication" placeholder="Tên dịch truyền" value="">
                        </div>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>📝 Nhận định và Đánh giá</h3>
                    <div class="form-group">
                        <label>👩‍⚕️ Nhận định của Nữ hộ sinh:</label>
                        <textarea name="nurse_assessment" rows="3" placeholder="Nhập nhận định của nữ hộ sinh..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>👨‍⚕️ Nhận định của Bác sĩ:</label>
                        <textarea name="doctor_assessment" rows="3" placeholder="Nhập nhận định của bác sĩ..."></textarea>
                    </div>
                </div>
                
                <div class="form-section">
                    <h3>💊 Kế hoạch xử trí</h3>
                    <div class="form-group">
                        <label>Kế hoạch xử trí chi tiết:</label>
                        <textarea name="treatment_plan" rows="4" placeholder="Nhập kế hoạch xử trí chi tiết..."></textarea>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn-cancel" onclick="closeAddRecordModal()">Hủy</button>
                    <button type="submit" class="btn-save">💾 Lưu lần khám</button>
                </div>
            </form>
        `;    // Handle form submission
    const form = document.getElementById('newRecordForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await saveNewRecord(form);
    });
    
    modal.style.display = 'block';
}

// Save new record
async function saveNewRecord(form) {
    try {
        showLoading(true);
        
        const formData = new FormData(form);
        
        // Create full record data with all fields
        const recordData = {
            patient_id: currentPatient.id,
            time_since_dilation: parseFloat(formData.get('time_since_dilation')) || 0,
            
            // Vital signs
            pulse: parseInt(formData.get('pulse')) || 0,
            systolic_bp: parseInt(formData.get('systolic_bp')) || 0,
            diastolic_bp: parseInt(formData.get('diastolic_bp')) || 0,
            temperature: parseFloat(formData.get('temperature')) || 36.6,
            
            // Fetal monitoring
            fetal_heart_rate: parseInt(formData.get('fetal_heart_rate')) || 0,
            ctg_score: parseInt(formData.get('ctg_score')) || 0,
            
            // Labor progress
            cervix_dilation: parseFloat(formData.get('cervix_dilation')) || 0,
            contractions_per_10min: parseInt(formData.get('contractions_per_10min')) || 0,
            
            // Additional fields (if backend supports them)
            examination_time: formData.get('examination_time') || '',
            companion: formData.get('companion') === 'true',
            vas_score: parseInt(formData.get('vas')) || 0,
            drinking: formData.get('drinking') === 'true',
            eating: formData.get('eating') === 'true',
            urine: formData.get('urine') || 'Bình thường',
            amniotic_fluid: formData.get('amniotic_fluid') || 'Trong',
            fetal_position: formData.get('fetal_position') || 'Chẩm trước',
            caput: formData.get('caput') || '0',
            molding: formData.get('molding') || '0',
            contraction_duration: parseInt(formData.get('contraction_duration')) || 0,
            station: formData.get('station') || '-2',
            oral_medication: formData.get('oral_medication') || '-',
            injection_medication: formData.get('injection_medication') || '-',
            infusion_medication: formData.get('infusion_medication') || '',
            nurse_assessment: formData.get('nurse_assessment') || '',
            doctor_assessment: formData.get('doctor_assessment') || '',
            treatment_plan: formData.get('treatment_plan') || ''
        };
        
        console.log('Saving record data:', recordData);
        
        // Save to backend
        const apiService = new ApiService();
        const response = await apiService.createPartogramRecord(recordData);
        
        console.log('Backend response:', response);
        
        if (!response.success) {
            throw new Error(response.error || 'Không thể lưu dữ liệu');
        }
        
        // Update local data
        currentPatient.partogramData.push(response.data);
        
        // Re-render
        renderPartogramTable(currentPatient);
        renderPatientHeader(currentPatient);
        
        // Close modal
        closeAddRecordModal();
        
        showToast('✓ Đã thêm lần khám mới thành công!', 'success');
        showLoading(false);
        
    } catch (error) {
        console.error('Error saving record:', error);
        showToast('Lỗi khi lưu dữ liệu: ' + error.message, 'error');
        showLoading(false);
    }
}

// Save outcome
async function saveOutcome() {
    try {
        const selectedOutcome = document.querySelector('input[name="outcome"]:checked');
        if (!selectedOutcome) {
            showToast('Vui lòng chọn kết cục', 'warning');
            return;
        }
        
        let outcomeText = selectedOutcome.parentElement.textContent.trim();
        if (selectedOutcome.value === 'khac') {
            const otherText = document.getElementById('outcomeOther').value;
            if (otherText) {
                outcomeText = otherText;
            } else {
                showToast('Vui lòng nhập chi tiết kết cục khác', 'warning');
                return;
            }
        }
        
        showLoading(true);
        
        const outcomeData = {
            patient_id: currentPatient.id,
            outcome_type: selectedOutcome.value,
            outcome_details: outcomeText
        };
        
        const apiService = new ApiService();
        const response = await apiService.saveOutcome(outcomeData);
        
        if (!response.success) {
            throw new Error(response.error || 'Không thể lưu kết cục');
        }
        
        showToast('✓ Đã lưu kết cục: ' + outcomeText, 'success');
        showLoading(false);
        
    } catch (error) {
        console.error('Error saving outcome:', error);
        showToast('Lỗi khi lưu kết cục: ' + error.message, 'error');
        showLoading(false);
    }
}

// Event listeners setup
function setupEventListeners() {
    // Overview button
    document.getElementById('btnOverview').addEventListener('click', showOverviewModal);
    
    // Edit Patient button
    const editBtn = document.getElementById('btnEditPatient');
    console.log('Setting up edit button listener, button found:', editBtn);
    if (editBtn) {
        editBtn.addEventListener('click', function() {
            console.log('Edit button clicked!');
            showEditPatientModal();
        });
    }
    
    // Add Record button
    document.getElementById('btnAddRecord').addEventListener('click', showAddRecordModal);
    
    // Save outcome button
    document.getElementById('btnSaveOutcome').addEventListener('click', saveOutcome);
    
    // Print button
    document.getElementById('btnPrint').addEventListener('click', printPartogram);
    
    // Close modals
    document.getElementById('closeOverviewModal').addEventListener('click', function() {
        document.getElementById('overviewModal').style.display = 'none';
    });
    
    document.getElementById('closeAddRecordModal').addEventListener('click', closeAddRecordModal);
    
    // Edit Patient Modal
    document.getElementById('closeEditPatientModal').addEventListener('click', closeEditPatientModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const overviewModal = document.getElementById('overviewModal');
        const addRecordModal = document.getElementById('addRecordModal');
        const editPatientModal = document.getElementById('editPatientModal');
        
        if (event.target === overviewModal) {
            overviewModal.style.display = 'none';
        }
        if (event.target === addRecordModal) {
            addRecordModal.style.display = 'none';
        }
        if (event.target === editPatientModal) {
            editPatientModal.style.display = 'none';
        }
    });
}

// Close add record modal
function closeAddRecordModal() {
    document.getElementById('addRecordModal').style.display = 'none';
}

// Show loading indicator
function showLoading(show) {
    // Simple loading implementation
    let loader = document.getElementById('loadingOverlay');
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loadingOverlay';
            loader.className = 'loading-overlay';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);
        }
        loader.style.display = 'flex';
    } else {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

// Print partogram function
function printPartogram() {
    if (!currentPatient || !currentPatient.partogramData || currentPatient.partogramData.length === 0) {
        showToast('Chưa có dữ liệu để in', 'warning');
        return;
    }

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    
    // Generate print content
    const printContent = generatePrintContent();
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Biểu đồ theo dõi chuyển dạ - ${currentPatient.name}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: Arial, sans-serif; 
                    font-size: 12px; 
                    line-height: 1.4;
                    padding: 20px;
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 15px;
                }
                .print-header h1 { 
                    font-size: 18px; 
                    margin-bottom: 5px; 
                }
                .print-header h2 { 
                    font-size: 16px; 
                    margin-bottom: 10px; 
                }
                .patient-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    background: #f5f5f5;
                    padding: 10px;
                }
                .patient-info div {
                    flex: 1;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 10px;
                }
                th, td {
                    border: 1px solid #333;
                    padding: 6px 4px;
                    text-align: center;
                    vertical-align: middle;
                }
                th {
                    background: #e0e0e0;
                    font-weight: bold;
                }
                .sticky-col {
                    background: #f0f0f0;
                    font-weight: bold;
                    text-align: left;
                    padding-left: 8px;
                }
                .section-header td {
                    background: #d0d0d0;
                    font-weight: bold;
                    text-align: left;
                    padding-left: 8px;
                }
                .section-critical td { background: #ffebee !important; }
                .section-warning td { background: #fff3e0 !important; }
                .section-normal td { background: #e8f5e8 !important; }
                .cell-critical {
                    background: #ffcdd2 !important;
                    font-weight: bold;
                }
                .cell-warning {
                    background: #ffe0b2 !important;
                    font-weight: bold;
                }
                .print-footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 10px;
                    border-top: 1px solid #ccc;
                    padding-top: 10px;
                }
                @media print {
                    body { margin: 0; padding: 15px; }
                    .print-footer { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load, then print
    setTimeout(() => {
        printWindow.print();
        // Close the print window after printing (optional)
        setTimeout(() => {
            printWindow.close();
        }, 1000);
    }, 500);
}

// Generate print content
function generatePrintContent() {
    if (!currentPatient) return '';
    
    const data = currentPatient.partogramData || [];
    const now = new Date();
    
    // Calculate section statuses
    const motherStatus = calculateSectionStatus(data, 'mother');
    const fetusStatus = calculateSectionStatus(data, 'fetus');
    
    // Patient info
    const birthYear = new Date().getFullYear() - currentPatient.age;
    const laborDiagnosisTime = currentPatient.labor_diagnosis_time ? 
        new Date(currentPatient.labor_diagnosis_time).toLocaleString('vi-VN') :
        'Chưa xác định';
    
    let printHTML = `
        <div class="print-header">
            <h1>BỆNH VIỆN HÙNG VƯƠNG</h1>
            <h2>BIỂU ĐỒ THEO DÕI CHUYỂN DẠ</h2>
        </div>
        
        <div class="patient-info">
            <div>
                <strong>Họ tên:</strong> ${currentPatient.name}<br>
                <strong>Mã BN:</strong> ${currentPatient.id}<br>
                <strong>Năm sinh:</strong> ${birthYear} (${currentPatient.age} tuổi)
            </div>
            <div>
                <strong>Phòng:</strong> ${currentPatient.room}<br>
                <strong>Para:</strong> ${currentPatient.parity}<br>
                <strong>Tuần thai:</strong> ${currentPatient.gestational_week}
            </div>
            <div>
                <strong>Chẩn đoán chuyển dạ:</strong><br>
                ${laborDiagnosisTime}<br>
                <strong>In lúc:</strong> ${now.toLocaleString('vi-VN')}
            </div>
        </div>
    `;

    if (data.length === 0) {
        printHTML += '<p style="text-align: center; font-style: italic; margin: 40px 0;">Chưa có dữ liệu theo dõi</p>';
    } else {
        // Create header row with times
        let tableHTML = '<table><thead><tr><th class="sticky-col">Chỉ số</th>';
        data.forEach((record, index) => {
            // Use examination_time if available, otherwise fall back to recorded_at
            let displayTime;
            if (record.examination_time) {
                displayTime = record.examination_time.length <= 5 ? record.examination_time : 
                    new Date(record.examination_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            } else {
                displayTime = new Date(record.recorded_at).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            
            tableHTML += `<th>
                <div>Lần ${index + 1}</div>
                <div>${displayTime}</div>
            </th>`;
        });
        tableHTML += '</tr></thead><tbody>';
        
        // Helper function to create row
        const createPrintRow = (label, category, getValue, getClass) => {
            let row = `<tr class="data-row ${category}">
                <td class="sticky-col">${label}</td>`;
            
            data.forEach(record => {
                const value = getValue(record);
                const cellClass = getClass ? getClass(record) : '';
                row += `<td class="${cellClass}">${value || '-'}</td>`;
            });
            
            row += '</tr>';
            return row;
        };
        
        // Get cell class based on value and thresholds
        const getPrintCellClass = (value, thresholds) => {
            if (!thresholds || value === null || value === undefined) return '';
            
            if (thresholds.critical) {
                for (let condition of thresholds.critical) {
                    if (condition(value)) return 'cell-critical';
                }
            }
            
            if (thresholds.warning) {
                for (let condition of thresholds.warning) {
                    if (condition(value)) return 'cell-warning';
                }
            }
            
            return '';
        };
        
        // CHĂM SÓC HỖ TRỢ
        tableHTML += `<tr class="section-header"><td colspan="${data.length + 1}">CHĂM SÓC HỖ TRỢ</td></tr>`;
        tableHTML += createPrintRow('Bạn đồng hành', 'support', r => (r.companion !== undefined) ? (r.companion ? 'Có' : 'Không') : '-');
        tableHTML += createPrintRow('VAS (0-10)', 'support', r => r.vas_score || r.vas || '-');
        tableHTML += createPrintRow('Uống nước', 'support', r => (r.drinking !== undefined) ? (r.drinking ? 'Có' : 'Không') : '-');
        tableHTML += createPrintRow('Ăn', 'support', r => (r.eating !== undefined) ? (r.eating ? 'Có' : 'Không') : '-');

        // TÌNH TRẠNG MẸ
        tableHTML += `<tr class="section-header section-${motherStatus}"><td colspan="${data.length + 1}">TÌNH TRẠNG MẸ</td></tr>`;
        tableHTML += createPrintRow('Mạch (lần/phút)', 'mother', r => r.pulse || r.mother?.pulse,
            r => getPrintCellClass(r.pulse || r.mother?.pulse, { critical: [(v) => v < 60, (v) => v >= 120] }));
        tableHTML += createPrintRow('HA tâm thu (mmHg)', 'mother', r => r.systolic_bp || r.mother?.systolic_bp,
            r => getPrintCellClass(r.systolic_bp || r.mother?.systolic_bp, { critical: [(v) => v < 80, (v) => v >= 140] }));
        tableHTML += createPrintRow('HA tâm trương (mmHg)', 'mother', r => r.diastolic_bp || r.mother?.diastolic_bp,
            r => getPrintCellClass(r.diastolic_bp || r.mother?.diastolic_bp, { critical: [(v) => v < 50, (v) => v >= 90] }));
        tableHTML += createPrintRow('Nhiệt độ (°C)', 'mother', r => r.temperature || r.mother?.temperature,
            r => getPrintCellClass(r.temperature || r.mother?.temperature, { critical: [(v) => v < 35, (v) => v >= 37.5] }));
        tableHTML += createPrintRow('Nước tiểu', 'mother', r => r.urine || r.mother?.urine || '-');
        
        // TÌNH TRẠNG THAI NHI  
        tableHTML += `<tr class="section-header section-${fetusStatus}"><td colspan="${data.length + 1}">TÌNH TRẠNG THAI NHI</td></tr>`;
        tableHTML += createPrintRow('Tim thai (lần/phút)', 'fetus', r => r.fetal_heart_rate || r.fetus?.fetal_heart_rate,
            r => getPrintCellClass(r.fetal_heart_rate || r.fetus?.fetal_heart_rate, { critical: [(v) => v < 110, (v) => v >= 160] }));
        tableHTML += createPrintRow('CTG', 'fetus', r => r.ctg_score || r.fetus?.ctg_score,
            r => getPrintCellClass(r.ctg_score || r.fetus?.ctg_score, { critical: [(v) => v === 3], warning: [(v) => v === 2] }));
        tableHTML += createPrintRow('Nước ối', 'fetus', r => r.amniotic_fluid || r.fetus?.amniotic_fluid || '-');
        tableHTML += createPrintRow('Kiểu thế', 'fetus', r => r.fetal_position || r.fetus?.fetal_position || '-');
        tableHTML += createPrintRow('Bướu HT', 'fetus', r => r.caput || r.fetus?.caput || '-');
        tableHTML += createPrintRow('Chống khớp', 'fetus', r => r.molding || r.fetus?.molding || '-');
        
        // DIỄN BIẾN CHUYỂN DẠ
        tableHTML += `<tr class="section-header"><td colspan="${data.length + 1}">DIỄN BIẾN CHUYỂN DẠ</td></tr>`;
        tableHTML += createPrintRow('Cơn co (TC/10 phút)', 'labor', r => r.contractions_per_10min || r.labor?.contractions_per_10min,
            r => getPrintCellClass(r.contractions_per_10min || r.labor?.contractions_per_10min, { critical: [(v) => v < 2, (v) => v > 5] }));
        tableHTML += createPrintRow('Thời gian cơn co (s)', 'labor', r => r.contraction_duration || r.labor?.contraction_duration || '-');
        tableHTML += createPrintRow('Cổ tử cung (cm)', 'labor', r => r.cervix_dilation || r.labor?.cervix_dilation);
        tableHTML += createPrintRow('Độ lọt', 'labor', r => r.station || r.labor?.station || '-');
        tableHTML += createPrintRow('Thời gian từ lần trước (h)', 'labor', r => r.time_since_dilation ? r.time_since_dilation.toFixed(1) : '-');

        // SỬ DỤNG THUỐC
        tableHTML += `<tr class="section-header"><td colspan="${data.length + 1}">SỬ DỤNG THUỐC</td></tr>`;
        tableHTML += createPrintRow('Uống', 'medication', r => r.oral_medication || r.medication?.oral || '-');
        tableHTML += createPrintRow('Tiêm', 'medication', r => r.injection_medication || r.medication?.injection || '-');
        tableHTML += createPrintRow('Truyền', 'medication', r => r.infusion_medication || r.medication?.infusion || '-');

        // NHẬN ĐỊNH VÀ ĐÁNH GIÁ
        tableHTML += `<tr class="section-header"><td colspan="${data.length + 1}">NHẬN ĐỊNH VÀ ĐÁNH GIÁ</td></tr>`;
        tableHTML += createPrintRow('Nhận định Nữ hộ sinh', 'assessment', r => {
            const assessment = r.nurse_assessment || r.assessment?.nurse_assessment || '-';
            return assessment.length > 50 ? assessment.substring(0, 50) + '...' : assessment;
        });
        tableHTML += createPrintRow('Nhận định Bác sĩ', 'assessment', r => {
            const assessment = r.doctor_assessment || r.assessment?.doctor_assessment || '-';
            return assessment.length > 50 ? assessment.substring(0, 50) + '...' : assessment;
        });
        tableHTML += createPrintRow('Kế hoạch xử trí', 'assessment', r => {
            const plan = r.treatment_plan || r.assessment?.treatment_plan || '-';
            return plan.length > 50 ? plan.substring(0, 50) + '...' : plan;
        });
        
        tableHTML += '</tbody></table>';
        
        printHTML += tableHTML;
    }
    
    printHTML += `
        <div class="print-footer">
            Bệnh viện Hùng Vương - Khoa Sản<br>
            In lúc: ${now.toLocaleString('vi-VN')}
        </div>
    `;
    
    return printHTML;
}

// Calculate section status (check all cells in section of latest record)
function calculateSectionStatus(records, sectionType) {
    if (!records || records.length === 0) return 'normal';
    
    // 🚨 FIX: Only check the LATEST (most recent) record for section header colors
    const latestRecord = records[records.length - 1];
    
    if (sectionType === 'fetus') {
        // 🔥 CTG có ưu tiên tuyệt đối cho thai nhi - giữ nguyên quy tắc
        const ctg = latestRecord.ctg_score || latestRecord.fetus?.ctg_score;
        if (ctg === 3) return 'critical';  // CTG=3 → ĐỎ ngay lập tức
        if (ctg === 2) return 'warning';   // CTG=2 → VÀNG ngay lập tức
        
        // Nếu CTG 0-1, kiểm tra tất cả cell trong section thai nhi
        const fhr = latestRecord.fetal_heart_rate || latestRecord.fetus?.fetal_heart_rate;
        
        // Determine cell statuses for fetal section
        let cellStatuses = [];
        
        // Tim thai cell status
        if (fhr) {
            if (fhr < 110 || fhr >= 160) {
                cellStatuses.push('critical');
            } else {
                cellStatuses.push('normal');
            }
        }
        
        // CTG cell status (already checked above, but include for completeness)
        if (ctg !== undefined && ctg !== null) {
            if (ctg === 3) cellStatuses.push('critical');
            else if (ctg === 2) cellStatuses.push('warning');
            else cellStatuses.push('normal');
        }
        
        return determinePrintSectionStatus(cellStatuses);
    }
    
    if (sectionType === 'mother') {
        // Kiểm tra tất cả cell trong section mẹ
        const pulse = latestRecord.pulse || latestRecord.mother?.pulse;
        const systolic = latestRecord.systolic_bp || latestRecord.mother?.systolic_bp;
        const diastolic = latestRecord.diastolic_bp || latestRecord.mother?.diastolic_bp;
        const temperature = latestRecord.temperature || latestRecord.mother?.temperature;
        
        let cellStatuses = [];
        
        // Pulse cell status
        if (pulse) {
            if (pulse < 60 || pulse >= 120) {
                cellStatuses.push('critical');
            } else {
                cellStatuses.push('normal');
            }
        }
        
        // Systolic BP cell status
        if (systolic) {
            if (systolic < 80 || systolic >= 140) {
                cellStatuses.push('critical');
            } else {
                cellStatuses.push('normal');
            }
        }
        
        // Diastolic BP cell status
        if (diastolic) {
            if (diastolic < 50 || diastolic >= 90) {
                cellStatuses.push('critical');
            } else {
                cellStatuses.push('normal');
            }
        }
        
        // Temperature cell status
        if (temperature) {
            if (temperature < 35 || temperature >= 37.5) {
                cellStatuses.push('critical');
            } else {
                cellStatuses.push('normal');
            }
        }
        
        return determinePrintSectionStatus(cellStatuses);
    }
    
    return 'normal';
}

// Helper function for print section status determination
function determinePrintSectionStatus(cellStatuses) {
    if (cellStatuses.length === 0) return 'normal';
    
    const normalCells = cellStatuses.filter(status => status === 'normal').length;
    const totalCells = cellStatuses.length;
    
    // Critical: when NO cells are normal
    if (normalCells === 0) return 'critical';
    
    // Normal: when ALL cells are normal
    if (normalCells === totalCells) return 'normal';
    
    // Warning: all other cases (some normal, some not)
    return 'warning';
}

// Show toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'warning' ? '⚠️' : '❌'}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Show animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Show edit patient modal
function showEditPatientModal() {
    console.log('showEditPatientModal called');
    console.log('currentPatient:', currentPatient);
    
    if (!currentPatient) {
        showToast('Không tìm thấy thông tin bệnh nhân để chỉnh sửa', 'error');
        return;
    }

    const modal = document.getElementById('editPatientModal');
    const formContainer = document.getElementById('editPatientForm');
    
    // Convert labor_diagnosis_time to datetime-local format
    const laborTime = currentPatient.labor_diagnosis_time ? 
        new Date(currentPatient.labor_diagnosis_time).toISOString().slice(0, 16) : '';
    
    // Convert membrane_rupture_date to datetime-local format
    const membraneTime = currentPatient.membrane_rupture_date ? 
        new Date(currentPatient.membrane_rupture_date).toISOString().slice(0, 16) : '';
    
    formContainer.innerHTML = `
        <form id="editPatientFormElement" class="add-patient-form">
            <div class="form-section">
                <h3>👤 Thông tin cơ bản</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Mã bệnh nhân *:</label>
                        <input type="text" name="id" value="${currentPatient.id}" required>
                        <small class="form-hint">Mã phải duy nhất trong hệ thống</small>
                    </div>
                    <div class="form-group">
                        <label>Họ và tên *:</label>
                        <input type="text" name="name" value="${currentPatient.name}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tuổi *:</label>
                        <input type="number" name="age" min="15" max="50" value="${currentPatient.age}" required>
                    </div>
                    <div class="form-group">
                        <label>Phòng *:</label>
                        <input type="text" name="room" value="${currentPatient.room}" required>
                    </div>
                </div>
            </div>
            
            <div class="form-section">
                <h3>🤰 Thông tin sản khoa</h3>
                <div class="form-row">
                    <div class="form-group">
                        <label>Tuần thai *:</label>
                        <input type="text" name="gestational_week" value="${currentPatient.gestational_week}" required>
                    </div>
                    <div class="form-group">
                        <label>Para * (4 chữ số):</label>
                        <input type="text" name="parity" value="${currentPatient.parity}" pattern="[0-9]{4}" maxlength="4" required>
                        <small class="form-hint">Nhập 4 chữ số: Số lần có thai - Số lần sinh đủ tháng - Số lần sinh non - Số lần sảy</small>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group full-width">
                        <label>Thời gian chẩn đoán chuyển dạ *:</label>
                        <input type="datetime-local" name="labor_diagnosis_time" value="${laborTime}" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Ngày giờ ối vỡ:</label>
                        <input type="datetime-local" name="membrane_rupture_date" value="${membraneTime}">
                        <small class="form-hint">Để trống nếu ối chưa vỡ</small>
                    </div>
                    <div class="form-group">
                        <label>Phương pháp:</label>
                        <select name="labor_induction_method">
                            <option value="" ${!currentPatient.labor_induction_method ? 'selected' : ''}>-- Chọn --</option>
                            <option value="CDTN" ${currentPatient.labor_induction_method === 'CDTN' ? 'selected' : ''}>Chuyển dạ tự nhiên (CDTN)</option>
                            <option value="KPCD" ${currentPatient.labor_induction_method === 'KPCD' ? 'selected' : ''}>Kích phát chuyển dạ (KPCD)</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group full-width">
                        <label>Yếu tố nguy cơ:</label>
                        <textarea name="risk_factors" rows="3" placeholder="VD: Tiền sản giật, tiểu đường thai kỳ, thai to, ...">${currentPatient.risk_factors || ''}</textarea>
                        <small class="form-hint">Ghi rõ các yếu tố nguy cơ nếu có</small>
                    </div>
                </div>
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn-cancel" onclick="closeEditPatientModal()">Hủy</button>
                <button type="submit" class="btn-save">💾 Lưu thay đổi</button>
            </div>
        </form>
    `;
    
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
    const form = document.getElementById('editPatientFormElement');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await savePatientEdits(form);
    });
    
    modal.style.display = 'block';
}

// Close edit patient modal
function closeEditPatientModal() {
    document.getElementById('editPatientModal').style.display = 'none';
}

// Save patient edits
async function savePatientEdits(form) {
    try {
        const formData = new FormData(form);
        
        const updatedData = {
            id: formData.get('id').trim(),
            name: formData.get('name').trim(),
            age: parseInt(formData.get('age')),
            room: formData.get('room').trim(),
            gestational_week: formData.get('gestational_week').trim(),
            parity: formData.get('parity').trim(),
            labor_diagnosis_time: formData.get('labor_diagnosis_time'),
            membrane_rupture_date: formData.get('membrane_rupture_date') || null,
            risk_factors: formData.get('risk_factors').trim() || null,
            labor_induction_method: formData.get('labor_induction_method') || null
        };
        
        // Validate required fields
        if (!updatedData.id || !updatedData.name || !updatedData.age || !updatedData.room || 
            !updatedData.gestational_week || !updatedData.parity || !updatedData.labor_diagnosis_time) {
            showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
            return;
        }
        
        // Validate parity format
        if (!/^\d{4}$/.test(updatedData.parity)) {
            showToast('Para phải là 4 chữ số (VD: 0000, 0100)', 'warning');
            return;
        }
        
        // Check if ID changed and validate uniqueness
        if (updatedData.id !== currentPatient.id) {
            const apiService = new ApiService();
            const checkResponse = await apiService.getPatient(updatedData.id);
            
            if (checkResponse.success) {
                showToast(`Mã bệnh nhân "${updatedData.id}" đã tồn tại. Vui lòng sử dụng mã khác.`, 'error');
                return;
            }
        }
        
        // Save to backend
        const apiService = new ApiService();
        const response = await apiService.updatePatient(currentPatient.id, updatedData);
        
        if (response.success) {
            // Close modal
            closeEditPatientModal();
            
            // Update current patient data
            currentPatient = { ...currentPatient, ...updatedData };
            
            // Re-render patient header
            renderPatientHeader(currentPatient);
            
            // Update URL if ID changed
            if (updatedData.id !== getPatientIdFromUrl()) {
                window.history.replaceState({}, '', `patient-detail.html?id=${updatedData.id}`);
            }
            
            showToast('✅ Đã cập nhật thông tin bệnh nhân thành công!', 'success');
            
        } else {
            // Handle specific error cases
            let errorMessage = response.error || 'Không thể cập nhật thông tin bệnh nhân';
            
            if (errorMessage.toLowerCase().includes('duplicate') || 
                errorMessage.toLowerCase().includes('unique') ||
                errorMessage.toLowerCase().includes('already exists')) {
                errorMessage = `Mã bệnh nhân "${updatedData.id}" đã tồn tại. Vui lòng sử dụng mã khác.`;
            } else if (errorMessage.toLowerCase().includes('validation')) {
                errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các thông tin đã nhập.';
            } else if (errorMessage.toLowerCase().includes('not found')) {
                errorMessage = 'Không tìm thấy bệnh nhân trong hệ thống.';
            }
            
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('Error updating patient:', error);
        showToast('Lỗi khi cập nhật thông tin: ' + error.message, 'error');
    }
}