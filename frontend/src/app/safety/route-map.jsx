'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

const MAPTILER_API_KEY = process.env.NEXT_PUBLIC_MAPTILER_API_KEY || 'h9EeWZpT7PxeWTwMGIo0'
const ROUTE_SOURCE_ID = 'route-safety-source'
const POINT_SOURCE_ID = 'route-safety-point-source'
const HOTSPOT_SOURCE_ID = 'route-safety-hotspot-source'

function buildRouteGeoJson(payload, activeRouteId) {
  const routes = payload?.routes || []
  return {
    type: 'FeatureCollection',
    features: routes
      .filter((route) => Array.isArray(route.polyline) && route.polyline.length > 1)
      .map((route) => ({
        type: 'Feature',
        properties: {
          route_id: route.id,
          label: route.label,
          recommended: route.id === payload.recommended_route_id ? 1 : 0,
          selected: route.id === activeRouteId ? 1 : 0,
        },
        geometry: {
          type: 'LineString',
          coordinates: route.polyline.map((point) => [Number(point.lng), Number(point.lat)]),
        },
      })),
  }
}

function buildPointGeoJson(payload) {
  if (!payload?.origin || !payload?.destination) {
    return { type: 'FeatureCollection', features: [] }
  }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { type: 'origin', label: payload.origin.resolved || payload.origin.query || 'Origin' },
        geometry: { type: 'Point', coordinates: [Number(payload.origin.lng), Number(payload.origin.lat)] },
      },
      {
        type: 'Feature',
        properties: { type: 'destination', label: payload.destination.resolved || payload.destination.query || 'Destination' },
        geometry: { type: 'Point', coordinates: [Number(payload.destination.lng), Number(payload.destination.lat)] },
      },
    ],
  }
}

function buildHotspotGeoJson(payload) {
  const routes = payload?.routes || []
  const dedup = new Map()
  routes.forEach((route) => {
    ;(route.hotspots_nearby || []).forEach((spot) => {
      const key = spot.area_key || spot.area_name
      if (!key) return
      const existing = dedup.get(key)
      if (!existing || Number(spot.distance_km || 999) < Number(existing.distance_km || 999)) {
        dedup.set(key, spot)
      }
    })
  })
  const features = Array.from(dedup.values())
    .filter((spot) => spot && typeof spot === 'object' && spot.area_name)
    .map((spot) => ({
      type: 'Feature',
      properties: {
        area_name: spot.area_name || spot.area_key || 'Hotspot',
        risk_band: spot.risk_band || 'low',
        distance_km: Number(spot.distance_km || 0),
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(spot.location_lng || 0), Number(spot.location_lat || 0)],
      },
    }))
    .filter((feature) => Number.isFinite(feature.geometry.coordinates[0]) && Number.isFinite(feature.geometry.coordinates[1]))

  return { type: 'FeatureCollection', features }
}

export default function RouteMap({ routePayload, activeRouteId, onSelectRoute }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapError, setMapError] = useState('')

  const routeGeoJson = useMemo(
    () => buildRouteGeoJson(routePayload, activeRouteId || routePayload?.recommended_route_id),
    [routePayload, activeRouteId]
  )
  const pointGeoJson = useMemo(() => buildPointGeoJson(routePayload), [routePayload])
  const hotspotGeoJson = useMemo(() => buildHotspotGeoJson(routePayload), [routePayload])

  useEffect(() => {
    const init = async () => {
      if (mapRef.current) return
      try {
        const maptilersdk = await import('@maptiler/sdk')
        await import('@maptiler/sdk/dist/maptiler-sdk.css')
        maptilersdk.config.apiKey = MAPTILER_API_KEY

        mapRef.current = new maptilersdk.Map({
          container: containerRef.current,
          style: maptilersdk.MapStyle.STREETS,
          center: [76.7794, 30.7333],
          zoom: 11,
        })

        mapRef.current.on('load', () => setMapLoaded(true))
      } catch (err) {
        setMapError(err.message || 'Failed to initialize route map')
      }
    }
    init()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return
    const map = mapRef.current

    const upsertSource = (id, data) => {
      if (map.getSource(id)) {
        map.getSource(id).setData(data)
      } else {
        map.addSource(id, { type: 'geojson', data })
      }
    }

    upsertSource(ROUTE_SOURCE_ID, routeGeoJson)
    upsertSource(POINT_SOURCE_ID, pointGeoJson)
    upsertSource(HOTSPOT_SOURCE_ID, hotspotGeoJson)

    if (!map.getLayer('route-alt-layer')) {
      map.addLayer({
        id: 'route-alt-layer',
        type: 'line',
        source: ROUTE_SOURCE_ID,
        filter: ['==', ['get', 'selected'], 0],
        paint: {
          'line-color': ['case', ['==', ['get', 'recommended'], 1], '#16a34a', '#64748b'],
          'line-width': 3,
          'line-opacity': 0.8,
          'line-dasharray': [1.6, 1.2],
        },
      })
      map.addLayer({
        id: 'route-selected-layer',
        type: 'line',
        source: ROUTE_SOURCE_ID,
        filter: ['==', ['get', 'selected'], 1],
        paint: {
          'line-color': '#dc2626',
          'line-width': 5,
          'line-opacity': 0.95,
        },
      })
      map.addLayer({
        id: 'route-point-layer',
        type: 'circle',
        source: POINT_SOURCE_ID,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'type'], 'origin'], 7, 8],
          'circle-color': ['case', ['==', ['get', 'type'], 'origin'], '#0f766e', '#7f1d1d'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'route-hotspot-layer',
        type: 'circle',
        source: HOTSPOT_SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'distance_km'], 0, 8, 3, 5, 8, 3],
          'circle-color': [
            'match',
            ['get', 'risk_band'],
            'critical', '#b91c1c',
            'high', '#ef4444',
            'medium', '#f59e0b',
            '#22c55e',
          ],
          'circle-opacity': 0.78,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      })
      map.addLayer({
        id: 'route-hotspot-label',
        type: 'symbol',
        source: HOTSPOT_SOURCE_ID,
        layout: {
          'text-field': ['get', 'area_name'],
          'text-size': 10,
          'text-offset': [0, 1.1],
        },
        paint: { 'text-color': '#0f172a' },
      })

      map.on('click', 'route-alt-layer', (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const routeId = feature.properties?.route_id
        if (routeId && onSelectRoute) onSelectRoute(routeId)
      })
      map.on('click', 'route-selected-layer', (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const routeId = feature.properties?.route_id
        if (routeId && onSelectRoute) onSelectRoute(routeId)
      })
    }

    const allCoords = []
    routeGeoJson.features.forEach((feature) => {
      feature.geometry.coordinates.forEach((coord) => allCoords.push(coord))
    })
    if (allCoords.length) {
      const lats = allCoords.map((c) => c[1])
      const lngs = allCoords.map((c) => c[0])
      const minLat = Math.min(...lats)
      const maxLat = Math.max(...lats)
      const minLng = Math.min(...lngs)
      const maxLng = Math.max(...lngs)
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 70, duration: 650, maxZoom: 14 }
      )
    }
  }, [mapLoaded, routeGeoJson, pointGeoJson, hotspotGeoJson, onSelectRoute])

  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl border border-slate-200">
      <div ref={containerRef} className="h-full w-full" />
      {(!mapLoaded && !mapError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 text-sm text-slate-600">
          Loading route map...
        </div>
      )}
      {mapError && (
        <div className="absolute left-3 top-3 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
          {mapError}
        </div>
      )}
    </div>
  )
}

