import pytest
from datetime import datetime, timedelta, timezone

from app import create_app
from app.extensions import db, socketio
from app.models import CrimeReport


@pytest.fixture
def app():
    flask_app = create_app()
    flask_app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
        SOCKETIO_MESSAGE_QUEUE=None,
        REQUIRE_REPORT_OTP=False,
        REQUIRE_FIR_FOR_REPORTS=False,
    )
    with flask_app.app_context():
        db.create_all()
    yield flask_app
    with flask_app.app_context():
        db.drop_all()


@pytest.fixture
def client(app):
    with app.test_client() as flask_client:
        yield flask_client


def test_create_report(client):
    response = client.post(
        "/api/reports",
        json={
            "description": "Test crime report",
            "location_lat": 12.3456,
            "location_lng": 67.8901,
            "crime_level": "high",
        },
    )
    assert response.status_code == 201
    data = response.get_json()
    assert "id" in data
    assert data["description"] == "Test crime report"
    assert data["area_count"] == 1
    assert data["area_score"] == 3
    assert data["area_level"] == "medium"


def test_heatmap_area_level_increases_with_reports(client):
    for idx in range(3):
        client.post(
            "/api/reports",
            json={
                "description": f"Clustered incident {idx}",
                "location_lat": 30.73331,
                "location_lng": 76.77941,
                "crime_level": "medium",
            },
        )

    response = client.get("/api/reports/heatmap")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["max_count"] == 3
    assert payload["max_score"] == 6
    assert len(payload["areas"]) == 1
    assert payload["areas"][0]["area_level"] == "medium"


def test_heatmap_trend_supports_multiple_days_and_locations(app, client):
    reports = [
        {
            "description": "Market theft near gate",
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "crime_level": "medium",
        },
        {
            "description": "Street harassment near bus stop",
            "location_lat": 19.0760,
            "location_lng": 72.8777,
            "crime_level": "high",
        },
        {
            "description": "Night patrol alert",
            "location_lat": 12.9716,
            "location_lng": 77.5946,
            "crime_level": "low",
        },
    ]

    for payload in reports:
        created = client.post("/api/reports", json=payload)
        assert created.status_code == 201

    with app.app_context():
        today = datetime.now(timezone.utc).date()
        target_days = [today - timedelta(days=2), today - timedelta(days=1), today]
        saved = CrimeReport.query.order_by(CrimeReport.id.asc()).all()
        for report, day in zip(saved, target_days):
            report.created_at = datetime(day.year, day.month, day.day, 12, 0, tzinfo=timezone.utc)
        db.session.commit()

    response = client.get("/api/reports/heatmap/trend?mode=daily&days=7")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["mode"] == "daily"
    assert payload["days"] == 7

    frames_by_day = {frame["date"]: frame for frame in payload["frames"]}
    for day in target_days:
        frame = frames_by_day[day.isoformat()]
        assert frame["total_reports"] == 1
        assert len(frame["areas"]) == 1


def test_create_report_rejects_invalid_coordinate_range(client):
    response = client.post(
        "/api/reports",
        json={
            "description": "Invalid coordinate",
            "location_lat": 130.7333,
            "location_lng": 276.7794,
            "crime_level": "high",
        },
    )
    assert response.status_code == 400
    assert "out of valid range" in response.get_json()["error"]


def test_socket_receives_snapshot_on_connect(app, client):
    client.post(
        "/api/reports",
        json={
            "description": "Realtime snapshot incident",
            "location_lat": 30.7333,
            "location_lng": 76.7794,
            "crime_level": "high",
        },
    )

    socket_client = socketio.test_client(app, namespace="/")
    events = socket_client.get_received("/")
    snapshot_events = [event for event in events if event["name"] == "reports_snapshot"]

    assert len(snapshot_events) >= 1
    snapshot = snapshot_events[-1]["args"][0]
    assert len(snapshot["reports"]) == 1
    assert snapshot["reports"][0]["description"] == "Realtime snapshot incident"
    assert snapshot["heatmap"]["max_count"] == 1
    assert snapshot["heatmap"]["max_score"] == 3

    socket_client.disconnect(namespace="/")


