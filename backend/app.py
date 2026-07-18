import os
from dotenv import load_dotenv
from src import create_app, db

load_dotenv()

app = create_app(os.environ.get('FLASK_ENV', 'development'))
application = app

with app.app_context():
    db.create_all()

@app.cli.command()
def seed_db():
    """Seed the database with sample data."""
    from src.database.seed import seed_data
    seed_data()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
