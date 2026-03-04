const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000"
).replace(/\/$/, "");

function getClientId() {
  if (typeof window === "undefined") return "server-client";
  const key = "ls_client_id";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = `cid_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    window.localStorage.setItem(key, value);
  }
  return value;
}

function withBaseUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchReports() {
  const response = await fetch(`${API_BASE_URL}/api/reports`, {
    cache: "no-store",
    headers: {
      "X-Client-Id": getClientId(),
    },
  });
  if (!response.ok) {
    throw new Error("Failed to load reports");
  }
  const reports = await response.json();
  return reports.map((report) => ({
    ...report,
    image_url: withBaseUrl(report.image_url),
  }));
}

export async function fetchHeatmap() {
  const response = await fetch(`${API_BASE_URL}/api/reports/heatmap`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load heatmap data");
  }
  return response.json();
}

export async function fetchHeatmapTrend(options = {}) {
  const params = new URLSearchParams();
  if (options.days) params.set("days", String(options.days));
  if (options.mode) params.set("mode", options.mode);
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/api/reports/heatmap/trend${query ? `?${query}` : ""}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Failed to load heatmap trend data");
  }
  return response.json();
}

export async function fetchReportSuggestions(payload) {
  const response = await fetch(`${API_BASE_URL}/api/reports/suggestions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to load report suggestions");
  }
  return data;
}

export async function geocodeLocation(query) {
  const response = await fetch(`${API_BASE_URL}/api/reports/location/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to resolve location");
  }
  return data;
}

export async function reverseGeocodeLocation(locationLat, locationLng) {
  const response = await fetch(`${API_BASE_URL}/api/reports/location/reverse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location_lat: locationLat,
      location_lng: locationLng,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to detect area");
  }
  return data;
}

export async function fetchAnalytics(options = {}) {
  const params = new URLSearchParams();
  if (options.area) params.set("area", options.area);
  if (options.days) params.set("days", String(options.days));
  const query = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/api/reports/analytics${query ? `?${query}` : ""}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Failed to load analytics data");
  }
  return response.json();
}

export async function createReport(payload) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/reports`, {
      method: "POST",
      headers: {
        "X-Client-Id": getClientId(),
      },
      body: payload,
    });
  } catch (error) {
    throw new Error("Cannot reach backend. Ensure Flask API is running on port 5000.");
  }

  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { error: text || "Unexpected backend response" };
  }

  if (!response.ok) {
    throw new Error(data.error || `Failed to submit report (${response.status})`);
  }

  return {
    ...data,
    image_url: withBaseUrl(data.image_url),
  };
}

export async function fetchRouteSafety({ origin, destination }) {
  const params = new URLSearchParams();
  params.set("origin", origin || "");
  params.set("destination", destination || "");
  const response = await fetch(`${API_BASE_URL}/api/reports/route/safety?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to fetch safe route");
  }
  return data;
}

export async function sendOtp(phone) {
  const response = await fetch(`${API_BASE_URL}/api/auth/otp/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to send OTP");
  }
  return data;
}

export async function verifyOtp(sessionId, otpCode) {
  const response = await fetch(`${API_BASE_URL}/api/auth/otp/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ session_id: sessionId, otp_code: otpCode }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to verify OTP");
  }
  return data;
}

export async function fetchComments(reportId) {
  const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}/comments`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to load comments");
  }
  return response.json();
}

export async function createComment(reportId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to post comment");
  }
  return data;
}

export async function confirmIncident(reportId, confirmed = true) {
  const response = await fetch(`${API_BASE_URL}/api/reports/${reportId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": getClientId(),
    },
    body: JSON.stringify({
      action: confirmed ? "confirm" : "remove",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to confirm report");
  }
  return data;
}

export async function checkGeoAlerts({ area, radiusKm = 3, minRisk = "high" }) {
  const params = new URLSearchParams();
  params.set("area", area || "");
  params.set("radius_km", String(radiusKm));
  params.set("min_risk", minRisk);
  const response = await fetch(`${API_BASE_URL}/api/reports/alerts/check?${params.toString()}`, {
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to check geo alerts");
  }
  return data;
}

export async function verifyFir(payload) {
  const response = await fetch(`${API_BASE_URL}/api/fir/verify`, {
    method: "POST",
    body: payload,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to verify FIR");
  }
  return data;
}

export async function searchFirRecords(payload) {
  const response = await fetch(`${API_BASE_URL}/api/fir/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to search FIR records");
  }
  return data;
}

export { API_BASE_URL };
