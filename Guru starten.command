#!/bin/bash
# macOS Finder launcher. All paths are relative to this file, including spaces.
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/Library/Frameworks/Python.framework/Versions/Current/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; raise SystemExit(sys.version_info < (3, 11))' >/dev/null 2>&1; then
  echo "Guru benötigt einmalig Python 3.11 oder neuer."
  echo "Die offizielle Downloadseite wird geöffnet. Installiere dort Python für macOS."
  echo "Danach diese Datei erneut doppelklicken. Weitere Programme sind im Mac-Paket nicht nötig."
  open 'https://www.python.org/downloads/macos/'
  read -r -p "Zum Schließen die Eingabetaste drücken … "
  exit 1
fi
python3 scripts/launch.py
result=$?
if [ "$result" -ne 0 ]; then
  echo "Guru konnte nicht gestartet werden. Die Fehlermeldung steht oben."
  read -r -p "Zum Schließen die Eingabetaste drücken … "
fi
exit "$result"
