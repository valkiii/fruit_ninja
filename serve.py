"""Tiny static server for PULP (camera access needs http://localhost, not file://)."""
import http.server, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
                      ".task": "application/octet-stream"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a):
        pass

class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128     # the browser opens many module requests at once

with Server(("127.0.0.1", PORT), Handler) as httpd:
    print(f"PULP running at http://localhost:{PORT}  (Ctrl+C to stop)")
    httpd.serve_forever()
