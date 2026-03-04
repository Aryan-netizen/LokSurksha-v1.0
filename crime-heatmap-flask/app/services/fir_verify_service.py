from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

import requests
from flask import current_app

FIR_NUMBER_PATTERN = re.compile(r"^[A-Z]{0,4}\s*\d{1,6}(?:/\d{2,4})?$")


def _parse_date(value: str) -> tuple[datetime | None, str]:
    raw = (value or "").strip()
    if not raw:
        return None, "FIR date is required"
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            parsed = datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
            if parsed > datetime.now(timezone.utc):
                return None, "FIR date cannot be in the future"
            return parsed, ""
        except ValueError:
            continue
    return None, "Invalid FIR date format"


def _normalize_fir_number(value: str) -> str:
    raw = (value or "").strip().upper().replace(" ", "")
    if "/" not in raw:
        return raw
    lhs, rhs = raw.split("/", 1)
    lhs = lhs.lstrip("0") or "0"
    return f"{lhs}/{rhs}"


def _normalize_station(value: str) -> str:
    raw = " ".join((value or "").lower().split())
    raw = raw.replace("police station", "").replace("p.s.", "").replace("ps", "")
    return "".join(ch for ch in raw if ch.isalnum())


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("records", "data", "result", "results", "items", "firRecords", "fir_records"):
        val = payload.get(key)
        if isinstance(val, list):
            return [item for item in val if isinstance(item, dict)]
        if isinstance(val, dict):
            nested = _extract_rows(val)
            if nested:
                return nested
    return []


def _row_first(row: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = row.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _hyperverge_lookup(
    *,
    state: str,
    police_station: str,
    fir_number: str,
    fir_date: str,
    ipc_sections: str = "",
) -> tuple[dict[str, Any] | None, str]:
    url = (current_app.config.get("HYPERVERGE_FIR_VERIFY_URL") or "").strip()
    app_id = (current_app.config.get("HYPERVERGE_APP_ID") or "").strip()
    app_key = (current_app.config.get("HYPERVERGE_APP_KEY") or "").strip()
    bearer = (current_app.config.get("HYPERVERGE_BEARER_TOKEN") or "").strip()
    method = (current_app.config.get("HYPERVERGE_HTTP_METHOD") or "POST").strip().upper()
    timeout = int(current_app.config.get("HYPERVERGE_TIMEOUT_SECONDS", 20))

    if not url:
        return None, "HYPERVERGE_FIR_VERIFY_URL is not configured"
    if not app_id or not app_key:
        return None, "HYPERVERGE_APP_ID or HYPERVERGE_APP_KEY is not configured"

    headers = {
        "appID": app_id,
        "appKey": app_key,
        "transactionID": f"loksurksha-{uuid.uuid4().hex[:18]}",
        "Content-Type": "application/json",
    }
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"

    body = {
        "state": state,
        "police_station": police_station,
        "fir_number": fir_number,
        "fir_date": fir_date,
        "ipc_sections": ipc_sections,
        "stateName": state,
        "policeStation": police_station,
        "firNumber": fir_number,
        "firDate": fir_date,
        "ipcSections": ipc_sections,
    }

    try:
        if method == "GET":
            response = requests.get(url, params=body, headers=headers, timeout=timeout)
        else:
            response = requests.post(url, json=body, headers=headers, timeout=timeout)
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict):
            return payload, ""
        return None, "HyperVerge returned non-object payload"
    except Exception as exc:
        return None, f"HyperVerge request failed: {exc}"


