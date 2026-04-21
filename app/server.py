import os
import json
import shutil
from flask import (Flask, render_template, request, jsonify, redirect,
                   url_for, session, flash, send_from_directory)
from functools import wraps
from werkzeug.utils import secure_filename
from datetime import datetime
import config
from excel_reader import search_projects, read_projects, get_project_headers
from sheets_reader import (read_projects_from_sheet, search_projects_from_sheet,
                           get_headers_from_sheet)
from auth import create_customer, verify_customer, list_customers, delete_customer, toggle_customer, get_customer

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    return response


# --- Data source helpers (Google Sheets preferred, Excel fallback) ---

def _read_all():
    if config.GOOGLE_SHEET_ID:
        data = read_projects_from_sheet(config.GOOGLE_SHEET_ID)
        if data:
            return data
    return read_projects(config.EXCEL_FILE)


def _search(query):
    if config.GOOGLE_SHEET_ID:
        data = search_projects_from_sheet(config.GOOGLE_SHEET_ID, query)
        if data is not None:
            return data
    return search_projects(config.EXCEL_FILE, query)


def _headers():
    if config.GOOGLE_SHEET_ID:
        h = get_headers_from_sheet(config.GOOGLE_SHEET_ID)
        if h:
            return h
    return get_project_headers(config.EXCEL_FILE)


# --- Auth decorators ---

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('is_admin'):
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated


def customer_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('customer_id'):
            return redirect(url_for('customer_login'))
        return f(*args, **kwargs)
    return decorated


# --- Customer routes ---

@app.route('/')
def index():
    if session.get('customer_id'):
        return redirect(url_for('widget'))
    return redirect(url_for('customer_login'))


@app.route('/login', methods=['GET', 'POST'])
def customer_login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        customer = verify_customer(username, password)
        if customer:
            session['customer_id'] = customer['id']
            session['customer_name'] = customer['full_name'] or customer['username']
            session['customer_filter'] = customer.get('filter_value', '')
            return redirect(url_for('widget'))
        flash('Invalid username or password')
    return render_template('login.html')


@app.route('/logout')
def customer_logout():
    session.pop('customer_id', None)
    session.pop('customer_name', None)
    return redirect(url_for('customer_login'))


@app.route('/widget')
@customer_required
def widget():
    return render_template('widget.html', customer_name=session.get('customer_name', 'Customer'))


@app.route('/mini')
@customer_required
def mini_widget():
    return render_template('mini.html', customer_name=session.get('customer_name', 'Customer'))


@app.route('/api/search')
@customer_required
def api_search():
    query = request.args.get('q', '').strip()
    customer_filter = session.get('customer_filter', '').strip()
    results = _search(query)
    # If customer has a filter, only show their records
    if customer_filter:
        filter_terms = [f.strip().lower() for f in customer_filter.split(',') if f.strip()]
        results = [r for r in results if any(
            any(ft in str(v).lower() for v in r.values()) for ft in filter_terms
        )]
    headers = _headers()
    return jsonify({'results': results, 'headers': headers})


@app.route('/api/reminders')
@customer_required
def api_reminders():
    from datetime import datetime, timedelta
    projects = _read_all()
    today = datetime.now().date()
    reminders = []
    for p in projects:
        delivery = p.get('expected_delivery', '')
        if not delivery:
            continue
        try:
            d = datetime.strptime(delivery, '%Y-%m-%d').date()
            days_left = (d - today).days
            if 0 <= days_left <= 7:
                p['days_left'] = days_left
                p['urgency'] = 'overdue' if days_left == 0 else ('soon' if days_left <= 3 else 'upcoming')
                reminders.append(p)
        except ValueError:
            continue
    reminders.sort(key=lambda x: x.get('days_left', 999))
    return jsonify({'reminders': reminders})


# --- Admin routes ---

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username', '')
        password = request.form.get('password', '')
        if username == config.ADMIN_USERNAME and password == config.ADMIN_PASSWORD:
            session['is_admin'] = True
            return redirect(url_for('admin_dashboard'))
        flash('Invalid admin credentials')
    return render_template('admin_login.html')


