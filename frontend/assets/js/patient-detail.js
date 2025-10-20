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
    
    container.innerHTML = `
        <div class="patient-header-info">
            <div class="info-main">
                <h2>${patient.name}</h2>
                <div class="info-row">
                    <span class="info-item"><strong>Năm sinh:</strong> ${birthYear}</span>
                    <span class="info-item"><strong>Tuổi:</strong> ${patient.age}</span>
                    <span class="info-item"><strong>Para:</strong> ${patient.parity}</span>
                    <span class="info-item"><strong>Phòng:</strong> ${patient.room}</span>
                </div>
                <div class="info-row">
                    <span class="info-item"><strong>Mã BN:</strong> ${patient.id}</span>
                    <span class="info-item"><strong>Tuần thai:</strong> ${patient.gestational_week}</span>
                    <span class="info-item"><strong>Chẩn đoán chuyển dạ:</strong> ${laborDiagnosisTime}</span>
                </div>
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
    
    // Check vital signs
    if (record.pulse < 60 || record.pulse >= 120) warnings++;
    if (record.systolic_bp < 80 || record.systolic_bp >= 140) warnings++;
    if (record.temperature < 35 || record.temperature >= 37.5) warnings++;
    
    // Check fetal heart rate
    if (record.fetal_heart_rate < 110 || record.fetal_heart_rate >= 160) warnings++;
    
    // Check CTG score (most critical)
    if (record.ctg_score === 3) return 'critical';
    if (record.ctg_score === 2) warnings += 2;
    
    // Check contractions
    if (record.contractions_per_10min < 2 || record.contractions_per_10min > 5) warnings++;
    
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
        const recordTime = new Date(record.recorded_at).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        headerHTML += `<th class="time-col">
            <div class="visit-label">Lần ${index + 1}</div>
            <div class="time-value">${recordTime}</div>
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

    // 🔥 Calculate section status based on alert rules
    const calculateSectionStatus = (records, sectionType) => {
        if (!records || records.length === 0) return 'normal';
        
        if (sectionType === 'fetus') {
            // 🔥 CTG có ưu tiên tuyệt đối cho thai nhi - kiểm tra tất cả records
            for (let record of records) {
                const ctg = record.fetus?.ctg_score;
                if (ctg === 3) return 'critical';  // CTG=3 → ĐỎ ngay lập tức
                if (ctg === 2) return 'warning';   // CTG=2 → VÀNG ngay lập tức
            }
            
            // Nếu tất cả CTG đều 0-1, áp dụng nguyên tắc như mẹ
            let totalViolations = 0;
            let hasCritical = false;
            
            records.forEach(record => {
                const fhr = record.fetus?.fetal_heart_rate;
                if (fhr && (fhr < 110 || fhr >= 160)) totalViolations++;
                if (fhr && (fhr < 100 || fhr > 180)) hasCritical = true;
            });
            
            if (hasCritical || totalViolations >= 4) return 'critical';
            if (totalViolations >= 1) return 'warning';
            return 'normal';
        }
        
        if (sectionType === 'mother') {
            // Đếm violations của mẹ
            let totalViolations = 0;
            let hasCritical = false;
            
            records.forEach(record => {
                const pulse = record.mother?.pulse;
                const systolic = record.mother?.systolic_bp;
                const temperature = record.mother?.temperature;
                
                if (pulse && (pulse < 60 || pulse >= 120)) totalViolations++;
                if (systolic && (systolic < 80 || systolic >= 140)) totalViolations++;
                if (temperature && (temperature < 35 || temperature >= 37.5)) totalViolations++;
                
                // Check critical thresholds
                if (pulse && (pulse < 50 || pulse > 120)) hasCritical = true;
                if (systolic && systolic > 160) hasCritical = true;
                if (temperature && temperature > 38.0) hasCritical = true;
            });
            
            // Áp dụng quy tắc
            if (hasCritical || totalViolations >= 4) return 'critical';
            if (totalViolations >= 1) return 'warning';
            return 'normal';
        }
        
        return 'normal';
    };
    
    // 🔥 Calculate section statuses
    const motherStatus = calculateSectionStatus(data, 'mother');
    const fetusStatus = calculateSectionStatus(data, 'fetus');
    
    // TÌNH TRẠNG MẸ
    bodyHTML += `<tr class="section-header section-${motherStatus}"><td colspan="${data.length + 1}">TÌNH TRẠNG MẸ</td></tr>`;
    bodyHTML += createRow('Mạch (lần/phút)', 'mother', r => r.mother?.pulse,
        r => getCellClass(r.mother?.pulse, { critical: [(v) => v < 60, (v) => v >= 120] }));
    bodyHTML += createRow('HA tâm thu (mmHg)', 'mother', r => r.mother?.systolic_bp,
        r => getCellClass(r.mother?.systolic_bp, { critical: [(v) => v < 80, (v) => v >= 140] }));
    bodyHTML += createRow('HA tâm trương (mmHg)', 'mother', r => r.mother?.diastolic_bp,
        r => getCellClass(r.mother?.diastolic_bp, { critical: [(v) => v < 50, (v) => v >= 90] }));
    bodyHTML += createRow('Nhiệt độ (°C)', 'mother', r => r.mother?.temperature,
        r => getCellClass(r.mother?.temperature, { critical: [(v) => v < 35, (v) => v >= 37.5] }));
    
    // TÌNH TRẠNG THAI NHI  
    bodyHTML += `<tr class="section-header section-${fetusStatus}"><td colspan="${data.length + 1}">TÌNH TRẠNG THAI NHI</td></tr>`;
    bodyHTML += createRow('Tim thai (lần/phút)', 'fetus', r => r.fetus?.fetal_heart_rate,
        r => getCellClass(r.fetus?.fetal_heart_rate, { critical: [(v) => v < 110, (v) => v >= 160] }));
    bodyHTML += createRow('CTG', 'fetus', r => r.fetus?.ctg_score,
        r => getCellClass(r.fetus?.ctg_score, { critical: [(v) => v === 3], warning: [(v) => v === 2] }));
    
    // DIỄN BIẾN CHUYỂN DẠ
    bodyHTML += '<tr class="section-header"><td colspan="' + (data.length + 1) + '">DIỄN BIẾN CHUYỂN DẠ</td></tr>';
    bodyHTML += createRow('Cổ tử cung (cm)', 'labor', r => r.labor?.cervix_dilation);
    bodyHTML += createRow('Cơn co (TC/10 phút)', 'labor', r => r.labor?.contractions_per_10min,
        r => getCellClass(r.labor?.contractions_per_10min, { critical: [(v) => v < 2, (v) => v > 5] }));
    bodyHTML += createRow('Thời gian từ lần trước (h)', 'labor', r => r.time_since_dilation ? r.time_since_dilation.toFixed(1) : '-');
    
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
        
        if (record.pulse < 60 || record.pulse >= 120) warnings.push('Mạch bất thường');
        if (record.systolic_bp < 80 || record.systolic_bp >= 140) warnings.push('Huyết áp bất thường');
        if (record.temperature < 35 || record.temperature >= 37.5) warnings.push('Nhiệt độ bất thường');
        if (record.fetal_heart_rate < 110 || record.fetal_heart_rate >= 160) warnings.push('Tim thai bất thường');
        if (record.ctg_score === 3) warnings.push('CTG: Nguy hiểm (3)');
        else if (record.ctg_score === 2) warnings.push('CTG: Cần theo dõi (2)');
        if (record.contractions_per_10min < 2 || record.contractions_per_10min > 5) warnings.push('Tần suất cơn co bất thường');
        
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
    
    // Add Record button
    document.getElementById('btnAddRecord').addEventListener('click', showAddRecordModal);
    
    // Save outcome button
    document.getElementById('btnSaveOutcome').addEventListener('click', saveOutcome);
    
    // Close modals
    document.getElementById('closeOverviewModal').addEventListener('click', function() {
        document.getElementById('overviewModal').style.display = 'none';
    });
    
    document.getElementById('closeAddRecordModal').addEventListener('click', closeAddRecordModal);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const overviewModal = document.getElementById('overviewModal');
        const addRecordModal = document.getElementById('addRecordModal');
        
        if (event.target === overviewModal) {
            overviewModal.style.display = 'none';
        }
        if (event.target === addRecordModal) {
            addRecordModal.style.display = 'none';
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