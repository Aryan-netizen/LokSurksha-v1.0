from __future__ import annotations

import re

from app.extensions import db
from app.models import AreaAlias


def area_key_from_coords(lat: float, lng: float, precision: int = 3) -> str:
    return f"{round(lat, precision):.{precision}f},{round(lng, precision):.{precision}f}"


def normalize_area_name(value: str) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"\s+", " ", value).strip()
    return cleaned[:120]


def _fallback_name(area_key: str) -> str:
    token = abs(hash(area_key)) % 999 + 1
    return f"Area {token:03d}"


def build_area_name_map(area_keys: list[str]) -> dict[str, str]:
    keys = [key for key in area_keys if key]
    if not keys:
        return {}
    aliases = AreaAlias.query.filter(AreaAlias.area_key.in_(keys)).all()
    mapping = {alias.area_key: alias.area_name for alias in aliases}
    for key in keys:
        if key not in mapping:
            mapping[key] = _fallback_name(key)
    return mapping


def get_area_name(lat: float, lng: float, precision: int = 3) -> str:
    key = area_key_from_coords(lat, lng, precision=precision)
    area_map = build_area_name_map([key])
    return area_map.get(key, _fallback_name(key))


def set_area_name(lat: float, lng: float, area_name: str, precision: int = 3) -> str:
    normalized = normalize_area_name(area_name)
    key = area_key_from_coords(lat, lng, precision=precision)
    if not normalized:
        return get_area_name(lat, lng, precision=precision)

    alias = AreaAlias.query.filter_by(area_key=key).first()
    if alias:
        alias.area_name = normalized
    else:
        db.session.add(AreaAlias(area_key=key, area_name=normalized))
    db.session.commit()
    return normalized
