'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import './map.css'
import { Button } from '@/components/ui/button'
import { fetchHeatmap, fetchHeatmapTrend, fetchReports } from '@/lib/api'

const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || 'h9EeWZpT7PxeWTwMGIo0'
const HEAT_SOURCE_ID = 'crime-heat-source'
const POINT_SOURCE_ID = 'crime-points-source'
const HEAT_LAYER_ID = 'crime-heat-layer'
const POINT_LAYER_ID = 'crime-point-layer'
const LABEL_LAYER_ID = 'crime-label-layer'

function boostIntensity(value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0))
  return Number(Math.pow(normalized, 0.55).toFixed(4))
}

function toPointGeoJson(areas) {
  return {
    type: 'FeatureCollection',
    features: areas.map((area) => ({
      type: 'Feature',
      properties: {
        count: Number(area.count || 0),
        intensity: Number(area.intensity || 0),
        boosted_intensity: boostIntensity(area.intensity),
        area_level: area.area_level || 'low',
        area_name: area.area_name || area.area_key || 'Unknown Area',
        severity: Math.max(2, Math.round(boostIntensity(area.intensity) * 14)),
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(area.location_lng), Number(area.location_lat)],
      },
    })),
  }
}

function toReportPointGeoJson(reports) {
  return {
    type: 'FeatureCollection',
    features: (reports || [])
      .map((report) => {
        const lat = Number(report.location_lat)
        const lng = Number(report.location_lng)
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null
        const level = (report.crime_level || 'low').toLowerCase()
        const severity = level === 'high' ? 14 : level === 'medium' ? 9 : 5
        return {
          type: 'Feature',
          properties: {
            count: 1,
            intensity: 0.6,
            boosted_intensity: 0.7,
            area_level: level,
            area_name: report.area_name || report.area_key || 'Unknown Area',
            severity,
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        }
      })
      .filter(Boolean),
  }
}

function crimeWeight(level) {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  return 1
}

function toHeatGeoJsonFromReports(reports) {
  if (!Array.isArray(reports) || reports.length === 0) {
    return { type: 'FeatureCollection', features: [] }
  }

  return {
    type: 'FeatureCollection',
    features: reports
      .map((report) => {
        const lat = Number(report.location_lat)
        const lng = Number(report.location_lng)
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null
        const areaCount = Math.max(1, Number(report.area_count || 1))
        const countFactor = Math.log1p(areaCount) / Math.log1p(25)
        const severityFactor = crimeWeight(report.crime_level) / 3
        const weighted = 0.18 + countFactor * 1.35 + severityFactor * 0.22
        return {
          type: 'Feature',
          properties: {
            heat_weight: Number(weighted.toFixed(3)),
          },
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        }
      })
      .filter(Boolean),
  }
}

function toHeatGeoJsonFromAreas(areas) {
  return {
    type: 'FeatureCollection',
    features: (areas || []).map((area) => ({
      type: 'Feature',
      properties: {
        heat_weight: Number((0.5 + boostIntensity(area.intensity) * 2.4).toFixed(3)),
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(area.location_lng), Number(area.location_lat)],
      },
    })),
  }
}

function getAdaptiveHeatStyle({ sparseMode }) {
  if (sparseMode) {
    return {
      intensity: ['interpolate', ['linear'], ['zoom'], 4, 0.32, 8, 0.55, 11, 0.82, 14, 1.0],
      radius: ['interpolate', ['linear'], ['zoom'], 4, 16, 8, 28, 11, 40, 14, 56],
      opacity: 0.72,
      color: [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0.0, 'rgba(14,165,233,0)',
        0.28, 'rgba(56,189,248,0.20)',
        0.56, 'rgba(45,212,191,0.32)',
        0.78, 'rgba(250,204,21,0.42)',
        1.0, 'rgba(244,63,94,0.52)',
      ],
    }
  }

  return {
    intensity: ['interpolate', ['linear'], ['zoom'], 4, 0.7, 8, 1.15, 11, 1.6, 14, 2.0],
    radius: ['interpolate', ['linear'], ['zoom'], 4, 14, 8, 24, 11, 38, 14, 56],
    opacity: 0.9,
    color: [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0.0, 'rgba(14,165,233,0)',
      0.16, 'rgba(56,189,248,0.22)',
      0.34, 'rgba(45,212,191,0.38)',
      0.52, 'rgba(250,204,21,0.58)',
      0.72, 'rgba(244,63,94,0.78)',
      1.0, 'rgba(239,68,68,1)',
    ],
  }
}

