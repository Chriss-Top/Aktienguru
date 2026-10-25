"""Double-click entry point: no npm needed in the prebuilt Mac download."""

import json
import os
import shutil
import socket
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def is_guru(port):
    try:
        with urlopen(f"http://127.0.0.1:{port}/api/health", timeout=0.5) as response:
            result = json.load(response)
        return result.get("app") == "guru" and result.get("mode") == "paper-only"
    except (OSError, ValueError):
        return False


def choose_port():
    for port in range(8000, 8011):
        if is_guru(port):
            return port, True
    for port in range(8000, 8011):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port, False
            except OSError:
                continue
    raise RuntimeError(
        "Die lokalen Ports 8000–8010 sind belegt. Bitte andere Guru-Fenster schließen."
    )


def prepare_frontend():
    if (ROOT / "dist/index.html").is_file():
        return
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError(
            "Du verwendest den Quellcode-Download. Lade stattdessen Guru-Mac.zip von der Projektseite herunter; darin ist die Oberfläche fertig enthalten."
        )
    print(
        "Erster Start aus dem Quellcode: Oberfläche wird einmalig eingerichtet …",
        flush=True,
    )
    subprocess.run([npm, "ci", "--no-audit", "--no-fund"], cwd=ROOT, check=True)
    subprocess.run([npm, "run", "build"], cwd=ROOT, check=True)


def main():
    prepare_frontend()
    port, existing = choose_port()
    address = f"http://127.0.0.1:{port}"
    if existing:
        print("Guru läuft bereits. Öffne deinen Browser …", flush=True)
        webbrowser.open(address)
        return
    process = subprocess.Popen(
        [sys.executable, "-m", "backend.app"],
        cwd=ROOT,
        env={**os.environ, "PORT": str(port)},
    )
    try:
        deadline = time.monotonic() + 15
        while not is_guru(port):
            if process.poll() is not None:
                raise RuntimeError("Der lokale Server konnte nicht gestartet werden.")
            if time.monotonic() > deadline:
                raise RuntimeError("Guru hat beim Start nicht rechtzeitig geantwortet.")
            time.sleep(0.15)
        print(
            "\nGuru ist bereit. Dein Browser wird geöffnet.\nDieses Fenster geöffnet lassen. Zum Beenden Ctrl+C drücken.\n",
            flush=True,
        )
        if not webbrowser.open(address):
            print(f"Bitte im Browser öffnen: {address}", flush=True)
        process.wait()
    except KeyboardInterrupt:
        print("\nGuru wird beendet. Deine Portfolios bleiben gespeichert.", flush=True)
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(f"\nStart nicht möglich: {error}", file=sys.stderr)
        sys.exit(1)