def test_higher_crime_level_gives_higher_intensity_for_same_count(client):
    client.post(
        "/api/reports",
        json={
            "description": "Low severity location",
            "location_lat": 30.7001,
            "location_lng": 76.7001,
            "crime_level": "low",
        },
    )
    client.post(
        "/api/reports",
        json={
            "description": "High severity location",
            "location_lat": 30.8001,
            "location_lng": 76.8001,
            "crime_level": "high",
        },
    )

    response = client.get("/api/reports/heatmap")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["max_count"] == 1
    assert payload["max_score"] == 3

    areas_by_score = sorted(payload["areas"], key=lambda area: area["score"])
    low_area, high_area = areas_by_score[0], areas_by_score[1]
    assert low_area["score"] == 1
    assert high_area["score"] == 3
    assert low_area["intensity"] < high_area["intensity"]


def test_report_requires_valid_otp_when_enabled(app, client):
    app.config["REQUIRE_REPORT_OTP"] = True
    app.config["OTP_DEV_MODE"] = True

    send_response = client.post("/api/auth/otp/send", json={"phone": "+919876543210"})
    assert send_response.status_code == 200
    send_payload = send_response.get_json()
    assert "session_id" in send_payload
    assert "dev_otp_code" in send_payload

    verify_response = client.post(
        "/api/auth/otp/verify",
        json={
            "session_id": send_payload["session_id"],
            "otp_code": send_payload["dev_otp_code"],
        },
    )
    assert verify_response.status_code == 200
    otp_token = verify_response.get_json()["otp_token"]

    report_response = client.post(
        "/api/reports",
        json={
            "description": "OTP protected report",
            "location_lat": 22.3456,
            "location_lng": 88.1234,
            "crime_level": "medium",
            "phone": "+919876543210",
            "otp_token": otp_token,
        },
    )
    assert report_response.status_code == 201


def test_report_stores_and_returns_hashtags(client):
    create_response = client.post(
        "/api/reports",
        json={
            "description": "Phone snatching reported near market road",
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "crime_level": "high",
            "area_name": "Connaught Place",
            "hashtags": ["#snatching", "marketwatch", "#NightAlert"],
        },
    )
    assert create_response.status_code == 201
    payload = create_response.get_json()
    assert "#snatching" in payload["hashtags"]
    assert "#marketwatch" in payload["hashtags"]
    assert "#nightalert" in payload["hashtags"]

    list_response = client.get("/api/reports")
    assert list_response.status_code == 200
    reports = list_response.get_json()
    assert len(reports) >= 1
    assert "#snatching" in reports[0]["hashtags"]


def test_report_returns_trust_fields(client):
    create_response = client.post(
        "/api/reports",
        json={
            "description": "Trust score check",
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "crime_level": "medium",
        },
    )
    assert create_response.status_code == 201
    payload = create_response.get_json()
    assert "trust_score" in payload
    assert "confirmed_count" in payload
    assert payload["confirmed_count"] == 0


def test_confirm_report_toggle(client):
    create_response = client.post(
        "/api/reports",
        json={
            "description": "Confirm me",
            "location_lat": 30.73,
            "location_lng": 76.77,
            "crime_level": "low",
        },
    )
    report_id = create_response.get_json()["id"]
    headers = {"X-Client-Id": "test-client-1"}

    first = client.post(f"/api/reports/{report_id}/confirm", json={"action": "confirm"}, headers=headers)
    assert first.status_code == 200
    assert first.get_json()["is_confirmed"] is True
    assert first.get_json()["confirmed_count"] == 1

    second = client.post(f"/api/reports/{report_id}/confirm", json={"action": "remove"}, headers=headers)
    assert second.status_code == 200
    assert second.get_json()["is_confirmed"] is False
    assert second.get_json()["confirmed_count"] == 0


def test_geo_alert_check(client, monkeypatch):
    client.post(
        "/api/reports",
        json={
            "description": "High risk near city center",
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "crime_level": "high",
        },
    )
    monkeypatch.setattr(
        "app.api.reports.geocode_location",
        lambda query: {
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "area_name": "Connaught Place",
            "display_name": "Connaught Place, Delhi, India",
        },
    )
    response = client.get("/api/reports/alerts/check?area=Connaught%20Place%2C%20Delhi&radius_km=5&min_risk=high")
    assert response.status_code == 200
    payload = response.get_json()
    assert "alerts" in payload
    assert "should_notify" in payload


