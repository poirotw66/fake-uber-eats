"""Shared helpers for local WebP image assets."""

from __future__ import annotations

import io
from pathlib import Path

import requests
from PIL import Image

WEBP_QUALITY = 82


def is_valid_webp(path: Path, min_bytes: int = 1500) -> bool:
    if not path.exists():
        return False
    try:
        data = path.read_bytes()
        if len(data) < min_bytes:
            return False
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    except OSError:
        return False


def is_valid_image_asset(path: Path, min_bytes: int = 1500) -> bool:
    suffix = path.suffix.lower()
    if suffix == ".webp":
        return is_valid_webp(path, min_bytes)
    if suffix in {".jpg", ".jpeg"}:
        try:
            if path.stat().st_size < min_bytes:
                return False
            return path.read_bytes()[:3] == b"\xff\xd8\xff"
        except OSError:
            return False
    return False


def save_bytes_as_webp(content: bytes, dest: Path, min_bytes: int = 1500) -> bool:
    if len(content) < min_bytes:
        return False
    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            dest.parent.mkdir(parents=True, exist_ok=True)
            image.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)
        return is_valid_webp(dest, min_bytes=min_bytes)
    except OSError:
        return False


def convert_file_to_webp(source: Path, dest: Path, min_bytes: int = 1500) -> bool:
    if not source.exists():
        return False
    try:
        with Image.open(source) as image:
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            dest.parent.mkdir(parents=True, exist_ok=True)
            image.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)
        return is_valid_webp(dest, min_bytes=min_bytes)
    except OSError:
        return False


def download_image_as_webp(
    url: str,
    dest: Path,
    http: requests.Session | None = None,
    session: requests.Session | None = None,
    min_bytes: int = 4000,
) -> bool:
    if not url or not url.startswith("http"):
        return False
    if is_valid_webp(dest, min_bytes=min_bytes):
        return True
    if dest.exists() and not is_valid_webp(dest, min_bytes=min_bytes):
        dest.unlink(missing_ok=True)

    headers = {"Referer": "https://www.ubereats.com/"}
    client = http or session
    if client is None:
        client = requests.Session()

    try:
        response = client.get(url, timeout=30, headers=headers)
        response.raise_for_status()
        return save_bytes_as_webp(response.content, dest, min_bytes=min_bytes)
    except requests.RequestException:
        return False
