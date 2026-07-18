class ThresholdConfig:
    """Configuration class for medical thresholds"""

    MOTHER_THRESHOLDS = {
        'pulse': {'min': 60, 'max': 100},
        'systolic_bp': {'min': 90, 'max': 140},
        'diastolic_bp': {'min': 60, 'max': 90},
        'temperature': {'min': 36.0, 'max': 37.5}
    }

    FETUS_THRESHOLDS = {
        'fetal_heart_rate': {'min': 110, 'max': 160},
        'ctg_score': {'warning': 2, 'critical': 3}
    }

    LABOR_THRESHOLDS = {
        'cervix_dilation_rate': {'min_rate': 0.5}
    }