function sortHotspots(areas = []) {
  return [...areas]
    .sort((a, b) => (b.intensity || 0) - (a.intensity || 0) || (b.score || 0) - (a.score || 0))
    .slice(0, 6)
}

export default function Map() {
  const mapContainer = useRef(null)
  const map = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [error, setError] = useState('')

  const [heatmapData, setHeatmapData] = useState({ max_count: 0, areas: [] })
  const [reportsData, setReportsData] = useState([])
  const [trendData, setTrendData] = useState({ frames: [], days: 14, mode: 'cumulative' })

  const [selectedLayer, setSelectedLayer] = useState('heatmap')
  const [trendEnabled, setTrendEnabled] = useState(false)
  const [trendPlaying, setTrendPlaying] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const [trendDays, setTrendDays] = useState(14)
  const [trendMode, setTrendMode] = useState('cumulative')

  const activeFrame = trendEnabled && trendData.frames.length ? trendData.frames[Math.min(frameIndex, trendData.frames.length - 1)] : null
  const renderedData = activeFrame
    ? { max_count: activeFrame.max_count, max_score: activeFrame.max_score, areas: activeFrame.areas }
    : heatmapData

  const hotspotCards = useMemo(() => {
    if (activeFrame?.hotspots?.length) return activeFrame.hotspots
    return sortHotspots(renderedData.areas)
  }, [activeFrame, renderedData.areas])

  const center = useMemo(() => {
    if (!renderedData.areas.length) return { lng: 76.7794, lat: 30.7333 }
    const avgLat = renderedData.areas.reduce((sum, area) => sum + area.location_lat, 0) / renderedData.areas.length
    const avgLng = renderedData.areas.reduce((sum, area) => sum + area.location_lng, 0) / renderedData.areas.length
    return { lng: avgLng, lat: avgLat }
  }, [renderedData.areas])

  useEffect(() => {
    const loadBaseHeatmap = async () => {
      try {
        const [heatmap, reports] = await Promise.all([fetchHeatmap(), fetchReports()])
        setHeatmapData(heatmap)
        setReportsData(reports)
      } catch (e) {
        setError(e.message || 'Failed to load heatmap data')
      }
    }
    loadBaseHeatmap()
  }, [])

  useEffect(() => {
    if (!trendEnabled) return
    const loadTrend = async () => {
      try {
        const payload = await fetchHeatmapTrend({ days: trendDays, mode: trendMode })
        setTrendData(payload)
        setFrameIndex(0)
        setTrendPlaying((payload.frames || []).length > 1)
      } catch (e) {
        setError(e.message || 'Failed to load heatmap trend data')
        setTrendPlaying(false)
      }
    }
    loadTrend()
  }, [trendEnabled, trendDays, trendMode])

  useEffect(() => {
    if (!trendEnabled || !trendPlaying || trendData.frames.length < 2) return
    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % trendData.frames.length)
    }, 2600)
    return () => clearInterval(timer)
  }, [trendEnabled, trendPlaying, trendData.frames.length])

  useEffect(() => {
    const init = async () => {
      if (map.current || error) return
      try {
        const maptilersdk = await import('@maptiler/sdk')
        await import('@maptiler/sdk/dist/maptiler-sdk.css')

        maptilersdk.config.apiKey = MAPTILER_API_KEY
        map.current = new maptilersdk.Map({
          container: mapContainer.current,
          style: maptilersdk.MapStyle.STREETS,
          center: [center.lng, center.lat],
          zoom: renderedData.areas.length ? 11 : 9,
        })

        map.current.on('load', () => setMapLoaded(true))
      } catch (e) {
        setError(e.message || 'Failed to initialize map')
      }
    }

    init()
  }, [center, error, renderedData.areas.length])

  useEffect(() => {
    if (!mapLoaded || !map.current) return

    const mapInstance = map.current
    const maxCount = Number(renderedData.max_count || 0)
    const sparseMode = maxCount <= 2 || (renderedData.areas || []).length <= 2
    const heatStyle = getAdaptiveHeatStyle({ sparseMode })
    const pointGeoJson = trendEnabled ? toPointGeoJson(renderedData.areas) : toReportPointGeoJson(reportsData)
    const heatGeoJson = trendEnabled
      ? toHeatGeoJsonFromAreas(renderedData.areas)
      : toHeatGeoJsonFromReports(reportsData)

    if (mapInstance.getSource(HEAT_SOURCE_ID) && mapInstance.getSource(POINT_SOURCE_ID)) {
      mapInstance.getSource(HEAT_SOURCE_ID).setData(heatGeoJson)
      mapInstance.getSource(POINT_SOURCE_ID).setData(pointGeoJson)
      if (mapInstance.getLayer(HEAT_LAYER_ID)) {
        mapInstance.setPaintProperty(HEAT_LAYER_ID, 'heatmap-intensity', heatStyle.intensity)
        mapInstance.setPaintProperty(HEAT_LAYER_ID, 'heatmap-radius', heatStyle.radius)
        mapInstance.setPaintProperty(HEAT_LAYER_ID, 'heatmap-opacity', heatStyle.opacity)
        mapInstance.setPaintProperty(HEAT_LAYER_ID, 'heatmap-color', heatStyle.color)
      }
      return
    }

    mapInstance.addSource(HEAT_SOURCE_ID, {
      type: 'geojson',
      data: heatGeoJson,
    })
    mapInstance.addSource(POINT_SOURCE_ID, {
      type: 'geojson',
      data: pointGeoJson,
    })

    mapInstance.addLayer({
      id: HEAT_LAYER_ID,
      type: 'heatmap',
      source: HEAT_SOURCE_ID,
      maxzoom: 17,
      paint: {
        'heatmap-weight': ['get', 'heat_weight'],
        'heatmap-intensity': heatStyle.intensity,
        'heatmap-radius': heatStyle.radius,
        'heatmap-opacity': heatStyle.opacity,
        'heatmap-color': heatStyle.color,
      },
    })

    mapInstance.addLayer({
      id: POINT_LAYER_ID,
      type: 'circle',
      source: POINT_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'severity'], 2, 6, 14, 15],
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'boosted_intensity'],
          0.2, '#4cc9f0',
          0.45, '#3a86ff',
          0.65, '#ffbe0b',
          0.85, '#fb5607',
          1.0, '#e63946',
        ],
        'circle-opacity': 0.78,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      },
    })

    mapInstance.addLayer({
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: POINT_SOURCE_ID,
      layout: {
        'text-field': ['to-string', ['get', 'count']],
        'text-size': 11,
        'text-offset': [0, 1.2],
      },
      paint: {
        'text-color': '#0f172a',
      },
    })
  }, [mapLoaded, renderedData, trendEnabled, reportsData])

  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const mapInstance = map.current

    if (mapInstance.getLayer(HEAT_LAYER_ID)) {
      mapInstance.setLayoutProperty(HEAT_LAYER_ID, 'visibility', selectedLayer === 'heatmap' ? 'visible' : 'none')
    }
    if (mapInstance.getLayer(POINT_LAYER_ID)) {
      mapInstance.setLayoutProperty(POINT_LAYER_ID, 'visibility', selectedLayer === 'point' ? 'visible' : 'none')
    }
    if (mapInstance.getLayer(LABEL_LAYER_ID)) {
      mapInstance.setLayoutProperty(LABEL_LAYER_ID, 'visibility', selectedLayer === 'point' ? 'visible' : 'none')
    }
  }, [mapLoaded, selectedLayer])

  const focusHotspot = (spot) => {
    if (!map.current || !spot) return
    map.current.easeTo({
      center: [spot.location_lng, spot.location_lat],
      duration: 900,
      zoom: Math.max(map.current.getZoom(), 11.2),
      essential: true,
    })
  }

  return (
    <div className="relative h-[78vh] w-full overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div ref={mapContainer} className="h-full w-full" />

      {!mapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <p className="text-sm text-slate-600">Loading map...</p>
        </div>
      )}

      {error && (
        <div className="absolute left-4 top-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow">
        <Button variant="outline" size="sm" onClick={() => setSelectedLayer((v) => (v === 'heatmap' ? 'point' : 'heatmap'))}>
          Show {selectedLayer === 'heatmap' ? 'Points' : 'Heatmap'}
        </Button>

        <Button
          variant={trendEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setTrendEnabled((v) => {
              const next = !v
              if (!next) {
                setTrendPlaying(false)
                setFrameIndex(0)
              }
              return next
            })
          }}
        >
          Trend {trendEnabled ? 'On' : 'Off'}
        </Button>

        <Button variant="outline" size="sm" disabled={!trendEnabled || trendData.frames.length < 2} onClick={() => setTrendPlaying((v) => !v)}>
          {trendPlaying ? 'Pause' : 'Play'}
        </Button>

        <select className="h-8 rounded-md border border-slate-300 px-2 text-xs" value={trendMode} onChange={(e) => setTrendMode(e.target.value)}>
          <option value="cumulative">Cumulative</option>
          <option value="daily">Daily</option>
        </select>

        <select className="h-8 rounded-md border border-slate-300 px-2 text-xs" value={trendDays} onChange={(e) => setTrendDays(Number(e.target.value))}>
          <option value={14}>14 days</option>
          <option value={21}>21 days</option>
          <option value={30}>30 days</option>
          <option value={45}>45 days</option>
        </select>
      </div>

      {trendEnabled && trendData.frames.length > 0 && (
        <div className="absolute left-4 right-4 top-20 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
            <span>Frame {frameIndex + 1}/{trendData.frames.length}</span>
            <span>{activeFrame?.date} | Reports: {activeFrame?.total_reports ?? 0}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, trendData.frames.length - 1)}
            value={Math.min(frameIndex, Math.max(0, trendData.frames.length - 1))}
            onChange={(e) => {
              setTrendPlaying(false)
              setFrameIndex(Number(e.target.value))
            }}
            className="w-full"
          />
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-20 w-80 max-w-[calc(100%-2rem)] rounded-lg bg-white p-4 shadow-lg">
        <h3 className="mb-2 text-sm font-semibold">Hotspot Trend Panel</h3>
        <p className="text-xs text-slate-600">Multiple hotspots shown. Click any hotspot to focus.</p>
        <div className="mt-2 space-y-2">
          {hotspotCards.slice(0, 5).map((spot, idx) => (
            <button
              key={`${spot.location_lat}-${spot.location_lng}-${idx}`}
              onClick={() => focusHotspot(spot)}
              className="w-full rounded-md border border-slate-200 px-2 py-2 text-left text-xs hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">#{idx + 1} {spot.area_level?.toUpperCase()}</span>
                <span>{Math.round((spot.intensity || 0) * 100)}%</span>
              </div>
              <div className="mt-1 text-slate-600">
                {spot.area_name || spot.area_key || 'Unknown Area'} | count {spot.count}
              </div>
            </button>
          ))}
          {hotspotCards.length === 0 && <p className="text-xs text-slate-500">No hotspots available.</p>}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-20 w-72 rounded-lg bg-white p-4 shadow-lg">
        <h3 className="mb-2 text-sm font-semibold">Heatmap Summary</h3>
        <p className="text-xs text-slate-600">Areas: {renderedData.areas.length}</p>
        <p className="text-xs text-slate-600">Max reports in one area: {renderedData.max_count || 0}</p>
        <p className="text-xs text-slate-600">Trend mode: {trendEnabled ? trendMode : 'off'}</p>
      </div>
    </div>
  )
}