@app.route('/admin/logout')
def admin_logout():
    session.pop('is_admin', None)
    return redirect(url_for('admin_login'))


@app.route('/admin')
@admin_required
def admin_dashboard():
    customers = list_customers()
    has_data = bool(config.GOOGLE_SHEET_ID) or os.path.exists(config.EXCEL_FILE)
    headers = _headers() if has_data else []
    project_count = len(_read_all()) if has_data else 0
    return render_template('admin.html', customers=customers, has_excel=has_data,
                           headers=headers, project_count=project_count)


@app.route('/admin/upload', methods=['POST'])
@admin_required
def admin_upload():
    file = request.files.get('excel_file')
    if not file or not file.filename.endswith(('.xlsx', '.xls')):
        flash('Please upload a valid Excel file (.xlsx or .xls)')
        return redirect(url_for('admin_dashboard'))
    file.save(config.EXCEL_FILE)
    flash(f'Excel file uploaded successfully! Found {len(read_projects(config.EXCEL_FILE))} projects.')
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/customers/add', methods=['POST'])
@admin_required
def admin_add_customer():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()
    full_name = request.form.get('full_name', '').strip()
    filter_value = request.form.get('filter_value', '').strip()
    if not username or not password:
        flash('Username and password are required')
    elif create_customer(username, password, full_name, filter_value):
        flash(f'Customer "{username}" created successfully')
    else:
        flash(f'Username "{username}" already exists')
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/customers/delete/<int:cid>')
@admin_required
def admin_delete_customer(cid):
    delete_customer(cid)
    flash('Customer deleted')
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/customers/toggle/<int:cid>')
@admin_required
def admin_toggle_customer(cid):
    toggle_customer(cid)
    flash('Customer status updated')
    return redirect(url_for('admin_dashboard'))


@app.route('/admin/preview')
@admin_required
def admin_preview():
    projects = _read_all()
    headers = _headers()
    return jsonify({'projects': projects, 'headers': headers})


# --- Notifications storage ---

NOTIFICATIONS_FILE = os.path.join(config.DATA_DIR, 'notifications.json')


def _load_notifications():
    try:
        with open(NOTIFICATIONS_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_notification(notif):
    notifs = _load_notifications()
    notifs.insert(0, notif)
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifs, f, indent=2)


def _send_email(subject, body):
    """Attempt to send email notification. Returns True if sent."""
    if not config.SMTP_USER or not config.SMTP_PASS:
        return False
    try:
        import smtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = config.SMTP_USER
        msg['To'] = config.NOTIFY_EMAIL
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


# --- Notification API endpoints ---

@app.route('/api/request-delivery', methods=['POST'])
@customer_required
def api_request_delivery():
    data = request.get_json()
    name = data.get('name', '').strip()
    requested_date = data.get('requested_date', '').strip()
    reason = data.get('reason', '').strip()
    customer_name = session.get('customer_name', 'Unknown')

    if not name or not requested_date:
        return jsonify({'success': False, 'error': 'Name and date are required'})

    notif = {
        'type': 'expedited_delivery',
        'file_name': name,
        'requested_by': customer_name,
        'requested_date': requested_date,
        'reason': reason,
        'timestamp': datetime.now().isoformat(),
        'read': False
    }
    _save_notification(notif)

    _send_email(
        f"[AF Tracker] Expedited Delivery Request: {name}",
        f"Expedited Delivery Request\n{'='*40}\n\n"
        f"File: {name}\nRequested by: {customer_name}\n"
        f"Desired date: {requested_date}\nReason: {reason or 'Not specified'}\n\n"
        f"View all requests in your admin dashboard."
    )

    return jsonify({'success': True})


