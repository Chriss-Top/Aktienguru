"""Copy a tested Pages build to the repository-root publishing source.
No API tokens, workflows, user data or backend processes are published.
Existing unrelated files and older hashed assets are preserved.
"""

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def publish():
    dist = ROOT / "dist"
    for required in ("index.html", "data/market.json"):
        if not (dist / required).is_file():
            raise RuntimeError(
                "Zuerst npm run export:pages und npm run build:pages ausführen."
            )
    if "/Aktienguru/assets/" not in (dist / "index.html").read_text():
        raise RuntimeError(
            "Der Build ist nicht für GitHub Pages. npm run build:pages ausführen."
        )
    shutil.copyfile(dist / "index.html", ROOT / "index.html")
    for folder in ("assets", "data"):
        shutil.copytree(dist / folder, ROOT / folder, dirs_exist_ok=True)
    (ROOT / ".nojekyll").touch()
    print(
        "GitHub-Pages-Ausgabe in index.html, assets/ und data/ bereit. Diese Dateien mit main veröffentlichen."
    )


if __name__ == "__main__":
    publish()