def test_report_duplicate_detection_blocks(client):
    first = client.post(
        "/api/reports",
        json={
            "description": "Bike theft near market gate",
            "location_lat": 30.7333,
            "location_lng": 76.7794,
            "crime_level": "medium",
        },
        headers={"X-Client-Id": "dup-client"},
    )
    assert first.status_code == 201

    second = client.post(
        "/api/reports",
        json={
            "description": "Bike theft near market gate",
            "location_lat": 30.73331,
            "location_lng": 76.77941,
            "crime_level": "medium",
        },
        headers={"X-Client-Id": "dup-client"},
    )
    assert second.status_code == 429
    assert "Duplicate report" in second.get_json()["error"]


def test_report_rate_limit_blocks_after_threshold(app, client):
    app.config["REPORT_RATE_LIMIT_COUNT"] = 2
    app.config["REPORT_RATE_LIMIT_WINDOW_SECONDS"] = 600

    for idx in range(2):
        response = client.post(
            "/api/reports",
            json={
                "description": f"Unique report {idx}",
                "location_lat": 28.61 + idx * 0.01,
                "location_lng": 77.21 + idx * 0.01,
                "crime_level": "low",
            },
            headers={"X-Client-Id": "rate-client"},
        )
        assert response.status_code == 201

    blocked = client.post(
        "/api/reports",
        json={
            "description": "Third report should block",
            "location_lat": 28.65,
            "location_lng": 77.25,
            "crime_level": "low",
        },
        headers={"X-Client-Id": "rate-client"},
    )
    assert blocked.status_code == 429
    assert "Too many reports" in blocked.get_json()["error"]


def test_route_safety_returns_recommended_route(client, monkeypatch):
    client.post(
        "/api/reports",
        json={
            "description": "High incident corridor",
            "location_lat": 28.614,
            "location_lng": 77.209,
            "crime_level": "high",
        },
    )

    def fake_geocode(query):
        query_l = query.lower()
        if "origin" in query_l:
            return {
                "location_lat": 28.61,
                "location_lng": 77.20,
                "display_name": "Origin Point",
            }
        return {
            "location_lat": 28.63,
            "location_lng": 77.24,
            "display_name": "Destination Point",
        }

    monkeypatch.setattr("app.api.reports.geocode_location", fake_geocode)
    response = client.get("/api/reports/route/safety?origin=origin&destination=destination")
    assert response.status_code == 200
    payload = response.get_json()
    assert "recommended_route_id" in payload
    assert len(payload["routes"]) >= 1


def test_report_suggestions_returns_ai_insights(client):
    response = client.post(
        "/api/reports/suggestions",
        json={
            "description": "Two men did phone snatching near bus stand and threatened with knife.",
            "area_name": "Sector 17",
            "crime_level": "high",
        },
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert "hashtags" in payload
    assert "ai" in payload
    assert payload["ai"]["category"] in {"theft", "assault", "harassment", "fraud", "vandalism", "kidnapping", "general"}
    assert payload["ai"]["urgency_hint"] in {"low", "medium", "high", "critical"}


def test_semantic_duplicate_detection_blocks_nearby_variation(client):
    first = client.post(
        "/api/reports",
        json={
            "description": "Phone snatching happened near Sector 17 market at night.",
            "location_lat": 30.7333,
            "location_lng": 76.7794,
            "crime_level": "high",
        },
        headers={"X-Client-Id": "semantic-dup-client"},
    )
    assert first.status_code == 201

    second = client.post(
        "/api/reports",
        json={
            "description": "At night, there was a mobile snatching incident close to Sector 17 market.",
            "location_lat": 30.73345,
            "location_lng": 76.7796,
            "crime_level": "high",
        },
        headers={"X-Client-Id": "semantic-dup-client"},
    )
    assert second.status_code == 429
    assert "similar report already exists nearby" in second.get_json()["error"].lower()


def test_analytics_contains_danger_now_block(client):
    client.post(
        "/api/reports",
        json={
            "description": "Quick incident one",
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "crime_level": "medium",
        },
    )
    client.post(
        "/api/reports",
        json={
            "description": "Quick incident two",
            "location_lat": 28.6139,
            "location_lng": 77.2090,
            "crime_level": "high",
        },
    )
    response = client.get("/api/reports/analytics?days=30")
    assert response.status_code == 200
    payload = response.get_json()
    assert "danger_now" in payload
    assert payload["danger_now"]["status"] in {"normal", "elevated", "critical"}
    assert "pressure_index" in payload["danger_now"]