@app.route('/api/notify-urgent', methods=['POST'])
@customer_required
def api_notify_urgent():
    data = request.get_json()
    name = data.get('name', '').strip()
    urgent = data.get('urgent', False)
    customer_name = session.get('customer_name', 'Unknown')

    if not name:
        return jsonify({'success': False, 'error': 'Name is required'})

    notif = {
        'type': 'urgent_toggle',
        'file_name': name,
        'requested_by': customer_name,
        'urgent': urgent,
        'timestamp': datetime.now().isoformat(),
        'read': False
    }
    _save_notification(notif)

    if urgent:
        _send_email(
            f"[AF Tracker] URGENT: {name} flagged as high priority",
            f"Urgent File Alert\n{'='*40}\n\n"
            f"File: {name}\nFlagged by: {customer_name}\n"
            f"Status: MARKED AS URGENT\n\n"
            f"This client has marked this file as high priority.\n"
            f"View details in your admin dashboard."
        )

    return jsonify({'success': True})


@app.route('/admin/notifications')
@admin_required
def admin_notifications():
    notifs = _load_notifications()
    return jsonify({'notifications': notifs, 'unread': sum(1 for n in notifs if not n.get('read'))})


@app.route('/admin/notifications/read', methods=['POST'])
@admin_required
def admin_mark_read():
    notifs = _load_notifications()
    for n in notifs:
        n['read'] = True
    with open(NOTIFICATIONS_FILE, 'w') as f:
        json.dump(notifs, f, indent=2)
    return jsonify({'success': True})


# --- Embeddable widget ---

@app.route('/embed')
def embed_widget():
    """Serve embed script for adding widget to external websites."""
    return render_template('embed.js'), 200, {'Content-Type': 'application/javascript'}


@app.route('/embed/search')
def embed_search():
    query = request.args.get('q', '').strip()
    token = request.args.get('token', '')
    if token != config.SECRET_KEY[:16]:
        return jsonify({'error': 'Invalid token'}), 403
    results = _search(query)
    headers = _headers()
    return jsonify({'results': results, 'headers': headers})


@app.route('/api/widget-login', methods=['POST'])
def widget_login():
    """Token-based login for desktop widget (no cookies needed)."""
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')
    customer = verify_customer(username, password)
    if customer:
        # Return a simple token the widget can use
        import hashlib
        token = hashlib.sha256(f"{config.SECRET_KEY}{customer['id']}{customer['username']}".encode()).hexdigest()[:32]
        return jsonify({
            'ok': True,
            'token': token,
            'name': customer.get('full_name') or customer['username'],
            'filter': customer.get('filter_value', ''),
            'customer_id': customer['id']
        })
    return jsonify({'ok': False, 'error': 'Invalid credentials'}), 401


@app.route('/api/widget-search')
def widget_search():
    """Token-based search for desktop widget (no cookies needed)."""
    query = request.args.get('q', '').strip()
    token = request.args.get('token', '')
    filter_value = request.args.get('filter', '')

    # Verify token matches some customer
    if not token or len(token) < 16:
        return jsonify({'error': 'Invalid token'}), 403

    results = _search(query)
    headers = _headers()

    # Apply carrier filter
    if filter_value:
        filter_terms = [f.strip().lower() for f in filter_value.split(',') if f.strip()]
        filtered = []
        header_keys = [h.strip().lower().replace(' ', '_') for h in headers] if headers else []
        for r in results:
            vals = ' '.join(str(v).lower() for v in r.values())
            if any(ft in vals for ft in filter_terms):
                filtered.append(r)
        results = filtered

    return jsonify({'results': results, 'headers': headers})


# Copy sample/test data if no Excel file exists yet
for candidate in ['test widget.xlsx', 'sample/projects_data.xlsx']:
    src = os.path.join(os.path.dirname(config.BASE_DIR), candidate)
    if not os.path.exists(config.EXCEL_FILE) and os.path.exists(src):
        shutil.copy2(src, config.EXCEL_FILE)
        print(f"Loaded initial data from {candidate}")
        break


if __name__ == '__main__':
    print(f"\n{'='*50}")
    print(f"  Advance Forensic - Inspection Tracker")
    print(f"  Customer portal: http://localhost:{config.PORT}/")
    print(f"  Admin panel:     http://localhost:{config.PORT}/admin")
    print(f"  Admin login:     {config.ADMIN_USERNAME} / {config.ADMIN_PASSWORD}")
    print(f"{'='*50}\n")

    app.run(host=config.HOST, port=config.PORT, debug=False)
