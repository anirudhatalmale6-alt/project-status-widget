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

# Google Sheets integration (empty = use local Excel file)
GOOGLE_SHEET_ID = os.environ.get('GOOGLE_SHEET_ID', '167nzPAhyO7M0WzhuXjMUOZIi5AFCiyDhCZMNAM7PXOk')

# Email notification for delivery requests
NOTIFY_EMAIL = os.environ.get('NOTIFY_EMAIL', 'advanceforensic@gmail.com')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
SMTP_USER = os.environ.get('SMTP_USER', 'advanceforensic@gmail.com')
SMTP_PASS = os.environ.get('SMTP_PASS', 'ttsvvamgvmaslrek')