def _evaluate_payload(payload: dict[str, Any], state: str, station: str, number: str, date: str) -> tuple[bool, str]:
    truthy = {"verified", "success", "ok", "match_found", "matched", "true", "1"}
    bool_keys = ("verified", "isVerified", "is_verified", "success", "match", "matched", "is_match")
    for key in bool_keys:
        if key in payload:
            val = payload.get(key)
            if isinstance(val, bool):
                return val, f"HyperVerge {key}={val}"
            if isinstance(val, (int, float)):
                return bool(val), f"HyperVerge {key}={val}"
            text = str(val).strip().lower()
            if text:
                return text in truthy, f"HyperVerge {key}={text}"

    status_raw = str(payload.get("status") or payload.get("resultStatus") or "").strip().lower()
    if status_raw:
        if status_raw in truthy:
            return True, f"HyperVerge status={status_raw}"
        if status_raw in {"failed", "not_verified", "rejected", "error"}:
            return False, f"HyperVerge status={status_raw}"

    rows = _extract_rows(payload)
    if not rows:
        return False, "HyperVerge response had no FIR rows"

    target_number = _normalize_fir_number(number)
    target_station = _normalize_station(station)
    target_state = (state or "").strip().lower()
    target_date = date.strip()
    for row in rows:
        row_number = _normalize_fir_number(_row_first(row, ["fir_number", "firNo", "fir_no", "number", "firNumber"]))
        row_station = _normalize_station(_row_first(row, ["police_station", "policeStation", "ps_name", "station_name"]))
        row_state = _row_first(row, ["state", "stateName"]).lower()
        row_date = _row_first(row, ["registration_date", "fir_date", "firDate", "date_of_registration"])
        if (
            row_number == target_number
            and (not target_station or row_station == target_station)
            and (not target_state or row_state == target_state)
            and (not target_date or row_date.startswith(target_date))
        ):
            return True, "HyperVerge FIR row match found"
    return False, "HyperVerge FIR row match not found"


def verify_fir_payload(
    *,
    state: str,
    police_station: str,
    fir_number: str,
    fir_date: str,
    ipc_sections: str = "",
    filename: str = "",
    file_bytes: bytes | None = None,
) -> dict[str, Any]:
    state = (state or "").strip()
    station = (police_station or "").strip()
    number = (fir_number or "").strip().upper()
    parsed_date, date_error = _parse_date(fir_date)

    checks: list[dict[str, Any]] = []
    checks.append(
        {
            "name": "Police station format",
            "passed": 3 <= len(station) <= 120 and bool(re.match(r"^[A-Za-z0-9 .,&'()/-]+$", station)),
            "detail": "Police station format valid",
            "weight": 20,
        }
    )
    checks.append(
        {
            "name": "FIR number format",
            "passed": bool(FIR_NUMBER_PATTERN.match(number)),
            "detail": "FIR number format valid",
            "weight": 20,
        }
    )
    checks.append(
        {
            "name": "FIR date validity",
            "passed": parsed_date is not None,
            "detail": "Date valid" if parsed_date else date_error,
            "weight": 20,
        }
    )

    payload, lookup_error = _hyperverge_lookup(
        state=state,
        police_station=station,
        fir_number=number,
        fir_date=fir_date,
        ipc_sections=ipc_sections,
    )
    if payload is None:
        checks.append(
            {
                "name": "HyperVerge lookup",
                "passed": False,
                "detail": lookup_error,
                "weight": 40,
            }
        )
        return {
            "status": "not_verified",
            "score": 0,
            "checks": checks,
            "provider": "hyperverge",
            "provider_mode": "live_unavailable",
            "provider_error": lookup_error,
            "disclaimer": "Verification uses HyperVerge FIR API response.",
        }

    matched, detail = _evaluate_payload(payload, state=state, station=station, number=number, date=fir_date)
    checks.append(
        {
            "name": "HyperVerge lookup",
            "passed": matched,
            "detail": detail,
            "weight": 40,
        }
    )
    status = "verified_likely" if matched else "not_verified"
    return {
        "status": status,
        "score": 100 if matched else 0,
        "checks": checks,
        "provider": "hyperverge",
        "provider_mode": "live",
        "provider_error": None,
        "provider_response": payload,
        "disclaimer": "Verification uses HyperVerge FIR API response.",
    }
