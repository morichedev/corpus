import json
import os
from http.server import BaseHTTPRequestHandler


DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "anglicismos.json")


def load_data():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            data = load_data()

            # Optional query-string filters: ?platform=TikTok&anglicism=bro
            from urllib.parse import urlparse, parse_qs

            params = parse_qs(urlparse(self.path).query)
            platform = params.get("platform", [None])[0]
            anglicism = params.get("anglicism", [None])[0]

            if platform:
                data = [r for r in data if r["p"] == platform]
            if anglicism:
                data = [r for r in data if r["a"].lower() == anglicism.lower()]

            body = json.dumps(data, ensure_ascii=False).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)

        except Exception as e:
            error = json.dumps({"error": str(e)}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(error)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()
