import sqlite3
import hashlib
import os
from config import DB_FILE


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute('''CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        filter_value TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        active INTEGER DEFAULT 1
    )''')
    # Add filter_value column if upgrading from older schema
    try:
        conn.execute('ALTER TABLE customers ADD COLUMN filter_value TEXT DEFAULT ""')
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()


def hash_password(password):
    salt = os.environ.get('WIDGET_SALT', 'widget_salt_2026')
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def create_customer(username, password, full_name='', filter_value=''):
    conn = get_db()
    try:
        conn.execute(
            'INSERT INTO customers (username, password_hash, full_name, filter_value) VALUES (?, ?, ?, ?)',
            (username, hash_password(password), full_name, filter_value)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def verify_customer(username, password):
    conn = get_db()
    row = conn.execute(
        'SELECT * FROM customers WHERE username = ? AND password_hash = ? AND active = 1',
        (username, hash_password(password))
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_customer(customer_id):
    conn = get_db()
    row = conn.execute('SELECT * FROM customers WHERE id = ?', (customer_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_customers():
    conn = get_db()
    rows = conn.execute('SELECT id, username, full_name, filter_value, active, created_at FROM customers').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_customer(customer_id):
    conn = get_db()
    conn.execute('DELETE FROM customers WHERE id = ?', (customer_id,))
    conn.commit()
    conn.close()


def toggle_customer(customer_id):
    conn = get_db()
    conn.execute('UPDATE customers SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?', (customer_id,))
    conn.commit()
    conn.close()


init_db()
