import os
import shutil
from flask import (Flask, render_template, request, jsonify, redirect,
                   url_for, session, flash, send_from_directory)
from functools import wraps
from werkzeug.utils import secure_filename
import config
from excel_reader import search_projects, read_projects, get_project_headers
from auth import create_customer, verify_customer, list_customers, delete_customer, toggle_customer, get_customer

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload


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


@app.route('/api/search')
@customer_required
def api_search():
    query = request.args.get('q', '').strip()
    customer_filter = session.get('customer_filter', '').strip()
    results = search_projects(config.EXCEL_FILE, query)
    # If customer has a filter, only show their records
    if customer_filter:
        filter_terms = [f.strip().lower() for f in customer_filter.split(',') if f.strip()]
        results = [r for r in results if any(
            any(ft in str(v).lower() for v in r.values()) for ft in filter_terms
        )]
    headers = get_project_headers(config.EXCEL_FILE)
    return jsonify({'results': results, 'headers': headers})


@app.route('/api/reminders')
@customer_required
def api_reminders():
    from datetime import datetime, timedelta
    projects = read_projects(config.EXCEL_FILE)
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
    has_excel = os.path.exists(config.EXCEL_FILE)
    headers = get_project_headers(config.EXCEL_FILE) if has_excel else []
    project_count = len(read_projects(config.EXCEL_FILE)) if has_excel else 0
    return render_template('admin.html', customers=customers, has_excel=has_excel,
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
    projects = read_projects(config.EXCEL_FILE)
    headers = get_project_headers(config.EXCEL_FILE)
    return jsonify({'projects': projects, 'headers': headers})


# --- Embeddable widget ---

@app.route('/embed')
def embed_widget():
    return render_template('embed.html')


@app.route('/embed/search')
def embed_search():
    query = request.args.get('q', '').strip()
    token = request.args.get('token', '')
    if token != config.SECRET_KEY[:16]:
        return jsonify({'error': 'Invalid token'}), 403
    results = search_projects(config.EXCEL_FILE, query)
    headers = get_project_headers(config.EXCEL_FILE)
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
