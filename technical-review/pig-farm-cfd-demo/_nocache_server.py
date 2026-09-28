import http.server
import functools
import socketserver

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

class IPv4Server(socketserver.TCPServer):
    address_family = __import__("socket").AF_INET
    allow_reuse_address = True

if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=".")
    port = 9911
    with IPv4Server(("0.0.0.0", port), handler) as httpd:
        print(f"Serving on 0.0.0.0:{port} (IPv4 only)")
        httpd.serve_forever()
