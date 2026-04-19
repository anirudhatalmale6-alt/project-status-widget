import os
import secrets

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_DIR = os.path.join(DATA_DIR, 'uploads')

os.makedirs(UPLOAD_DIR, exist_ok=True)

SECRET_KEY = os.environ.get('WIDGET_SECRET_KEY', secrets.token_hex(32))
ADMIN_USERNAME = os.environ.get('WIDGET_ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('WIDGET_ADMIN_PASS', 'admin123')
EXCEL_FILE = os.path.join(UPLOAD_DIR, 'projects_data.xlsx')
DB_FILE = os.path.join(DATA_DIR, 'users.db')
PORT = int(os.environ.get('WIDGET_PORT', 5050))
HOST = os.environ.get('WIDGET_HOST', '0.0.0.0')
