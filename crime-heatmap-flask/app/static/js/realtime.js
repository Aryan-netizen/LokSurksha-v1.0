const socket = io({
    transports: ["websocket", "polling"],
    reconnection: true,
});

const reportList = document.getElementById("report-list");
const reportForm = document.getElementById("report-form");
const socketStatus = document.getElementById("socket-status");
const feedback = document.getElementById("form-feedback");
const renderedReportIds = new Set();

function setStatus(text, statusClass) {
    if (!socketStatus) return;
    socketStatus.textContent = text;
    socketStatus.className = `status ${statusClass}`;
}

function setFeedback(text, type) {
    if (!feedback) return;
    feedback.textContent = text || "";
    feedback.className = `feedback ${type || ""}`.trim();
}

function formatDate(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function renderReport(report) {
    if (!reportList) return;
    if (renderedReportIds.has(report.id)) return;
    renderedReportIds.add(report.id);

    const li = document.createElement("li");
    li.className = `report ${report.crime_level || "low"}`;
    li.innerHTML = `
        <p><strong>Description:</strong> ${report.description}</p>
        <p><strong>Location:</strong> ${report.location_lat.toFixed(5)}, ${report.location_lng.toFixed(5)}</p>
        <p><strong>Crime Type:</strong> ${report.crime_level}</p>
        <p><strong>Area Reports:</strong> ${report.area_count} (${report.area_level.toUpperCase()})</p>
        <p><strong>Reported:</strong> ${formatDate(report.created_at)}</p>
        ${report.image_url ? `<img src="${report.image_url}" alt="Crime report evidence image">` : ""}
    `;
    reportList.prepend(li);
}

function applySnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;

    const reports = Array.isArray(snapshot.reports) ? snapshot.reports : [];
    if (reportList) {
        reportList.innerHTML = "";
        renderedReportIds.clear();
        reports.forEach(renderReport);
    }

    if (snapshot.heatmap && window.applyHeatmapPayload) {
        window.applyHeatmapPayload(snapshot.heatmap);
    } else if (window.refreshHeatmap) {
        window.refreshHeatmap();
    }
}

async function loadReports() {
    if (!reportList) return;

    try {
        const response = await fetch("/api/reports");
        const reports = await response.json();
        reportList.innerHTML = "";
        renderedReportIds.clear();
        reports.forEach(renderReport);
    } catch (error) {
        console.error("Error loading reports:", error);
    }
}

socket.on("connect", () => {
    setStatus("Live: connected", "status-connected");
    socket.emit("request_state");
});

socket.on("disconnect", () => {
    setStatus("Disconnected: retrying...", "status-disconnected");
});

socket.on("reconnect_attempt", () => {
    setStatus("Reconnecting...", "status-connecting");
});

socket.on("new_report", (data) => {
    renderReport(data);
});

socket.on("reports_snapshot", (snapshot) => {
    applySnapshot(snapshot);
});

socket.on("heatmap_update", (payload) => {
    if (window.applyHeatmapPayload) {
        window.applyHeatmapPayload(payload);
    } else if (window.refreshHeatmap) {
        window.refreshHeatmap();
    }
});

if (reportForm) {
    reportForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setFeedback("");

        try {
            const formData = new FormData(reportForm);
            const response = await fetch("/api/reports", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: "Unknown error" }));
                setFeedback(err.error || "Failed to submit report", "error");
                return;
            }

            reportForm.reset();
            setFeedback("Report submitted successfully. Live map updating...", "success");
        } catch (error) {
            console.error("Error submitting report:", error);
            setFeedback("Unable to submit report right now. Please try again.", "error");
        }
    });
}

loadReports();
if (window.refreshHeatmap) {
    window.refreshHeatmap();
}
