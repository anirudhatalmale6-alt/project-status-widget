#!/bin/bash
cd /var/lib/freelancer/projects/40382132/app
export WIDGET_ADMIN_PASS="AdvForensic2026!"
export WIDGET_SECRET_KEY="af_tracker_secret_key_2026_secure"
exec python3 -m gunicorn server:app --bind 0.0.0.0:5050 --workers 2 --timeout 120 --access-logfile /var/lib/freelancer/projects/40382132/access.log --error-logfile /var/lib/freelancer/projects/40382132/error.log
