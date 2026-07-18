FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY frontend/ ./frontend_static/

ENV PORT=5000
EXPOSE 5000

CMD exec gunicorn --bind 0.0.0.0:${PORT:-5000} app:app
