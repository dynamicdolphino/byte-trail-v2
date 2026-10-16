#!/usr/bin/env python3
"""Build Byte Trail for shipping.

    python3 tools/zip.py

Writes:
  dist/web/            static site (GitHub Pages or any host)
  dist/playables.zip   YouTube Playables (ytgame SDK)
  dist/poki.zip        Poki (PokiSDK v2)
  dist/crazygames.zip  CrazyGames (SDK v3)
Every zip has index.html at its root and must stay under 5 MB.
"""
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
LIMIT = 5 * 1024 * 1024
SDK = {
    "playables": "https://www.youtube.com/game_api/v1",
    "poki": "https://game-cdn.poki.com/scripts/v2/poki-sdk.js",
    "crazygames": "https://sdk.crazygames.com/crazygames-sdk-v3.js",
}
CHARSET = '<meta charset="utf-8">\n'


def sources():
    return sorted((ROOT / "src").glob("*.js"))


def page(target):
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    if target == "web":
        return html
    # The platform SDK must load before any game code.
    head = (f'<meta name="byte-trail-platform" content="{target}">\n'
            f'<script src="{SDK[target]}"></script>\n')
    assert CHARSET in html, "index.html lost its charset meta"
    return html.replace(CHARSET, CHARSET + head, 1)


def build_web():
    out = DIST / "web"
    shutil.rmtree(out, ignore_errors=True)
    (out / "src").mkdir(parents=True)
    (out / "index.html").write_text(page("web"), encoding="utf-8")
    for f in sources():
        shutil.copy2(f, out / "src" / f.name)
    print(f"dist/web           {sum(p.stat().st_size for p in out.rglob('*') if p.is_file()):>9,} bytes")


def build_zip(target):
    out = DIST / f"{target}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("index.html", page(target))
        for f in sources():
            z.write(f, f"src/{f.name}")
    size = out.stat().st_size
    if size > LIMIT:
        raise SystemExit(f"{out.name} is {size:,} bytes, over the 5 MB limit")
    print(f"dist/{out.name:<17} {size:>9,} bytes")


if __name__ == "__main__":
    DIST.mkdir(exist_ok=True)
    build_web()
    for target in SDK:
        build_zip(target)
