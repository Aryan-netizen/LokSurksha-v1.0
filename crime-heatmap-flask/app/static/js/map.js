const map = L.map("heatmap").setView([20, 0], 2);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let heatLayer = L.heatLayer([], {
    radius: 42,
    blur: 28,
    maxZoom: 17,
    minOpacity: 0.3,
    gradient: {
        0.2: "#5bc0eb",
        0.4: "#3a86ff",
        0.6: "#ffbe0b",
        0.8: "#fb5607",
        1.0: "#e63946",
    },
}).addTo(map);
let areaMarkers = [];
let hasAutoCentered = false;
const latInput = document.getElementById("location_lat");
const lngInput = document.getElementById("location_lng");

function scaleIntensity(rawIntensity) {
    const value = Math.max(0, Math.min(1, Number(rawIntensity) || 0));
    // Non-linear boost so dense clusters become visually red faster.
    return Math.pow(value, 0.6);
}

function colorForIntensity(intensity) {
    const value = scaleIntensity(intensity);
    const r = 255;
    const g = Math.round(210 - value * 210);
    const b = Math.round(60 - value * 60);
    return `rgb(${r}, ${g}, ${b})`;
}

function applyHeatmapPayload(payload) {
    const areas = payload?.areas || [];
    const points = areas.map((a) => {
        const boosted = scaleIntensity(a.intensity || 0.1);
        return [a.location_lat, a.location_lng, boosted];
    });
    heatLayer.setLatLngs(points);

    areaMarkers.forEach((marker) => map.removeLayer(marker));
    areaMarkers = areas.map((area) => {
        const boosted = scaleIntensity(area.intensity);
        const color = colorForIntensity(area.intensity);
        const marker = L.circleMarker([area.location_lat, area.location_lng], {
            radius: Math.min(10 + area.count * 1.5, 24),
            color,
            fillColor: color,
            fillOpacity: Math.min(0.45 + boosted * 0.3, 0.85),
            weight: 1.2,
        });
        marker.bindPopup(
            `Area reports: ${area.count}<br>Risk: ${area.area_level.toUpperCase()}<br>Intensity: ${(boosted * 100).toFixed(0)}%`
        );
        marker.addTo(map);
        return marker;
    });

    if (!hasAutoCentered && areas.length > 0) {
        const bounds = L.latLngBounds(areas.map((a) => [a.location_lat, a.location_lng]));
        map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
        hasAutoCentered = true;
    }
}

map.on("click", (event) => {
    if (latInput) latInput.value = event.latlng.lat.toFixed(6);
    if (lngInput) lngInput.value = event.latlng.lng.toFixed(6);
});

async function refreshHeatmap() {
    try {
        const response = await fetch("/api/reports/heatmap");
        const payload = await response.json();
        applyHeatmapPayload(payload);
    } catch (error) {
        console.error("Error refreshing heatmap:", error);
    }
}

window.refreshHeatmap = refreshHeatmap;
window.applyHeatmapPayload = applyHeatmapPayload;
