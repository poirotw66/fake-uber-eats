#!/usr/bin/env python3
"""Render architecture HTML to PNG via headless Chrome."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "blog" / "images" / "06-architecture.html"
PNG = ROOT / "blog" / "images" / "06-architecture.png"


def main() -> None:
    if not HTML.exists():
        raise SystemExit(f"Missing {HTML}")

    browsers = ["google-chrome", "chromium", "chromium-browser"]
    url = HTML.as_uri()
    for browser in browsers:
        try:
            subprocess.run(
                [
                    browser,
                    "--headless=new",
                    "--disable-gpu",
                    "--hide-scrollbars",
                    f"--screenshot={PNG}",
                    "--window-size=1400,980",
                    url,
                ],
                check=True,
                capture_output=True,
            )
            print(f"Wrote {PNG}")
            return
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    raise SystemExit("No headless Chrome found")


if __name__ == "__main__":
    main()
