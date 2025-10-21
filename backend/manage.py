import os
from dotenv import load_dotenv

# Load .env so environment variables (FLASK_ENV, DATABASE_URL, etc.) are available
load_dotenv()

from app import create_app, db
from flask.cli import FlaskGroup

# Create the app instance used for CLI commands
app = create_app(os.environ.get('FLASK_ENV', 'development'))

cli = FlaskGroup(app)

if __name__ == '__main__':
    cli()