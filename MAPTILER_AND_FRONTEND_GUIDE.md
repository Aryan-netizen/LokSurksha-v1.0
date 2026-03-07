# MapTiler & Frontend Architecture Guide

## Table of Contents
1. [What is MapTiler?](#what-is-maptiler)
2. [How MapTiler Works](#how-maptiler-works)
3. [Frontend Architecture](#frontend-architecture)
4. [Map Implementation](#map-implementation)
5. [Data Flow](#data-flow)
6. [Features Breakdown](#features-breakdown)

---

## What is MapTiler?

**MapTiler** is a cloud-based mapping platform that provides:
- **Map Tiles**: Pre-rendered map images (streets, satellite, terrain)
- **Geocoding API**: Convert addresses to coordinates and vice versa
- **Map Styles**: Customizable map appearances
- **SDK**: JavaScript library for interactive maps

### Why MapTiler?
- ✅ Free tier available (100,000 tile loads/month)
- ✅ Fast and reliable CDN
- ✅ Beautiful pre-made styles
- ✅ Easy to integrate
- ✅ No credit card required for free tier

### Alternatives
- Google Maps (expensive, requires billing)
- Mapbox (similar to MapTiler)
- Leaflet + OpenStreetMap (free but requires more setup)

---

## How MapTiler Works

### 1. Map Tiles System

```
┌─────────────────────────────────────────┐
│         MapTiler Cloud Servers          │
│  (Stores pre-rendered map tiles)        │
└─────────────────┬───────────────────────┘
                  │
                  │ HTTPS Request
                  │ GET /tiles/streets/z/x/y.png
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Your Frontend (Browser)         │
│  - Requests tiles based on zoom/pan     │
│  - Assembles tiles into complete map    │
│  - Adds custom layers (heatmap, points) │
└─────────────────────────────────────────┘
```

### 2. Tile Coordinate System

Maps are divided into tiles at different zoom levels:

```
Zoom 0: 1 tile (entire world)
Zoom 1: 4 tiles (2×2 grid)
Zoom 2: 16 tiles (4×4 grid)
...
Zoom 14: 268,435,456 tiles (16,384×16,384 grid)
```

Each tile is identified by: `{z}/{x}/{y}`
- `z` = zoom level (0-22)
- `x` = column number
- `y` = row number

### 3. API Key Authentication

```javascript
// Set API key
maptilersdk.config.apiKey = 'YOUR_API_KEY'

// MapTiler adds key to all requests
// https://api.maptiler.com/maps/streets/tiles.json?key=YOUR_API_KEY
```

### 4. Map Rendering Process

```
1. User opens page
   ↓
2. Frontend loads MapTiler SDK
   ↓
3. SDK requests map style JSON
   ↓
4. SDK calculates which tiles to load
   ↓
5. SDK requests tiles from CDN
   ↓
6. Browser renders tiles
   ↓
7. Custom layers added on top
   ↓
8. User sees interactive map
```

---

## Frontend Architecture

### Technology Stack

```
Next.js 16 (React 19)
├── App Router (/src/app)
├── Server Components (default)
└── Client Components ('use client')
    ├── Map Component (interactive)
    ├── API Client (fetch data)
    └── UI Components (buttons, cards)
```

### File Structure

```
frontend/
├── src/
│   ├── app/                      # Next.js pages
│   │   ├── page.js               # Home page
│   │   ├── heatmap/              # Heatmap feature
│   │   │   ├── page.jsx          # Heatmap page wrapper
│   │   │   ├── map.jsx           # Map component (main logic)
│   │   │   └── map.css           # Map styles
│   │   ├── report/               # Report submission
│   │   ├── feed/                 # Crime feed
│   │   ├── analytic/             # Analytics dashboard
│   │   └── safety/               # Route safety checker
│   ├── components/               # Reusable components
│   │   └── ui/                   # UI primitives
│   ├── lib/
│   │   └── api.js                # API client functions
│   └── config.js                 # Configuration
└── public/                       # Static assets
```

---

## Map Implementation

### Step-by-Step Breakdown

#### 1. Initialize Map

```javascript
// Import MapTiler SDK
const maptilersdk = await import('@maptiler/sdk')

// Configure API key
maptilersdk.config.apiKey = 'YOUR_API_KEY'

// Create map instance
map.current = new maptilersdk.Map({
  container: mapContainer.current,  // DOM element
  style: maptilersdk.MapStyle.STREETS,  // Map style
  center: [76.7794, 30.7333],  // [longitude, latitude]
  zoom: 11  // Zoom level (0-22)
})
```

#### 2. Add Data Sources

```javascript
// Heatmap data source (GeoJSON)
map.addSource('crime-heat-source', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { heat_weight: 0.8 },
        geometry: {
          type: 'Point',
          coordinates: [76.7794, 30.7333]
        }
      }
    ]
  }
})
```

#### 3. Add Visualization Layers

```javascript
// Heatmap layer
map.addLayer({
  id: 'crime-heat-layer',
  type: 'heatmap',
  source: 'crime-heat-source',
  paint: {
    'heatmap-weight': ['get', 'heat_weight'],
    'heatmap-intensity': 1.5,
    'heatmap-radius': 30,
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0.0, 'rgba(14,165,233,0)',      // Blue (low)
      0.5, 'rgba(250,204,21,0.5)',    // Yellow (medium)
      1.0, 'rgba(239,68,68,1)'        // Red (high)
    ]
  }
})
```

#### 4. Update Data Dynamically

```javascript
// Fetch new data from backend
const reports = await fetchReports()

// Convert to GeoJSON
const geoJson = toHeatGeoJson(reports)

// Update map source
map.getSource('crime-heat-source').setData(geoJson)
```

---

## Data Flow

### Complete Request-Response Cycle

```
┌──────────────┐
│   Browser    │
│  (Frontend)  │
└──────┬───────┘
       │
       │ 1. User opens /heatmap
       │
       ▼
┌──────────────────────────────────┐
│  Next.js Server                  │
│  - Renders page shell            │
│  - Sends HTML to browser         │
└──────────────────────────────────┘
       │
       │ 2. Browser loads JavaScript
       │
       ▼
┌──────────────────────────────────┐
│  React Component (map.jsx)       │
│  - useEffect runs on mount       │
│  - Calls fetchHeatmap()          │
└──────┬───────────────────────────┘
       │
       │ 3. API Request
       │ GET /api/reports/heatmap
       │
       ▼
┌──────────────────────────────────┐
│  Flask Backend                   │
│  - Query database                │
│  - Calculate intensities         │
│  - Return JSON                   │
└──────┬───────────────────────────┘
       │
       │ 4. JSON Response
       │ { areas: [...], max_count: 10 }
       │
       ▼
┌──────────────────────────────────┐
│  React Component                 │
│  - Convert to GeoJSON            │
│  - Update map source             │
└──────┬───────────────────────────┘
       │
       │ 5. Map Tiles Request
       │ GET https://api.maptiler.com/...
       │
       ▼
┌──────────────────────────────────┐
│  MapTiler CDN                    │
│  - Return map tiles (PNG)        │
└──────┬───────────────────────────┘
       │
       │ 6. Render
       │
       ▼
┌──────────────────────────────────┐
│  Browser Display                 │
│  - Base map (MapTiler)           │
│  - Heatmap overlay (custom)      │
│  - Crime points (custom)         │
└──────────────────────────────────┘
```

---

## Features Breakdown

### 1. Heatmap Visualization

**What it does:**
- Shows crime density as colored overlay
- Red = high crime, Yellow = medium, Blue = low

**How it works:**
```javascript
// Backend calculates intensity per area
intensity = crime_count / max_crime_count

// Frontend boosts intensity for visibility
boosted = Math.pow(intensity, 0.55)

// MapTiler renders heatmap
heatmap-weight = boosted * 2.4
heatmap-radius = 30px (adjusts with zoom)
heatmap-color = gradient (blue → yellow → red)
```

**Data format:**
```json
{
  "max_count": 15,
  "areas": [
    {
      "area_key": "sector-17",
      "location_lat": 30.7333,
      "location_lng": 76.7794,
      "count": 12,
      "intensity": 0.8,
      "area_level": "high"
    }
  ]
}
```

### 2. Point Visualization

**What it does:**
- Shows individual crime reports as circles
- Size and color indicate severity

**How it works:**
```javascript
// Each report becomes a circle
circle-radius = severity * 2 (6-15px)
circle-color = based on intensity
  - 0.2: Light blue
  - 0.5: Blue
  - 0.7: Yellow
  - 0.9: Orange
  - 1.0: Red
```

### 3. Trend Timeline

**What it does:**
- Shows how crime patterns change over time
- Animates through daily/cumulative data

**How it works:**
```javascript
// Backend generates frames (one per day)
frames = [
  { date: '2024-03-01', areas: [...], total_reports: 5 },
  { date: '2024-03-02', areas: [...], total_reports: 8 },
  ...
]

// Frontend plays frames like a video
setInterval(() => {
  frameIndex = (frameIndex + 1) % frames.length
  updateMapData(frames[frameIndex])
}, 2600) // 2.6 seconds per frame
```

**Modes:**
- **Cumulative**: Shows all crimes up to that date
- **Daily**: Shows only crimes on that specific day

### 4. Hotspot Detection

**What it does:**
- Identifies top 5 high-crime areas
- Allows clicking to focus on area

**How it works:**
```javascript
// Sort areas by intensity
hotspots = areas
  .sort((a, b) => b.intensity - a.intensity)
  .slice(0, 5)

// Click handler
focusHotspot(spot) {
  map.easeTo({
    center: [spot.lng, spot.lat],
    zoom: 12,
    duration: 900ms
  })
}
```

### 5. Layer Switching

**What it does:**
- Toggle between heatmap and point views

**How it works:**
```javascript
// Show/hide layers
map.setLayoutProperty(
  'crime-heat-layer',
  'visibility',
  selectedLayer === 'heatmap' ? 'visible' : 'none'
)
```

### 6. Adaptive Styling

**What it does:**
- Adjusts heatmap intensity based on data density
- Sparse data = more visible, Dense data = normal

**How it works:**
```javascript
const sparseMode = maxCount <= 2 || areas.length <= 2

if (sparseMode) {
  heatmap-intensity = 0.55  // Lower
  heatmap-radius = 28px     // Smaller
  heatmap-opacity = 0.72    // More transparent
} else {
  heatmap-intensity = 1.15  // Higher
  heatmap-radius = 38px     // Larger
  heatmap-opacity = 0.9     // More opaque
}
```

---

## Frontend Responsibilities

### 1. Data Fetching
```javascript
// Fetch from backend API
const heatmap = await fetchHeatmap()
const reports = await fetchReports()
const trend = await fetchHeatmapTrend({ days: 14 })
```

### 2. Data Transformation
```javascript
// Convert backend data to GeoJSON
function toGeoJson(reports) {
  return {
    type: 'FeatureCollection',
    features: reports.map(r => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.lng, r.lat]
      },
      properties: {
        count: r.count,
        intensity: r.intensity
      }
    }))
  }
}
```

### 3. Map Rendering
```javascript
// Initialize MapTiler
// Add data sources
// Add visualization layers
// Handle user interactions
```

### 4. State Management
```javascript
// React state hooks
const [mapLoaded, setMapLoaded] = useState(false)
const [heatmapData, setHeatmapData] = useState([])
const [selectedLayer, setSelectedLayer] = useState('heatmap')
const [trendEnabled, setTrendEnabled] = useState(false)
```

### 5. User Interactions
```javascript
// Button clicks
<Button onClick={() => setSelectedLayer('point')}>
  Show Points
</Button>

// Map clicks
map.on('click', 'crime-point-layer', (e) => {
  showPopup(e.features[0].properties)
})

// Zoom/pan
map.easeTo({ center: [lng, lat], zoom: 12 })
```

### 6. Real-time Updates (Future)
```javascript
// Socket.IO connection
const socket = io(API_URL)

socket.on('new_report', (report) => {
  // Add to map immediately
  addReportToMap(report)
})
```

---

## Performance Optimizations

### 1. Lazy Loading
```javascript
// Load MapTiler SDK only when needed
const maptilersdk = await import('@maptiler/sdk')
```

### 2. Memoization
```javascript
// Cache expensive calculations
const hotspots = useMemo(() => {
  return sortHotspots(areas)
}, [areas])
```

### 3. Debouncing
```javascript
// Limit update frequency
const debouncedUpdate = debounce(updateMap, 300)
```

### 4. Tile Caching
- MapTiler automatically caches tiles in browser
- Reduces repeated requests

### 5. GeoJSON Optimization
```javascript
// Round coordinates to 4 decimals
lng: Number(lng.toFixed(4))
// Reduces JSON size by ~30%
```

---

## Common Issues & Solutions

### Issue 1: Map Not Loading
**Cause**: Invalid API key
**Solution**: Check `NEXT_PUBLIC_MAPTILER_API_KEY` in env

### Issue 2: Heatmap Too Faint
**Cause**: Low intensity values
**Solution**: Boost intensity with power function
```javascript
boosted = Math.pow(intensity, 0.55)
```

### Issue 3: Points Not Showing
**Cause**: Layer visibility set to 'none'
**Solution**: Toggle layer visibility
```javascript
map.setLayoutProperty(layer, 'visibility', 'visible')
```

### Issue 4: Slow Performance
**Cause**: Too many points
**Solution**: Cluster points or use heatmap

---

## Summary

### MapTiler's Role
1. Provides base map tiles (streets, satellite)
2. Handles tile loading and caching
3. Provides geocoding services
4. Offers map styling options

### Frontend's Role
1. Fetches crime data from backend
2. Transforms data to GeoJSON format
3. Adds custom visualization layers
4. Handles user interactions
5. Manages state and updates
6. Provides UI controls

### Data Flow
```
Backend → Frontend → MapTiler → Browser
(Crime data) (GeoJSON) (Map tiles) (Display)
```

### Key Technologies
- **MapTiler SDK**: Map rendering engine
- **React**: UI framework
- **GeoJSON**: Geographic data format
- **WebGL**: Hardware-accelerated rendering
- **REST API**: Data communication

---

**Last Updated**: March 2026
