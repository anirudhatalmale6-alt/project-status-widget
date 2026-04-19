"""
Desktop Widget - Launches the web server and opens a native window.
Uses pywebview for a clean native Windows look.
Falls back to opening in browser if pywebview is not installed.
"""
import threading
import sys
import os
import time

# Add app directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import app
import config


def start_server():
    app.run(host='127.0.0.1', port=config.PORT, debug=False, use_reloader=False)


def main():
    # Start Flask server in background thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Wait for server to start
    time.sleep(1)

    url = f'http://localhost:{config.PORT}/admin'

    try:
        import webview
        # Create native window
        webview.create_window(
            'Project Status Widget',
            url,
            width=900,
            height=700,
            min_size=(400, 400),
            resizable=True,
            text_select=True
        )
        webview.start()
    except ImportError:
        print("pywebview not installed. Opening in browser instead.")
        print(f"Admin panel: {url}")
        print(f"Customer portal: http://localhost:{config.PORT}/")
        import webbrowser
        webbrowser.open(url)

        # Keep server running
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down...")


if __name__ == '__main__':
    main()
