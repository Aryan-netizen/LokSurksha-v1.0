'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fetchAnalytics } from '@/lib/api'
import { ChartNoAxesCombined, Flame, Radar, Search, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react'

const EMPTY_PAYLOAD = {
  summary: {
    total_reports: 0,
    level_counts: { low: 0, medium: 0, high: 0 },
    avg_daily_reports: 0,
    weighted_avg_daily: 0,
    spike_days_last_7d: 0,
    model_confidence: 0,
  },
  timeline: [],
  hotspots: [],
  search: { query: '', matched_count: 0, results: [], supports: '' },
  model: { name: '', version: '', components: [], weights: {} },
  forecast: { lookback_days: 30, next_7d_total: 0, next_30d_total: 0, risky_areas: [] },
  danger_now: { status: 'normal', current_2h_reports: 0, baseline_2h_reports: 0, pressure_index: 0, surge_areas: [], message: '' },
  recommendations: [],
}

function riskBadgeClass(risk) {
  if (risk === 'critical') return 'bg-rose-100 text-rose-800 border-rose-200'
  if (risk === 'high') return 'bg-rose-100 text-rose-800 border-rose-200'
  if (risk === 'medium') return 'bg-rose-100 text-rose-800 border-rose-200'
  return 'bg-emerald-100 text-emerald-800 border-emerald-200'
}

export default function AnalyticsPage() {
  const [payload, setPayload] = useState(EMPTY_PAYLOAD)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState('30')
  const [areaQuery, setAreaQuery] = useState('')

  const loadAnalytics = async (opts = {}) => {
    try {
      setLoading(true)
      setError('')
      const data = await fetchAnalytics(opts)
      setPayload(data)
    } catch (err) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics({ days: Number(days) })
  }, [])

  const recentTimeline = useMemo(() => {
    return payload.timeline.slice(-10)
  }, [payload.timeline])

  const maxTimelineCount = useMemo(() => {
    return Math.max(1, ...recentTimeline.map((item) => item.count))
  }, [recentTimeline])

  const topHotspot = payload.hotspots[0]

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Advanced Crime Analytics</h1>
          <p className="mt-1 text-sm text-slate-200">Hybrid model: severity weighting + EWMA trend + anomaly detection + recency scoring.</p>
        </div>

        <Card className="surface-card">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr,140px,auto]">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search area name or high/critical"
                value={areaQuery}
                onChange={(e) => setAreaQuery(e.target.value)}
              />
            </div>
            <Input
              type="number"
              min={7}
              max={180}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="text-center"
            />
            <Button onClick={() => loadAnalytics({ area: areaQuery, days: Number(days) })} disabled={loading}>
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="surface-card surface-card-hover"><CardContent className="p-4"><p className="text-xs text-slate-500">Total Reports</p><p className="text-2xl font-semibold">{payload.summary.total_reports}</p></CardContent></Card>
          <Card className="surface-card surface-card-hover"><CardContent className="p-4"><p className="text-xs text-slate-500">Low</p><p className="text-2xl font-semibold text-emerald-600">{payload.summary.level_counts.low}</p></CardContent></Card>
          <Card className="surface-card surface-card-hover"><CardContent className="p-4"><p className="text-xs text-slate-500">Medium</p><p className="text-2xl font-semibold text-rose-600">{payload.summary.level_counts.medium}</p></CardContent></Card>
          <Card className="surface-card surface-card-hover"><CardContent className="p-4"><p className="text-xs text-slate-500">High</p><p className="text-2xl font-semibold text-rose-600">{payload.summary.level_counts.high}</p></CardContent></Card>
          <Card className="surface-card surface-card-hover"><CardContent className="p-4"><p className="text-xs text-slate-500">Model Confidence</p><p className="text-2xl font-semibold text-indigo-700">{Math.round((payload.summary.model_confidence || 0) * 100)}%</p></CardContent></Card>
        </div>

        <Card className="surface-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Live Danger (Next 2h)</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{payload.danger_now?.status?.toUpperCase() || 'NORMAL'}</p>
                <p className="text-xs text-slate-600">{payload.danger_now?.message || 'No short-term signal yet.'}</p>
              </div>
              <div className="text-right text-xs text-slate-600">
                <p>Current 2h reports: <span className="font-semibold">{payload.danger_now?.current_2h_reports || 0}</span></p>
                <p>Baseline 2h: <span className="font-semibold">{payload.danger_now?.baseline_2h_reports || 0}</span></p>
                <p>Pressure index: <span className="font-semibold">{payload.danger_now?.pressure_index || 0}</span></p>
              </div>
            </div>
            {(payload.danger_now?.surge_areas || []).length > 0 && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {(payload.danger_now.surge_areas || []).slice(0, 4).map((row) => (
                  <div key={`surge-${row.area_key}`} className="rounded border bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <p className="font-medium">{row.area_name || row.area_key}</p>
                    <p>{row.reports_last_2h} reports in 2h | {row.risk_band} risk</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ChartNoAxesCombined className="h-4 w-4" /> Temporal Signal (EWMA + Spike Detection)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentTimeline.length === 0 && <p className="text-sm text-slate-500">No timeline data yet.</p>}
              {recentTimeline.map((point) => (
                <div key={point.date}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{point.date}</span>
                    <span>{point.count} reports | z={point.z_score}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(point.count / maxTimelineCount) * 100}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-600">Spike days (last 7): {payload.summary.spike_days_last_7d}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Radar className="h-4 w-4" /> Model Blueprint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">{payload.model.name}</span> ({payload.model.version})</p>
              <div className="flex flex-wrap gap-2">
                {(payload.model.components || []).map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
              </div>
              <div className="space-y-2">
                {Object.entries(payload.model.weights || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                    <span className="capitalize">{key}</span>
                    <span>{Math.round(Number(value) * 100)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Hotspot Forecast (Next 7/30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-600">Predicted next 7d</p>
                  <p className="text-lg font-semibold text-rose-700">{payload.forecast?.next_7d_total || 0}</p>
                </div>
                <div className="rounded border bg-slate-50 p-2">
                  <p className="text-slate-600">Predicted next 30d</p>
                  <p className="text-lg font-semibold text-rose-700">{payload.forecast?.next_30d_total || 0}</p>
                </div>
              </div>
              {(payload.forecast?.risky_areas || []).length === 0 && <p className="text-sm text-slate-500">No forecast signals yet.</p>}
              {(payload.forecast?.risky_areas || []).map((row) => (
                <div key={`forecast-${row.area_key}`} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-slate-900">{row.area_name || row.area_key}</p>
                    <Badge className={riskBadgeClass(row.risk_band)}>{row.risk_band}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    7d {row.predicted_next_7d} | 30d {row.predicted_next_30d} | trend {row.trend_direction} | conf {Math.round((row.confidence || 0) * 100)}%
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Flame className="h-4 w-4" /> Hotspot Ranking</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(payload.hotspots || []).slice(0, 6).map((spot) => (
                <div key={spot.area_key} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium text-slate-900">{spot.area_name || spot.area_key}</p>
                    <Badge className={riskBadgeClass(spot.risk_band)}>{spot.risk_band.toUpperCase()}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>Risk Index: {(spot.risk_index * 100).toFixed(1)}%</span>
                    <span>Pred 24h: {spot.predicted_reports_next_24h}</span>
                    <span>Reports: {spot.count}</span>
                    <span>Trend: {spot.trend_direction}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" /> Area Search Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-500">{payload.search.supports}</p>
              {(payload.search.results || []).length === 0 && <p className="text-sm text-slate-500">No matching area insights.</p>}
              {(payload.search.results || []).slice(0, 5).map((spot) => (
                <div key={`search-${spot.area_key}`} className="rounded-lg border bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{spot.area_name || spot.area_key}</span>
                    <Badge variant="outline">{spot.risk_band}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {spot.count} reports, risk {(spot.risk_index * 100).toFixed(1)}%
                    {spot.distance_km !== undefined ? `, distance ${spot.distance_km} km` : ''}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Action Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {(payload.recommendations || []).map((item) => (
              <p key={item} className="rounded-md border bg-white px-3 py-2">{item}</p>
            ))}
            {!topHotspot && <p>No hotspot signals yet.</p>}
            {topHotspot && (
              <p className="rounded-md border bg-indigo-50 px-3 py-2 text-indigo-900">
                Priority area: {topHotspot.area_name || topHotspot.area_key} ({topHotspot.risk_band}, {(topHotspot.risk_index * 100).toFixed(1)}%)
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

