'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchAnalytics } from '@/lib/api'

export default function AreaSafetyChecker() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [message, setMessage] = useState('')

  const runCheck = async (overrideQuery = null) => {
    const effectiveQuery = overrideQuery !== null ? overrideQuery : query
    try {
      setLoading(true)
      setError('')
      const payload = await fetchAnalytics({ area: effectiveQuery, days: 45 })
      const incoming = payload.search?.results || []
      setResults(incoming)

      if (!effectiveQuery?.trim()) {
        setMessage('Showing top hotspot areas right now.')
      } else if (incoming.length > 0) {
        setMessage(`Found ${incoming.length} area matches.`)
      } else {
        setMessage('No exact match found. Showing top hotspot areas instead.')
      }
    } catch (err) {
      setError(err.message || 'Failed to run area check')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runCheck('')
  }, [])

  return (
    <div className="rounded-2xl border border-rose-100 bg-white/95 p-5 shadow-sm backdrop-blur">
      <h3 className="text-lg font-semibold text-neutral-900">Area Safety Checker</h3>
      <p className="mt-1 text-sm text-neutral-600">Search by area name (e.g. Sector 17, Manimajra) or risk keyword like `high`.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search area name or risk band"
        />
        <Button onClick={() => runCheck()} disabled={loading}>
          {loading ? 'Checking...' : 'Check'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {!error && message && <p className="mt-2 text-xs text-neutral-500">{message}</p>}
      <div className="mt-4 space-y-2">
        {results.slice(0, 3).map((item) => (
          <div key={item.area_key} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-900">{item.area_name || item.area_key}</p>
              <Badge variant="outline">{item.risk_band}</Badge>
            </div>
            <p className="mt-1 text-xs text-neutral-600">
              Risk {(item.risk_index * 100).toFixed(1)}% | Reports {item.count}
              {item.distance_km !== undefined ? ` | ${item.distance_km} km away` : ''}
            </p>
          </div>
        ))}
        {!loading && results.length === 0 && <p className="text-xs text-neutral-500">No area data available yet.</p>}
      </div>
    </div>
  )
}

