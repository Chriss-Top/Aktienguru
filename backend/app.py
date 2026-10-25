"""Python standard-library API + SPA host. Run: python3 -m backend.app"""

import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .models import DomainError
from .provider import YahooProvider
from .repository import SQLiteRepository
from .service import GuruService

ROOT = Path(__file__).resolve().parents[1]
repository = SQLiteRepository(os.getenv("GURU_DB", str(ROOT / ".data/guru.sqlite3")))
service = GuruService(repository, YahooProvider(repository))


class Handler(BaseHTTPRequestHandler):
    def json(self, status, value):
        data = json.dumps(value, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/health":
                return self.json(
                    200,
                    {
                        "app": "guru",
                        "status": "ok",
                        "monitoring": False,
                        "mode": "paper-only",
                    },
                )
            if path == "/api/dashboard":
                return self.json(200, service.dashboard())
            if path.startswith("/api/stocks/"):
                return self.json(200, service.detail(path.split("/")[-1]))
            if path == "/api/portfolios":
                return self.json(200, service.portfolios())
            if path == "/api/predictions":
                return self.json(200, repository.predictions())
            if path.startswith("/api/"):
                return self.json(404, {"error": "Nicht gefunden"})
            relative = "index.html" if path == "/" else path.lstrip("/")
            file = (ROOT / "dist" / relative).resolve()
            if not file.is_relative_to((ROOT / "dist").resolve()):
                return self.json(403, {"error": "Zugriff verweigert"})
            if not file.is_file():
                file = ROOT / "dist/index.html"
            if not file.is_file():
                return self.json(
                    503,
                    {
                        "error": "Frontend fehlt. Zuerst npm ci && npm run build ausführen."
                    },
                )
            data = file.read_bytes()
            self.send_response(200)
            self.send_header(
                "Content-Type",
                mimetypes.guess_type(str(file))[0] or "application/octet-stream",
            )
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)
        except DomainError as e:
            self.json(503, {"error": str(e)})
        except Exception:
            import traceback

            traceback.print_exc()
            self.json(
                500, {"error": "Interner Fehler. Details stehen im Serverprotokoll."}
            )

    def do_POST(self):
        # Local single-user API: refuse cross-origin writes, including DNS-rebinding hosts.
        allowed = {
            f"127.0.0.1:{self.server.server_port}",
            f"localhost:{self.server.server_port}",
            "127.0.0.1:5173",
            "localhost:5173",
        }
        if self.headers.get("Host") not in allowed:
            return self.json(403, {"error": "Ungültiger Host"})
        origin = self.headers.get("Origin")
        if origin and origin not in {"http://" + h for h in allowed}:
            return self.json(403, {"error": "Fremde Herkunft verweigert"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > 16384:
                raise DomainError("Ungültige Anfragegröße")
            if not self.headers.get("Content-Type", "").startswith("application/json"):
                raise DomainError("JSON-Anfrage erforderlich")
            body = json.loads(self.rfile.read(length) or b"{}")
            if not isinstance(body, dict):
                raise DomainError("JSON-Objekt erforderlich")
            path = urlparse(self.path).path
            if path == "/api/trades":
                result = service.trade(
                    body.get("symbol"), body.get("side"), body.get("quantity")
                )
            elif path == "/api/guru/start":
                result = service.guru_start()
            elif path == "/api/guru/stop":
                result = service.guru_stop(body.get("id"))
            elif path == "/api/predictions":
                result = service.forecast(body.get("symbol"), body.get("horizon"))
            elif path == "/api/predictions/validate":
                result = service.validate()
            elif path == "/api/backtest":
                result = service.backtest(
                    body.get("symbol"), float(body.get("fee_bps", 10))
                )
            else:
                return self.json(404, {"error": "Nicht gefunden"})
            self.json(200, result)
        except (DomainError, ValueError, TypeError) as e:
            self.json(400, {"error": str(e)})
        except Exception:
            import traceback

            traceback.print_exc()
            self.json(
                500, {"error": "Interner Fehler. Details stehen im Serverprotokoll."}
            )


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", int(os.getenv("PORT", "8000"))), Handler)
    print(
        f"Guru API und Frontend auf Port {server.server_port}. Nur lokal, keine Hintergrundjobs.",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
