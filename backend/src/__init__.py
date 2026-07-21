from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_migrate import Migrate
from datetime import datetime
import os

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()


def create_app(config_name='development'):
    """Application factory pattern"""
    app = Flask(__name__)
    
    # Configuration
    if config_name == 'production':
        app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///partogram_production.db')
        app.config['DEBUG'] = False
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///partogram.db'
        app.config['DEBUG'] = True
    
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-hungvuong-2025')
    
    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Import models after db is initialized 
    from src.database.models import Patient, PartogramRecord, Assessment, Alert, Outcome
    
    # Register blueprints
    from src.views.patient_views import patient_bp
    from src.views.partogram_views import partogram_bp
    from src.views.assessment_views import assessment_bp
    from src.views.external_views import external_bp

    app.register_blueprint(patient_bp, url_prefix='/api/patients')
    app.register_blueprint(partogram_bp, url_prefix='/api/partogram')
    app.register_blueprint(assessment_bp, url_prefix='/api/assessments')
    app.register_blueprint(external_bp, url_prefix='/api/external')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Endpoint không tìm thấy', 'message': str(error)}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return {'error': 'Lỗi máy chủ nội bộ', 'message': str(error)}, 500
    
    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'version': '1.0.0'
        }
    
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend_static')

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if path.startswith('api/'):
            return {'error': 'Not found'}, 404
        full_path = os.path.join(frontend_dir, path)
        if path and os.path.isfile(full_path):
            return send_from_directory(frontend_dir, path)
        return send_from_directory(frontend_dir, 'index.html')

    return app