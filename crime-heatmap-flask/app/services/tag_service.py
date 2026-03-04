from __future__ import annotations

import json
import re

MAX_TAGS = 8

KEYWORD_TAGS = {
    "theft": ["#theft", "#propertycrime", "#stolen"],
    "snatching": ["#snatching", "#streetcrime", "#robbery"],
    "robbery": ["#robbery", "#violentcrime", "#armedthreat"],
    "assault": ["#assault", "#violence", "#publicsafety"],
    "fraud": ["#fraud", "#scamalert", "#financialcrime"],
    "cyber": ["#cybercrime", "#onlinefraud", "#digitalsafety"],
    "vandalism": ["#vandalism", "#publicproperty", "#civicdamage"],
    "drug": ["#drugactivity", "#narcotics", "#safetywatch"],
    "harassment": ["#harassment", "#safestreets", "#citizenalert"],
}


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "", (value or "").lower())
    return cleaned[:28]


def _to_hashtag(value: str) -> str:
    slug = _slug(value)
    if not slug:
        return ""
    return f"#{slug}"


def _is_noisy_area_tag(area_name: str) -> bool:
    text = (area_name or "").strip().lower()
    if not text:
        return True
    prefixes = ("ward ", "sector ", "sec ")
    if text.startswith(prefixes):
        return True
    if any(ch.isdigit() for ch in text) and len(text) <= 18:
        return True
    return False


def normalize_hashtags(raw_tags) -> list[str]:
    values = []
    if raw_tags is None:
        return values

    if isinstance(raw_tags, str):
        text = raw_tags.strip()
        if text.startswith("["):
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    values = parsed
                else:
                    values = text.split(",")
            except json.JSONDecodeError:
                values = text.split(",")
        else:
            values = text.split(",")
    elif isinstance(raw_tags, list):
        values = raw_tags

    normalized = []
    for item in values:
        tag = _to_hashtag(str(item).replace("#", ""))
        if tag and tag not in normalized:
            normalized.append(tag)
        if len(normalized) >= MAX_TAGS:
            break
    return normalized


def suggest_hashtags(description: str = "", area_name: str = "", crime_level: str = "low") -> list[str]:
    text = (description or "").lower()
    suggested = []

    for keyword, tags in KEYWORD_TAGS.items():
        if keyword in text:
            for tag in tags:
                if tag not in suggested:
                    suggested.append(tag)

    level_tag = _to_hashtag(f"{crime_level}risk")
    if level_tag and level_tag not in suggested:
        suggested.append(level_tag)

    if not _is_noisy_area_tag(area_name):
        area_tag = _to_hashtag(area_name)
        if area_tag and area_tag not in suggested:
            suggested.append(area_tag)

    base_tags = ["#citizenreport", "#loksurksha"]
    for tag in base_tags:
        if tag not in suggested:
            suggested.append(tag)

    return suggested[:MAX_TAGS]
