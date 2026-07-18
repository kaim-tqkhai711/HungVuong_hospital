import os
import sys
from dotenv import load_dotenv
from src import create_app, db

load_dotenv()

app = create_app(os.environ.get('FLASK_ENV', 'development'))
application = app

with app.app_context():
    try:
        db.create_all()
        print('Database tables created successfully', flush=True)
    except Exception as e:
        print(f'Warning: Could not create database tables: {e}', flush=True)

@app.cli.command()
def seed_db():
    """Seed the database with sample data."""
    from src.database.seed import seed_data
    seed_data()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
