'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchReports, fetchRouteSafety } from '@/lib/api'
import { AlertTriangle, MapPin, ShieldCheck, Siren } from 'lucide-react'
import RouteMap from './route-map'

function bucketKey(report) {
  const areaName = (report.area_name || '').trim()
  if (areaName) return areaName
  return report.area_key || `${Number(report.location_lat).toFixed(2)},${Number(report.location_lng).toFixed(2)}`
}

export default function SafetyPage() {
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState('Sector 17, Chandigarh')
  const [destination, setDestination] = useState('ISBT Chandigarh')
  const [routePayload, setRoutePayload] = useState(null)
  const [activeRouteId, setActiveRouteId] = useState('')
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchReports()
        setReports(data)
      } catch (err) {
        setError(err.message || 'Failed to load safety index')
      }
    }
    load()
  }, [])

  const loadRouteSafety = async () => {
    if (!origin.trim() || !destination.trim()) return
    setRouteLoading(true)
    setRouteError('')
    try {
      const payload = await fetchRouteSafety({ origin, destination })
      setRoutePayload(payload)
      setActiveRouteId(payload.recommended_route_id || '')
    } catch (err) {
      setRoutePayload(null)
      setActiveRouteId('')
      setRouteError(err.message || 'Failed to compute safe route')
    } finally {
      setRouteLoading(false)
    }
  }

  useEffect(() => {
    loadRouteSafety()
  }, [])

  const areas = useMemo(() => {
    const grouped = {}

    reports.forEach((report) => {
      const key = bucketKey(report)
      if (!grouped[key]) {
        grouped[key] = {
          name: key,
          key,
          count: 0,
          high: 0,
          medium: 0,
          low: 0,
          lastSeen: report.created_at
        }
      }

      grouped[key].count += 1
      grouped[key].lastSeen = report.created_at
      if (report.crime_level === 'high') grouped[key].high += 1
      else if (report.crime_level === 'medium') grouped[key].medium += 1
      else grouped[key].low += 1
    })

    return Object.values(grouped)
      .map((zone) => {
        const riskRaw = zone.high * 3 + zone.medium * 2 + zone.low
        const score = Math.max(5, 100 - riskRaw * 8)
        const status = score >= 80 ? 'Safe' : score >= 60 ? 'Watchlist' : 'High Risk'
        return { ...zone, score, status }
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
  }, [reports])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-cyan-700 p-6 text-white">
          <h1 className="text-2xl font-bold">Safety Index</h1>
          <p className="mt-1 text-sm text-emerald-50">Dynamic zone scoring based on live backend reports.</p>
        </div>

        <Card id="route-safety">
          <CardHeader>
            <CardTitle className="text-base">Route Safety Mode (A to B)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Start area" />
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination area" />
            </div>
            <Button type="button" onClick={loadRouteSafety} disabled={routeLoading}>
              {routeLoading ? 'Calculating...' : 'Find Safest Route'}
            </Button>
            {routeError && <p className="text-sm text-red-600">{routeError}</p>}
            {routePayload && (
              <div className="space-y-2">
                <p className={`text-xs ${routePayload.routing_mode === 'road' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {routePayload.routing_mode === 'road'
                    ? 'Road-based routing active (driving network).'
                    : 'Routing fallback active (approximate lines) due provider/network issue.'}
                </p>
                <RouteMap
                  routePayload={routePayload}
                  activeRouteId={activeRouteId || routePayload.recommended_route_id}
                  onSelectRoute={(routeId) => setActiveRouteId(routeId)}
                />
                {routePayload.routes.map((route) => (
                  <div
                    key={route.id}
                    className={`rounded-lg border p-3 ${
                      route.id === (activeRouteId || routePayload.recommended_route_id)
                        ? 'border-red-300 bg-red-50'
                        : route.id === routePayload.recommended_route_id
                          ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveRouteId(route.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setActiveRouteId(route.id)
                      }
                    }}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {route.label}
                      {route.id === routePayload.recommended_route_id && ' (Recommended)'}
                      {route.id === activeRouteId && route.id !== routePayload.recommended_route_id && ' (Selected)'}
                    </p>
                    <p className="text-xs text-slate-600">
                      Safety score {route.safety_score} | Distance {route.distance_km} km
                      {route.duration_min ? ` | ~${route.duration_min} min` : ''}
                      {' | '}Exposure {route.risk_exposure}
                    </p>
                    {route.hotspots_nearby?.length > 0 && (
                      <p className="mt-1 text-xs text-rose-700">
                        Nearby hotspots: {route.hotspots_nearby.slice(0, 2).map((row) => row.area_name || row.area_key).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {areas.length === 0 && !error && (
          <Card><CardContent className="p-4 text-sm text-slate-600">No report data yet. Submit incidents to generate safety index.</CardContent></Card>
        )}

        <div className="grid gap-4">
          {areas.map((area) => (
            <Card key={area.key}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    {area.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{area.score}</span>
                    <Badge variant={area.score >= 80 ? 'default' : area.score >= 60 ? 'secondary' : 'destructive'}>
                      {area.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-3 h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${area.score >= 80 ? 'bg-emerald-600' : area.score >= 60 ? 'bg-rose-500' : 'bg-rose-600'}`}
                    style={{ width: `${area.score}%` }}
                  />
                </div>

                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  <p>Total incidents: <span className="font-semibold text-slate-800">{area.count}</span></p>
                  <p>High: <span className="font-semibold text-rose-600">{area.high}</span></p>
                  <p>Medium: <span className="font-semibold text-rose-600">{area.medium}</span></p>
                  <p>Low: <span className="font-semibold text-emerald-600">{area.low}</span></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="flex flex-wrap gap-4 p-4 text-sm text-slate-700">
            <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Safe: score 80+</p>
            <p className="inline-flex items-center gap-2"><Siren className="h-4 w-4 text-rose-500" /> Watchlist: score 60-79</p>
            <p className="inline-flex items-center gap-2"><Siren className="h-4 w-4 text-rose-600" /> High Risk: score below 60</p>
            <p className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> Route mode avoids nearby danger clusters.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


