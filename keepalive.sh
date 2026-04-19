#!/bin/bash
if ! curl -s --connect-timeout 5 http://localhost:5050/ -o /dev/null 2>/dev/null; then
    cd /var/lib/freelancer/projects/40382132
    nohup bash start_widget.sh >> /tmp/widget_startup.log 2>&1 &
    echo "$(date): Restarted widget server" >> /var/lib/freelancer/projects/40382132/keepalive.log
fi
