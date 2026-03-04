from __future__ import annotations

import requests

NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "LokSurksha/1.0 (safety-reporting-app)"}


def _pick_area_name(address: dict) -> str:
    return (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("city_district")
        or address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("state")
        or ""
    )


def _extract_location_components(address: dict) -> dict:
    locality = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("city_district")
        or address.get("quarter")
        or ""
    )
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("county")
        or ""
    )
    state = address.get("state") or ""
    return {
        "state": state,
        "city": city,
        "locality": locality,
    }


def geocode_location(query: str) -> dict | None:
    query = (query or "").strip()
    if len(query) < 3:
        return None

    response = requests.get(
        f"{NOMINATIM_BASE}/search",
        params={
            "q": query,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
        },
        headers=HEADERS,
        timeout=12,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"geocoding provider error ({response.status_code})")
    payload = response.json()
    if not payload:
        return None

    top = payload[0]
    address = top.get("address") or {}
    location_parts = _extract_location_components(address)
    lat = top.get("lat")
    lon = top.get("lon")
    if lat is None or lon is None:
        return None

    return {
        "location_lat": float(lat),
        "location_lng": float(lon),
        "area_name": _pick_area_name(address) or (top.get("display_name") or query),
        "display_name": top.get("display_name") or query,
        "state": location_parts["state"],
        "city": location_parts["city"],
        "locality": location_parts["locality"],
    }


def reverse_geocode_location(lat: float, lng: float) -> dict | None:
    response = requests.get(
        f"{NOMINATIM_BASE}/reverse",
        params={
            "lat": lat,
            "lon": lng,
            "format": "jsonv2",
            "addressdetails": 1,
        },
        headers=HEADERS,
        timeout=12,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"reverse geocoding provider error ({response.status_code})")
    payload = response.json()
    if not payload:
        return None

    address = payload.get("address") or {}
    location_parts = _extract_location_components(address)
    return {
        "location_lat": float(lat),
        "location_lng": float(lng),
        "area_name": _pick_area_name(address) or (payload.get("display_name") or ""),
        "display_name": payload.get("display_name") or "",
        "state": location_parts["state"],
        "city": location_parts["city"],
        "locality": location_parts["locality"],
    }
