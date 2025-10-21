// Alert utilities for managing notifications and alerts
class AlertUtils {
    static showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${AlertUtils.getIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.onclick = () => AlertUtils.removeNotification(notification);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => AlertUtils.removeNotification(notification), duration);
        }

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        return notification;
    }

    static removeNotification(notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    static getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ',
            critical: '🚨'
        };
        return icons[type] || icons.info;
    }

    static getStatusClass(status) {
        const classes = {
            normal: 'normal',
            warning: 'warning', 
            critical: 'critical'
        };
        return classes[status] || classes.normal;
    }

    static getStatusBadgeHtml(status, text = null) {
        const statusText = text || AlertUtils.getStatusText(status);
        const statusClass = AlertUtils.getStatusClass(status);
        console.log('Creating badge:', status, statusClass, statusText); // Debug
        return `<span class="status-badge ${statusClass}">${statusText}</span>`;
    }

    static getStatusText(status) {
        const texts = {
            normal: 'Bình thường',
            warning: 'Cần theo dõi',
            critical: 'Nghiêm trọng'
        };
        return texts[status] || texts.normal;
    }

    static getAlertMessage(alertType, parameter, value, threshold) {
        const messages = {
            mother: {
                pulse: `Mạch ${value} bpm (bình thường: ${threshold})`,
                systolic_bp: `Huyết áp tâm thu ${value} mmHg (bình thường: ${threshold})`,
                temperature: `Nhiệt độ ${value}°C (bình thường: ${threshold})`,
                urine: `Nước tiểu bất thường: ${value}`
            },
            fetus: {
                fetal_heart_rate: `Tim thai ${value} bpm (bình thường: ${threshold})`,
                ctg: `CTG cấp ${value} - ${AlertUtils.getCTGDescription(value)}`,
                amniotic_fluid: `Nước ối bất thường: ${value}`
            },
            labor: {
                cervix_dilation_rate: `Tiến triển mở cổ tử cung chậm: ${value}`,
                contractions: `Cơn co bất thường: ${value}`
            }
        };

        return messages[alertType]?.[parameter] || `${parameter}: ${value}`;
    }

    static getCTGDescription(score) {
        const descriptions = {
            0: 'Bình thường',
            1: 'Bình thường', 
            2: 'Nguy cơ - cần theo dõi thêm',
            3: 'Nguy hiểm - cần can thiệp ngay'
        };
        return descriptions[score] || 'Không xác định';
    }

    static createAlertCard(alert) {
        const severityClass = AlertUtils.getStatusClass(alert.severity);
        const timeAgo = DateUtils.getTimeAgo(alert.created_at);
        
        return `
            <div class="alert-card ${severityClass}" data-alert-id="${alert.id}">
                <div class="alert-header">
                    <span class="alert-type">${AlertUtils.getAlertTypeText(alert.alert_type)}</span>
                    <span class="alert-time">${timeAgo}</span>
                </div>
                <div class="alert-message">${alert.message}</div>
                <div class="alert-details">
                    <span class="alert-parameter">${alert.parameter}</span>
                    <span class="alert-value">Giá trị: ${alert.value}</span>
                </div>
                ${!alert.is_acknowledged ? `
                    <button class="btn-acknowledge" onclick="AlertUtils.acknowledgeAlert(${alert.id})">
                        Xác nhận
                    </button>
                ` : `
                    <div class="alert-acknowledged">
                        Đã xác nhận bởi ${alert.acknowledged_by}
                        <br><small>${DateUtils.formatDateTime(alert.acknowledged_at)}</small>
                    </div>
                `}
            </div>
        `;
    }

    static getAlertTypeText(alertType) {
        const types = {
            mother: 'Mẹ',
            fetus: 'Thai nhi',
            labor: 'Chuyển dạ'
        };
        return types[alertType] || alertType;
    }

    static async acknowledgeAlert(alertId) {
        try {
            const apiService = new ApiService();
            await apiService.acknowledgeAlert(alertId, 'Người dùng hiện tại');
            
            AlertUtils.showNotification('Đã xác nhận cảnh báo', 'success');
            
            // Update UI
            const alertCard = document.querySelector(`[data-alert-id="${alertId}"]`);
            if (alertCard) {
                alertCard.classList.add('acknowledged');
                const acknowledgeBtn = alertCard.querySelector('.btn-acknowledge');
                if (acknowledgeBtn) {
                    acknowledgeBtn.style.display = 'none';
                }
            }
            
        } catch (error) {
            AlertUtils.showNotification('Lỗi khi xác nhận cảnh báo: ' + error.message, 'error');
        }
    }

    static highlightAbnormalValue(parameter, value, status = 'normal') {
        if (status === 'normal') {
            return value;
        }
        
        const className = status === 'critical' ? 'value-critical' : 'value-warning';
        return `<span class="${className}">${value}</span>`;
    }

    static addThresholdIndicators(container, parameter, thresholds) {
        // Add visual threshold lines/indicators to charts
        if (!container || !thresholds) return;
        
        const { min, max, warning, critical } = thresholds;
        
        if (min !== undefined) {
            const minLine = document.createElement('div');
            minLine.className = 'threshold-line min-threshold';
            minLine.style.bottom = `${(min / 200) * 100}%`; // Assuming 200 as max scale
            minLine.title = `Ngưỡng tối thiểu: ${min}`;
            container.appendChild(minLine);
        }
        
        if (max !== undefined) {
            const maxLine = document.createElement('div');
            maxLine.className = 'threshold-line max-threshold';
            maxLine.style.bottom = `${(max / 200) * 100}%`;
            maxLine.title = `Ngưỡng tối đa: ${max}`;
            container.appendChild(maxLine);
        }
    }

    static playAlertSound(severity) {
        // Play alert sound based on severity
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const frequencies = {
            warning: 800,
            critical: 1000
        };
        
        const frequency = frequencies[severity];
        if (!frequency) return;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    }

    static initializeAlertStyles() {
        // Add CSS for notifications if not already present
        if (document.getElementById('alert-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'alert-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                min-width: 300px;
                max-width: 500px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transform: translateX(100%);
                transition: transform 0.3s ease;
                margin-bottom: 10px;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification-content {
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .notification-success { border-left: 4px solid #48bb78; }
            .notification-error { border-left: 4px solid #f56565; }
            .notification-warning { border-left: 4px solid #ecc94b; }
            .notification-info { border-left: 4px solid #4299e1; }
            .notification-critical { 
                border-left: 4px solid #f56565; 
                animation: pulse-critical 1s infinite;
            }
            
            .notification-close {
                margin-left: auto;
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #666;
            }
            
            .value-critical {
                color: #c53030;
                font-weight: bold;
                background: #fed7d7;
                padding: 2px 4px;
                border-radius: 4px;
            }
            
            .value-warning {
                color: #b7791f;
                font-weight: bold;
                background: #fefcbf;
                padding: 2px 4px;
                border-radius: 4px;
            }
            
            .alert-card {
                background: white;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                border-left: 4px solid;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .alert-card.status-critical { border-left-color: #f56565; }
            .alert-card.status-warning { border-left-color: #ecc94b; }
            .alert-card.status-normal { border-left-color: #48bb78; }
            
            .alert-card.acknowledged {
                opacity: 0.7;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize styles when script loads
AlertUtils.initializeAlertStyles();

// Export for use in other modules
window.AlertUtils = AlertUtils;