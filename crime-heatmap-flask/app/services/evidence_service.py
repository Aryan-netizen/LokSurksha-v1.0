from __future__ import annotations

import os
from functools import lru_cache

from PIL import Image, ImageStat

SENSITIVE_TERMS = {
    "blood",
    "bleeding",
    "dead",
    "body",
    "corpse",
    "weapon",
    "knife",
    "gun",
    "assault",
    "attack",
    "violence",
    "injury",
}


def _variance(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    return sum((v - mean) ** 2 for v in values) / len(values)


@lru_cache(maxsize=1024)
def _analyze_cached(path: str, mtime: float, size: int) -> dict:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        gray = rgb.convert("L")
        stat_gray = ImageStat.Stat(gray)
        brightness = float(stat_gray.mean[0]) if stat_gray.mean else 0.0
        contrast = float(stat_gray.stddev[0]) if stat_gray.stddev else 0.0

        # Blur heuristic: low variance of grayscale histogram.
        hist = gray.histogram()
        hist_variance = _variance([float(v) for v in hist])
        blur_score = max(0.0, min(1.0, 1.0 - min(1.0, hist_variance / 70000.0)))

        # Blood-like dominance heuristic (very rough).
        w, h = rgb.size
        pixels = list(rgb.getdata())
        total = max(1, len(pixels))
        strong_red = 0
        for r, g, b in pixels[:: max(1, total // 5000)]:
            if r > 120 and r > g * 1.35 and r > b * 1.35:
                strong_red += 1
        sampled = max(1, len(pixels[:: max(1, total // 5000)]))
        red_ratio = strong_red / sampled

        too_dark = brightness < 42
        too_blurry = blur_score > 0.72 or contrast < 18
        low_resolution = w < 420 or h < 420
        quality_ok = not (too_dark or too_blurry or low_resolution)

        tips = []
        if too_dark:
            tips.append("Image is dark; retake in better lighting.")
        if too_blurry:
            tips.append("Image appears blurry; hold camera steady and refocus.")
        if low_resolution:
            tips.append("Image resolution is low; capture a closer, clearer frame.")
        if not tips:
            tips.append("Evidence image quality looks acceptable.")

        return {
            "width": int(w),
            "height": int(h),
            "brightness": round(brightness, 2),
            "contrast": round(contrast, 2),
            "blur_score": round(blur_score, 3),
            "red_signal": round(red_ratio, 3),
            "quality_ok": bool(quality_ok),
            "quality_flags": {
                "too_dark": bool(too_dark),
                "too_blurry": bool(too_blurry),
                "low_resolution": bool(low_resolution),
            },
            "tips": tips[:3],
        }


def analyze_evidence(image_path: str, description: str = "") -> dict:
    if not image_path or not os.path.exists(image_path):
        return {
            "has_evidence": False,
            "is_sensitive": False,
            "auto_blur": False,
            "quality_ok": False,
            "quality_flags": {},
            "tips": ["No evidence image attached."],
        }

    stat = os.stat(image_path)
    meta = _analyze_cached(image_path, float(stat.st_mtime), int(stat.st_size))
    desc = (description or "").lower()
    text_sensitive = any(term in desc for term in SENSITIVE_TERMS)
    image_sensitive = bool(meta.get("red_signal", 0.0) >= 0.28)
    is_sensitive = text_sensitive or image_sensitive

    return {
        "has_evidence": True,
        "is_sensitive": is_sensitive,
        "auto_blur": is_sensitive,
        "quality_ok": bool(meta.get("quality_ok")),
        "quality_flags": meta.get("quality_flags", {}),
        "tips": meta.get("tips", []),
        "metrics": {
            "width": meta.get("width"),
            "height": meta.get("height"),
            "brightness": meta.get("brightness"),
            "contrast": meta.get("contrast"),
            "blur_score": meta.get("blur_score"),
        },
    }
