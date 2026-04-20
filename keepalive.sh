#!/bin/bash
# Keep gunicorn alive
if ! curl -s --connect-timeout 5 http://localhost:5050/ -o /dev/null 2>/dev/null; then
    cd /var/lib/freelancer/projects/40382132
    nohup bash start_widget.sh >> /tmp/widget_startup.log 2>&1 &
    echo "$(date): Restarted widget server" >> /var/lib/freelancer/projects/40382132/keepalive.log
fi

# Keep cloudflared tunnel alive
if ! pgrep -f "cloudflared tunnel" > /dev/null 2>&1; then
    nohup cloudflared tunnel --url http://localhost:5050 >> /tmp/cf_tunnel.log 2>&1 &
    echo "$(date): Restarted cloudflare tunnel" >> /var/lib/freelancer/projects/40382132/keepalive.log
fi
