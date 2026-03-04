'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { fetchAnalytics } from '@/lib/api'

function formatRisk(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`
}

export default function GlobalAlertStrip() {
  const [topHotspot, setTopHotspot] = useState(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const analytics = await fetchAnalytics({ days: 14 })
        if (!active) return
        setTopHotspot((analytics.hotspots || [])[0] || null)
      } catch {
        if (active) setTopHotspot(null)
      }
    }

    load()
    const timer = setInterval(load, 60000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  const toneClass = useMemo(() => {
    if (!topHotspot) return 'border-rose-100 bg-rose-50/70 text-rose-900'
    if (topHotspot.risk_band === 'critical') return 'border-rose-200 bg-rose-50 text-rose-900'
    if (topHotspot.risk_band === 'high') return 'border-rose-200 bg-rose-50 text-rose-900'
    return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  }, [topHotspot])

  return (
    <div className={`border-b px-4 py-2 text-sm ${toneClass}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {!topHotspot && <span>Live alerts will appear here once model data is available.</span>}
          {topHotspot && (
            <span>
              Top hotspot: <strong>{topHotspot.area_name || topHotspot.area_key}</strong> | risk {formatRisk(topHotspot.risk_index)} ({topHotspot.risk_band})
            </span>
          )}
        </div>
        <Link href="/analytic" className="w-fit font-medium underline underline-offset-4">
          Open analytics
        </Link>
      </div>
    </div>
  )
}

