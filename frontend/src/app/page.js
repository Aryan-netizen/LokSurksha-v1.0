'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Clock, TrendingUp, Phone, Siren, RadioTower, Activity, MapPin } from 'lucide-react'
import Link from 'next/link'
import AreaSafetyChecker from '@/components/area-safety-checker'
import { fetchHeatmap, fetchReports } from '@/lib/api'

function relativeTime(input) {
  if (!input) return 'just now'
  const ms = Date.now() - new Date(input).getTime()
  const mins = Math.max(1, Math.floor(ms / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function HomePage() {
  const [reports, setReports] = useState([])
  const [heatmap, setHeatmap] = useState({ areas: [], max_count: 0 })
  const [error, setError] = useState('')
  const [lastSync, setLastSync] = useState(null)

  const refreshData = async () => {
    try {
      const [reportRows, heat] = await Promise.all([fetchReports(), fetchHeatmap()])
      setReports(reportRows)
      setHeatmap(heat)
      setLastSync(new Date().toISOString())
      setError('')
    } catch (err) {
      setError(err.message || 'Live data unavailable')
    }
  }

  useEffect(() => {
    refreshData()
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      refreshData()
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const metrics = useMemo(() => {
    const totalReports = reports.length
    const activeAreas = new Set(reports.map((report) => report.area_name || report.area_key || `${report.location_lat},${report.location_lng}`)).size
    const highRisk = reports.filter((report) => report.crime_level === 'high' || report.area_level === 'critical').length
    const evidenceCount = reports.filter((report) => Boolean(report.image_url)).length
    return { totalReports, activeAreas, highRisk, evidenceCount }
  }, [reports])

  const topHotspot = useMemo(() => {
    const areas = [...(heatmap.areas || [])].sort((a, b) => (b.count || 0) - (a.count || 0) || (b.score || 0) - (a.score || 0))
    return areas[0] || null
  }, [heatmap])

  const latestReports = useMemo(() => reports.slice(0, 5), [reports])

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden px-4 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(239,68,68,0.11),transparent_36%),radial-gradient(circle_at_85%_20%,rgba(148,163,184,0.12),transparent_34%),linear-gradient(180deg,#fff8f8,#ffffff)] animate-gradient-shift" />
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center animate-rise-in">
            <Badge variant="secondary" className="mb-4 border border-rose-200 bg-rose-50 text-rose-800">Live Community Intelligence</Badge>
            <h1 className="mb-5 text-4xl font-bold tracking-tight text-neutral-900 md:text-6xl">
              Real-time Safety
              <span className="text-red-700"> Visibility</span>
            </h1>
            <p className="mx-auto mb-7 max-w-3xl text-lg text-neutral-600 md:text-xl">
              Real incident stream, live hotspot movement, and immediate reporting workflow from your backend data.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/report">
                <Button size="lg" className="px-8 py-3 text-lg">
                  <Shield className="mr-2 h-5 w-5" />
                  Report Now
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="px-8 py-3 text-lg">
                <Phone className="mr-2 h-5 w-5" />
                Emergency: 911
              </Button>
            </div>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-neutral-600">
              <Activity className="h-3.5 w-3.5 text-emerald-600" /> Last sync {relativeTime(lastSync)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card className="surface-card surface-card-hover animate-float">
              <CardContent className="p-4">
                <p className="text-xs text-neutral-600">Total Reports</p>
                <p className="text-3xl font-bold text-neutral-900">{metrics.totalReports}</p>
              </CardContent>
            </Card>
            <Card className="surface-card surface-card-hover animate-float" style={{ animationDelay: '120ms' }}>
              <CardContent className="p-4">
                <p className="text-xs text-neutral-600">Active Areas</p>
                <p className="text-3xl font-bold text-neutral-900">{metrics.activeAreas}</p>
              </CardContent>
            </Card>
            <Card className="surface-card surface-card-hover animate-float" style={{ animationDelay: '220ms' }}>
              <CardContent className="p-4">
                <p className="text-xs text-neutral-600">High Risk Threads</p>
                <p className="text-3xl font-bold text-rose-700">{metrics.highRisk}</p>
              </CardContent>
            </Card>
            <Card className="surface-card surface-card-hover animate-float" style={{ animationDelay: '320ms' }}>
              <CardContent className="p-4">
                <p className="text-xs text-neutral-600">With Evidence</p>
                <p className="text-3xl font-bold text-rose-700">{metrics.evidenceCount}</p>
              </CardContent>
            </Card>
          </div>
          {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
        </div>
      </section>

      <section className="bg-white/70 px-4 py-14 backdrop-blur">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-neutral-900">Quick Safety Tools</h2>
            <p className="text-sm text-neutral-600">Real actions for reporting and monitoring.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Siren className="h-5 w-5 text-rose-600" /> Emergency Access</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-neutral-700">
                <p>For active danger, use emergency services first.</p>
                <div className="rounded-lg bg-rose-50 px-3 py-2 font-medium text-rose-800">Emergency: 911</div>
                <Link href="/report"><Button className="w-full">File Report</Button></Link>
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><RadioTower className="h-5 w-5 text-rose-600" /> Live Intelligence</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-neutral-700">
                <p>Track incidents and hotspots in real time.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/feed"><Button variant="outline" className="w-full">Live Feed</Button></Link>
                  <Link href="/heatmap"><Button variant="outline" className="w-full">Heatmap</Button></Link>
                </div>
                <Link href="/analytic"><Button className="w-full">Open Analytics</Button></Link>
              </CardContent>
            </Card>

            <AreaSafetyChecker />
          </div>
        </div>
      </section>

      <section className="bg-rose-50/20 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-neutral-900">Live Situation Snapshot</h2>
              <p className="text-sm text-neutral-600">Auto-refresh every 15 seconds from backend data.</p>
            </div>
            <Link href="/heatmap"><Button variant="outline">Open Heatmap</Button></Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="text-lg">Latest Incidents</CardTitle>
                <CardDescription>Most recent reports from live feed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestReports.length === 0 && <p className="text-sm text-neutral-600">No reports yet.</p>}
                {latestReports.map((report) => (
                  <div key={report.id} className="rounded-lg border border-rose-100 bg-white p-3">
                    <p className="text-sm font-medium text-neutral-800">{report.area_name || report.area_key || 'Unknown Area'}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{report.description}</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-xs text-neutral-500">
                      <Clock className="h-3.5 w-3.5" /> {relativeTime(report.created_at)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="surface-card">
              <CardHeader>
                <CardTitle className="text-lg">Top Hotspot</CardTitle>
                <CardDescription>Highest current concentration by area</CardDescription>
              </CardHeader>
              <CardContent>
                {!topHotspot && <p className="text-sm text-neutral-600">No hotspot data available.</p>}
                {topHotspot && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-800">
                      <MapPin className="h-4 w-4" />
                      {topHotspot.area_name || topHotspot.area_key}
                    </p>
                    <p className="mt-2 text-xs text-rose-900">Reports: {topHotspot.count} | Score: {topHotspot.score}</p>
                    <p className="mt-1 text-xs text-rose-700">Level: {topHotspot.area_level}</p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href="/feed"><Button variant="outline" className="w-full"><Activity className="mr-2 h-4 w-4" /> Feed</Button></Link>
                  <Link href="/analytic"><Button variant="outline" className="w-full"><TrendingUp className="mr-2 h-4 w-4" /> Analytics</Button></Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}


