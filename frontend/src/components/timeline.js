// Timeline component for partogram visualization
class Timeline {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            zoomLevel: '1h',
            showGrid: true,
            showThresholds: true,
            height: 600,
            ...options
        };
        
        this.data = null;
        this.zoomLevels = {
            '30m': { interval: 30, label: '30 phút' },
            '1h': { interval: 60, label: '1 giờ' },
            '2h': { interval: 120, label: '2 giờ' },
            '4h': { interval: 240, label: '4 giờ' }
        };
        
        this.thresholds = {
            pulse: { min: 60, max: 100, warning: { min: 50, max: 120 } },
            systolic_bp: { min: 90, max: 140, warning: { min: 80, max: 160 } },
            temperature: { min: 36.0, max: 37.5, warning: { max: 38.0 } },
            fetal_heart_rate: { min: 110, max: 160, warning: { min: 100, max: 180 } },
            cervix_dilation: { min: 0, max: 10 }
        };
        
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Timeline container not found');
            return;
        }
        
        this.container.innerHTML = `
            <div class="timeline-header">
                <div class="timeline-controls">
                    <div class="zoom-controls">
                        <button class="btn-zoom" data-zoom="30m">30p</button>
                        <button class="btn-zoom active" data-zoom="1h">1h</button>
                        <button class="btn-zoom" data-zoom="2h">2h</button>
                        <button class="btn-zoom" data-zoom="4h">4h</button>
                    </div>
                    <div class="view-controls">
                        <button class="btn-view-control active" data-view="timeline">Timeline</button>
                        <button class="btn-view-control" data-view="chart">Biểu đồ</button>
                    </div>
                </div>
            </div>
            <div class="timeline-content">
                <div class="timeline-loading">
                    <div class="spinner"></div>
                    <p>Đang tải dữ liệu...</p>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }

    bindEvents() {
        // Zoom controls
        this.container.querySelectorAll('.btn-zoom').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const zoomLevel = e.target.dataset.zoom;
                this.setZoomLevel(zoomLevel);
            });
        });
        
        // View controls
        this.container.querySelectorAll('.btn-view-control').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const viewType = e.target.dataset.view;
                this.setViewType(viewType);
            });
        });
    }

    async loadData(patientId) {
        try {
            this.showLoading();
            
            const apiService = new ApiService();
            const response = await apiService.getTimelineData(patientId, this.options.zoomLevel);
            
            if (response.success) {
                this.data = response.data;
                this.render();
            } else {
                throw new Error(response.error || 'Lỗi khi tải dữ liệu');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    render() {
        if (!this.data || !this.data.timeline.length) {
            this.showEmpty();
            return;
        }

        const content = this.container.querySelector('.timeline-content');
        content.innerHTML = `
            <div class="timeline-wrapper">
                ${this.renderTimeAxis()}
                ${this.renderParameters()}
            </div>
        `;
        
        this.renderAlerts();
    }

    renderTimeAxis() {
        const { timeline, time_range } = this.data;
        if (!timeline.length) return '';
        
        const startTime = new Date(time_range.start);
        const endTime = new Date(time_range.end);
        const intervalMinutes = this.zoomLevels[this.options.zoomLevel].interval;
        
        const timePoints = DateUtils.createTimeGrid(startTime, endTime, intervalMinutes);
        
        return `
            <div class="timeline-axis">
                ${timePoints.map(time => `
                    <div class="time-marker ${this.isHourMark(time) ? 'major' : ''}">
                        ${DateUtils.formatTimeForPartogram(time)}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderParameters() {
        const { parameters, timeline } = this.data;
        
        return `
            <div class="timeline-rows">
                ${parameters.map(param => this.renderParameterRow(param, timeline)).join('')}
                ${this.renderCervixChart(timeline)}
            </div>
        `;
    }

    renderParameterRow(parameter, timeline) {
        const values = timeline.map(point => ({
            time: point.time,
            data: point.data[parameter.key] || null
        }));
        
        return `
            <div class="timeline-row" data-parameter="${parameter.key}">
                <div class="row-label">
                    <span class="parameter-name">${parameter.label}</span>
                    <span class="parameter-category">${this.getCategoryLabel(parameter.category)}</span>
                </div>
                <div class="row-data">
                    ${this.renderParameterData(parameter, values)}
                    ${this.options.showThresholds ? this.renderThresholds(parameter) : ''}
                </div>
            </div>
        `;
    }

    renderParameterData(parameter, values) {
        const timeRange = this.getTimeRange();
        const totalMinutes = (timeRange.end - timeRange.start) / (1000 * 60);
        
        return values.map((point, index) => {
            if (!point.data) return '';
            
            const pointTime = new Date(point.time);
            const minutesFromStart = (pointTime - timeRange.start) / (1000 * 60);
            const leftPercent = (minutesFromStart / totalMinutes) * 100;
            
            const { value, status } = point.data;
            
            let dataPointHtml = '';
            
            if (parameter.type === 'line' && index > 0) {
                const prevPoint = values[index - 1];
                if (prevPoint.data) {
                    const prevTime = new Date(prevPoint.time);
                    const prevMinutesFromStart = (prevTime - timeRange.start) / (1000 * 60);
                    const prevLeftPercent = (prevMinutesFromStart / totalMinutes) * 100;
                    
                    dataPointHtml += `
                        <div class="data-line ${status}" 
                             style="left: ${prevLeftPercent}%; width: ${leftPercent - prevLeftPercent}%;">
                        </div>
                    `;
                }
            }
            
            dataPointHtml += `
                <div class="data-point ${status}" 
                     style="left: ${leftPercent}%"
                     data-value="${value}"
                     data-time="${DateUtils.formatTimeForPartogram(pointTime)}"
                     title="${parameter.label}: ${value} (${DateUtils.formatTimeForPartogram(pointTime)})">
                    <div class="value-label">${value}</div>
                </div>
            `;
            
            return dataPointHtml;
        }).join('');
    }

    renderThresholds(parameter) {
        const thresholds = this.thresholds[parameter.key];
        if (!thresholds) return '';
        
        let thresholdHtml = '';
        
        if (thresholds.min !== undefined) {
            thresholdHtml += `
                <div class="threshold-line min-threshold" 
                     style="bottom: ${this.getThresholdPosition(thresholds.min, parameter)}%">
                    <span class="threshold-label">Min: ${thresholds.min}</span>
                </div>
            `;
        }
        
        if (thresholds.max !== undefined) {
            thresholdHtml += `
                <div class="threshold-line max-threshold" 
                     style="bottom: ${this.getThresholdPosition(thresholds.max, parameter)}%">
                    <span class="threshold-label">Max: ${thresholds.max}</span>
                </div>
            `;
        }
        
        return thresholdHtml;
    }

    renderCervixChart(timeline) {
        const cervixData = timeline.filter(point => point.data.cervix_dilation).map(point => ({
            time: point.time,
            dilation: point.data.cervix_dilation.value,
            status: point.data.cervix_dilation.status
        }));
        
        if (!cervixData.length) return '';
        
        return `
            <div class="cervix-chart-container">
                <div class="row-label">
                    <span class="parameter-name">Biểu đồ mở cổ tử cung</span>
                    <span class="parameter-category">Chuyển dạ</span>
                </div>
                <div class="cervix-chart">
                    ${this.renderCervixProgress(cervixData)}
                    ${this.renderAlertZone()}
                </div>
            </div>
        `;
    }

    renderCervixProgress(cervixData) {
        const timeRange = this.getTimeRange();
        const totalMinutes = (timeRange.end - timeRange.start) / (1000 * 60);
        
        const pathPoints = cervixData.map(point => {
            const pointTime = new Date(point.time);
            const minutesFromStart = (pointTime - timeRange.start) / (1000 * 60);
            const x = (minutesFromStart / totalMinutes) * 100;
            const y = 100 - (point.dilation / 10) * 100; // 10cm = 100%
            
            return `${x},${y}`;
        }).join(' ');
        
        return `
            <svg class="cervix-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline class="cervix-line" points="${pathPoints}" />
                ${cervixData.map(point => {
                    const pointTime = new Date(point.time);
                    const minutesFromStart = (pointTime - timeRange.start) / (1000 * 60);
                    const x = (minutesFromStart / totalMinutes) * 100;
                    const y = 100 - (point.dilation / 10) * 100;
                    
                    return `
                        <circle class="cervix-point ${point.status}" 
                                cx="${x}" cy="${y}" r="1.5"
                                data-dilation="${point.dilation}"
                                data-time="${DateUtils.formatTimeForPartogram(pointTime)}">
                            <title>${point.dilation}cm - ${DateUtils.formatTimeForPartogram(pointTime)}</title>
                        </circle>
                    `;
                }).join('')}
            </svg>
        `;
    }

    renderAlertZone() {
        // Render alert zone for labor arrest
        return `
            <svg class="alert-zone-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path class="alert-zone" d="M0,80 L100,20 L100,100 L0,100 Z" opacity="0.1" />
                <text class="alert-zone-label" x="50" y="90">Vùng cảnh báo đình trệ</text>
            </svg>
        `;
    }

    renderAlerts() {
        if (!this.data.alerts.length) return;
        
        const alertsContainer = document.createElement('div');
        alertsContainer.className = 'timeline-alerts';
        
        this.data.alerts.forEach(alert => {
            const alertElement = document.createElement('div');
            alertElement.className = `timeline-alert ${alert.severity}`;
            alertElement.innerHTML = `
                <div class="alert-indicator" 
                     style="left: ${this.getAlertPosition(alert.time)}%"
                     title="${alert.message}">
                    ${AlertUtils.getIcon(alert.severity)}
                </div>
            `;
            alertsContainer.appendChild(alertElement);
        });
        
        this.container.querySelector('.timeline-wrapper').appendChild(alertsContainer);
    }

    // Helper methods
    getTimeRange() {
        return {
            start: new Date(this.data.time_range.start),
            end: new Date(this.data.time_range.end)
        };
    }

    isHourMark(time) {
        return time.getMinutes() === 0;
    }

    getCategoryLabel(category) {
        const labels = {
            mother: 'Mẹ',
            fetus: 'Thai nhi',
            labor: 'Chuyển dạ'
        };
        return labels[category] || category;
    }

    getThresholdPosition(value, parameter) {
        // Calculate position based on parameter scale
        const scales = {
            pulse: { min: 0, max: 200 },
            systolic_bp: { min: 0, max: 200 },
            temperature: { min: 35, max: 40 },
            fetal_heart_rate: { min: 80, max: 200 }
        };
        
        const scale = scales[parameter.key] || { min: 0, max: 100 };
        return ((value - scale.min) / (scale.max - scale.min)) * 100;
    }

    getAlertPosition(alertTime) {
        const timeRange = this.getTimeRange();
        const alertDate = new Date(alertTime);
        const totalMinutes = (timeRange.end - timeRange.start) / (1000 * 60);
        const minutesFromStart = (alertDate - timeRange.start) / (1000 * 60);
        
        return (minutesFromStart / totalMinutes) * 100;
    }

    setZoomLevel(zoomLevel) {
        if (!this.zoomLevels[zoomLevel]) return;
        
        this.options.zoomLevel = zoomLevel;
        
        // Update active button
        this.container.querySelectorAll('.btn-zoom').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === zoomLevel);
        });
        
        // Reload with new zoom level
        if (this.data) {
            this.loadData(this.currentPatientId);
        }
    }

    setViewType(viewType) {
        this.container.querySelectorAll('.btn-view-control').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });
        
        if (viewType === 'chart') {
            this.renderChartView();
        } else {
            this.render();
        }
    }

    renderChartView() {
        // Render traditional chart view
        const content = this.container.querySelector('.timeline-content');
        content.innerHTML = `
            <div class="chart-view">
                <p>Chế độ xem biểu đồ đang được phát triển...</p>
                <p>Sử dụng chế độ Timeline để xem dữ liệu chi tiết.</p>
            </div>
        `;
    }

    showLoading() {
        const content = this.container.querySelector('.timeline-content');
        content.innerHTML = `
            <div class="timeline-loading">
                <div class="spinner"></div>
                <p>Đang tải dữ liệu...</p>
            </div>
        `;
    }

    showError(message) {
        const content = this.container.querySelector('.timeline-content');
        content.innerHTML = `
            <div class="timeline-error">
                <div class="error-icon">⚠️</div>
                <p class="error-message">${message}</p>
                <button class="btn-retry" onclick="location.reload()">Thử lại</button>
            </div>
        `;
    }

    showEmpty() {
        const content = this.container.querySelector('.timeline-content');
        content.innerHTML = `
            <div class="timeline-empty">
                <div class="empty-icon">📊</div>
                <p>Chưa có dữ liệu partogram</p>
                <p class="empty-subtitle">Thêm lần khám đầu tiên để bắt đầu theo dõi</p>
            </div>
        `;
    }

    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Export for use in other modules
window.Timeline = Timeline;