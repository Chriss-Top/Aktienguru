"""Build a source-auditable download with the compiled UI, never local user data."""

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def build(destination=None):
    if not (ROOT / "dist/index.html").is_file():
        raise RuntimeError("Zuerst npm ci && npm run build ausführen.")
    destination = destination or ROOT / "Guru-Mac.zip"
    entries = [
        ROOT / "Guru starten.command",
        ROOT / "scripts/launch.py",
        ROOT / "README.md",
    ]
    entries += sorted((ROOT / "backend").glob("*.py"))
    entries += sorted(p for p in (ROOT / "dist").rglob("*") if p.is_file())
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in entries:
            info = zipfile.ZipInfo("Guru/" + file.relative_to(ROOT).as_posix())
            info.create_system = 3
            info.external_attr = (
                0o100755 if file.suffix == ".command" else 0o100644
            ) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, file.read_bytes())
    print(f"Erstellt: {destination.name} ({destination.stat().st_size // 1024} KB)")
    return destination


if __name__ == "__main__":
    build()
