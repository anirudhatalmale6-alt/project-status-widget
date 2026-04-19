# Project Status Widget

A lightweight Windows desktop widget + web portal for tracking project status. Reads data from an Excel spreadsheet and provides both a desktop app and web-based lookup for customers.

## Features

- **Desktop Widget**: Native Windows app with system tray, reads Excel directly
- **Customer Portal**: Web-based project lookup (works on desktop & phone browsers)
- **Admin Panel**: Upload Excel files, manage customer accounts
- **Embeddable Widget**: Drop into your existing website with a single line of code
- **Delivery Reminders**: Optional notifications for upcoming project deadlines
- **Mobile Friendly**: Responsive design works on any device

## Quick Start

### 1. Install Python dependencies
```
pip install -r app/requirements.txt
```

### 2. Run the app
```
cd app
python server.py
```

### 3. Access
- **Admin Panel**: http://localhost:5050/admin (login: admin / admin123)
- **Customer Portal**: http://localhost:5050/

### 4. Setup Steps
1. Open Admin Panel and upload your Excel file
2. Create customer accounts (username + password)
3. Share the customer portal link with your customers

## Excel File Format

Your Excel spreadsheet should have these columns (names are flexible):

| Project ID | Project Name | Current Status | Date | Expected Delivery |
|-----------|-------------|---------------|------|-------------------|
| P001 | Website Redesign | In Progress | 2026-04-01 | 2026-05-15 |

## Embedding in Your Website

Add this to any page on your website:

```html
<iframe src="http://YOUR_SERVER:5050/embed" 
        width="500" height="400" 
        style="border:none; border-radius:12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
</iframe>
```

## Building Windows Installer

1. Run `build.bat` to create the executable
2. Use [Inno Setup](https://jrsoftware.org/isinfo.php) with `setup.iss` to create the installer

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| WIDGET_PORT | 5050 | Server port |
| WIDGET_ADMIN_USER | admin | Admin username |
| WIDGET_ADMIN_PASS | admin123 | Admin password |
| WIDGET_SECRET_KEY | (random) | Session secret key |

## Tech Stack

- **Backend**: Python, Flask
- **Frontend**: Vanilla HTML/CSS/JS (no frameworks, minimal footprint)
- **Desktop**: PyWebView (native Windows window)
- **Data**: openpyxl for Excel parsing, SQLite for user accounts
- **Installer**: PyInstaller + Inno Setup
