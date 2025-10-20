// Date and time utilities
class DateUtils {
    static formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    static formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static formatDateTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static getTimeAgo(date) {
        if (!date) return '';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        
        const minutes = Math.floor(diffMs / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} ngày trước`;
        } else if (hours > 0) {
            return `${hours} giờ trước`;
        } else if (minutes > 0) {
            return `${minutes} phút trước`;
        } else {
            return 'Vừa xong';
        }
    }

    static getCurrentDate() {
        return new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static getCurrentTime() {
        return new Date().toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    static updateClock(dateElementId, timeElementId) {
        const updateTime = () => {
            if (dateElementId) {
                const dateElement = document.getElementById(dateElementId);
                if (dateElement) {
                    dateElement.textContent = DateUtils.getCurrentDate();
                }
            }
            
            if (timeElementId) {
                const timeElement = document.getElementById(timeElementId);
                if (timeElement) {
                    timeElement.textContent = DateUtils.getCurrentTime();
                }
            }
        };

        updateTime();
        return setInterval(updateTime, 1000);
    }

    static parseISOString(isoString) {
        if (!isoString) return null;
        return new Date(isoString);
    }

    static toISOString(date) {
        if (!date) return '';
        return new Date(date).toISOString();
    }

    static addHours(date, hours) {
        const result = new Date(date);
        result.setHours(result.getHours() + hours);
        return result;
    }

    static addMinutes(date, minutes) {
        const result = new Date(date);
        result.setMinutes(result.getMinutes() + minutes);
        return result;
    }

    static getDifferenceInHours(date1, date2) {
        const diffMs = Math.abs(new Date(date1) - new Date(date2));
        return diffMs / (1000 * 60 * 60);
    }

    static getDifferenceInMinutes(date1, date2) {
        const diffMs = Math.abs(new Date(date1) - new Date(date2));
        return diffMs / (1000 * 60);
    }

    static formatDuration(minutes) {
        if (minutes < 60) {
            return `${Math.round(minutes)} phút`;
        }
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        
        if (remainingMinutes === 0) {
            return `${hours} giờ`;
        }
        
        return `${hours} giờ ${remainingMinutes} phút`;
    }

    static isToday(date) {
        if (!date) return false;
        const today = new Date();
        const checkDate = new Date(date);
        
        return checkDate.toDateString() === today.toDateString();
    }

    static isWithinLast24Hours(date) {
        if (!date) return false;
        const now = new Date();
        const checkDate = new Date(date);
        const diffMs = now - checkDate;
        
        return diffMs <= (24 * 60 * 60 * 1000);
    }

    static formatTimeForPartogram(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static createTimeGrid(startTime, endTime, intervalMinutes = 60) {
        const times = [];
        let current = new Date(startTime);
        const end = new Date(endTime);
        
        while (current <= end) {
            times.push(new Date(current));
            current = DateUtils.addMinutes(current, intervalMinutes);
        }
        
        return times;
    }
}

// Export for use in other modules  
window.DateUtils = DateUtils;