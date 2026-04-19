"""Read project data from Google Sheets via CSV export."""
import csv
import io
import re
from datetime import datetime
import urllib.request

# Known header prefixes — match the first word(s) and clean up
HEADER_CLEAN = {
    'state': 'State',
    'city': 'City',
    'carrier': 'Carrier',
    'claim': 'Claim No',
    'name': 'Name',
    'inspection': 'Inspection',
    'expected': 'Expected Delivery',
    'cause': 'Cause of Delay',
    'delay': 'Cause of Delay',
    'last': 'Last Name',
}


def _clean_header(raw):
    """Clean messy Google Sheets header to a simple name."""
    raw = raw.strip()
    if not raw:
        return ''
    first_word = raw.split()[0].lower().rstrip(':')
    return HEADER_CLEAN.get(first_word, raw)


def _normalize_key(header):
    """Convert header to snake_case key."""
    h = header.strip().lower()
    h = re.sub(r'[^a-z0-9]+', '_', h)
    return h.strip('_')


def _parse_date(val):
    """Parse M/D/YYYY or YYYY-MM-DD date strings to YYYY-MM-DD."""
    if not val or not val.strip():
        return ''
    val = val.strip()
    for fmt in ('%m/%d/%Y', '%Y-%m-%d', '%m-%d-%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(val, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return val


def fetch_sheet_csv(sheet_id):
    """Fetch Google Sheet as CSV text."""
    url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode('utf-8')


def read_projects_from_sheet(sheet_id):
    """Read projects from Google Sheet. Returns list of dicts."""
    try:
        text = fetch_sheet_csv(sheet_id)
    except Exception:
        return []

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    # Clean headers, skip empty columns
    raw_headers = rows[0]
    headers = []
    col_indices = []
    for i, h in enumerate(raw_headers):
        cleaned = _clean_header(h)
        if cleaned:
            headers.append(cleaned)
            col_indices.append(i)

    keys = [_normalize_key(h) for h in headers]

    # Check which keys are date-like
    date_keys = {k for k in keys if 'inspection' in k or 'delivery' in k or 'expected' in k or 'date' in k}

    projects = []
    for row in rows[1:]:
        if not any(cell.strip() for cell in row):
            continue
        project = {}
        for j, col_idx in enumerate(col_indices):
            val = row[col_idx].strip() if col_idx < len(row) else ''
            if keys[j] in date_keys:
                val = _parse_date(val)
            project[keys[j]] = val
        projects.append(project)

    return projects


def search_projects_from_sheet(sheet_id, query):
    """Search projects by name or claim number (case-insensitive partial match)."""
    projects = read_projects_from_sheet(sheet_id)
    if not query:
        return []
    query = query.lower().strip()
    # Only match on name, last_name, and claim fields - not all fields
    search_keys = [k for k in (projects[0].keys() if projects else [])
                   if 'name' in k or 'claim' in k or 'last' in k]
    if not search_keys:
        # Fallback to all fields if no name/claim keys found
        return [p for p in projects if any(query in str(v).lower() for v in p.values())]
    return [p for p in projects if any(query in str(p.get(k, '')).lower() for k in search_keys)]


def get_headers_from_sheet(sheet_id):
    """Get cleaned column headers from Google Sheet."""
    try:
        text = fetch_sheet_csv(sheet_id)
    except Exception:
        return []

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    headers = []
    for h in rows[0]:
        cleaned = _clean_header(h)
        if cleaned:
            headers.append(cleaned)
    return headers
