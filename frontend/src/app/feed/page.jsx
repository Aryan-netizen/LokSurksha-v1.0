'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Activity,
  AlertTriangle,
  Bookmark,
  ChartNoAxesCombined,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import { checkGeoAlerts, confirmIncident, createComment, fetchComments, fetchReports } from '@/lib/api'

const AUTO_REFRESH_SECONDS = 12

const LEVEL_STYLES = {
  low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  medium: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-rose-100 text-rose-700 border-rose-200',
  critical: 'bg-red-100 text-red-700 border-red-200'
}

const AREA_STYLES = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-100 text-blue-700 border-blue-200',
  high: 'bg-rose-100 text-rose-700 border-rose-200',
  critical: 'bg-red-100 text-red-700 border-red-200'
}

function formatDate(value) {
  try {
    return new Date(value)
  } catch {
    return new Date()
  }
}

function relativeTime(dateValue) {
  const now = Date.now()
  const date = formatDate(dateValue).getTime()
  const seconds = Math.max(1, Math.floor((now - date) / 1000))
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function makeReporter(id) {
  const labels = ['CivicEye', 'StreetWatch', 'CitySignal', 'PublicGuard', 'NeighborhoodLens']
  const name = `${labels[id % labels.length]} ${id}`
  return {
    name,
    handle: `report_${String(id).padStart(4, '0')}`,
    initials: name
      .split(' ')
      .map((v) => v[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }
}

export default function FeedPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [refreshCountdown, setRefreshCountdown] = useState(AUTO_REFRESH_SECONDS)

  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [areaFilter, setAreaFilter] = useState('all')
  const [mediaOnly, setMediaOnly] = useState(false)
  const [sortBy, setSortBy] = useState('latest')
  const [visibleCount, setVisibleCount] = useState(8)

  const [likedIds, setLikedIds] = useState(new Set())
  const [savedIds, setSavedIds] = useState(new Set())
  const [commentOpenIds, setCommentOpenIds] = useState(new Set())
  const [revealedSensitiveIds, setRevealedSensitiveIds] = useState(new Set())

  const [commentThreads, setCommentThreads] = useState({})
  const [commentDrafts, setCommentDrafts] = useState({})
  const [activeReplyTarget, setActiveReplyTarget] = useState({})
  const [commentsLoadingIds, setCommentsLoadingIds] = useState(new Set())
  const [commentErrors, setCommentErrors] = useState({})
  const [authorName, setAuthorName] = useState('Citizen')
  const [confirmingIds, setConfirmingIds] = useState(new Set())
  const [geoArea, setGeoArea] = useState('Sector 17, Chandigarh')
  const [geoRadiusKm, setGeoRadiusKm] = useState(3)
  const [geoAlerts, setGeoAlerts] = useState([])
  const [geoMeta, setGeoMeta] = useState({ should_notify: false, alerts_count: 0, resolved_area: '' })
  const [geoError, setGeoError] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)

  const setDraft = (key, value) => {
    setCommentDrafts((prev) => ({ ...prev, [key]: value }))
  }

  const loadReports = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const data = await fetchReports()
      setReports(data)
      setLastUpdatedAt(new Date())
      setRefreshCountdown(AUTO_REFRESH_SECONDS)
    } catch (err) {
      setError(err.message || 'Failed to load reports')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const loadGeoAlerts = async ({ silent = false } = {}) => {
    if (!geoArea.trim()) return
    if (!silent) setGeoLoading(true)
    setGeoError('')
    try {
      const payload = await checkGeoAlerts({
        area: geoArea.trim(),
        radiusKm: geoRadiusKm,
        minRisk: 'high'
      })
      setGeoAlerts(payload.alerts || [])
      setGeoMeta({
        should_notify: Boolean(payload.should_notify),
        alerts_count: payload.alerts_count || 0,
        resolved_area: payload.resolved_area || geoArea
      })
    } catch (err) {
      setGeoError(err.message || 'Failed to check area alerts')
    } finally {
      if (!silent) setGeoLoading(false)
    }
  }

  useEffect(() => {
    const localName = typeof window !== 'undefined' ? window.localStorage.getItem('ls_author_name') : null
    if (localName) {
      setAuthorName(localName)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ls_author_name', authorName)
    }
  }, [authorName])

  useEffect(() => {
    loadReports({ silent: false })
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      loadReports({ silent: true })
    }, AUTO_REFRESH_SECONDS * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadGeoAlerts({ silent: false })
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      loadGeoAlerts({ silent: true })
    }, 45000)
    return () => clearInterval(interval)
  }, [geoArea, geoRadiusKm])

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => (prev <= 1 ? AUTO_REFRESH_SECONDS : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const enrichedReports = useMemo(() => {
    return reports.map((report) => {
      const reporter = makeReporter(report.id)
      const severityWeight = report.crime_level === 'high' ? 3 : report.crime_level === 'medium' ? 2 : 1
      const areaWeight = report.area_level === 'critical' ? 4 : report.area_level === 'high' ? 3 : report.area_level === 'medium' ? 2 : 1
      const riskScore = severityWeight * 18 + areaWeight * 14 + (report.area_count || 0) * 4
      return {
        ...report,
        reporter,
        riskScore,
        engagement: {
          likes: (report.area_count || 0) * 3 + (report.id % 7),
          comments: report.comments_count || 0,
          confirms: report.confirmed_count || 0,
          shares: Math.max(1, Math.floor((report.area_count || 1) / 3))
        }
      }
    })
  }, [reports])

  const filteredReports = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase()

    let list = enrichedReports.filter((report) => {
      const matchesSearch =
        !normalizedQuery ||
        report.description.toLowerCase().includes(normalizedQuery) ||
        String(report.normalized_description || '').toLowerCase().includes(normalizedQuery) ||
        String(report.area_name || '').toLowerCase().includes(normalizedQuery) ||
        report.crime_level.toLowerCase().includes(normalizedQuery)

      const matchesLevel = levelFilter === 'all' || report.crime_level === levelFilter
      const matchesArea = areaFilter === 'all' || report.area_level === areaFilter
      const matchesMedia = !mediaOnly || Boolean(report.image_url)

      return matchesSearch && matchesLevel && matchesArea && matchesMedia
    })

    if (sortBy === 'latest') {
      list = list.sort((a, b) => formatDate(b.created_at) - formatDate(a.created_at))
    } else if (sortBy === 'engagement') {
      list = list.sort((a, b) => {
        const aScore = a.engagement.likes + a.engagement.comments + a.engagement.shares
        const bScore = b.engagement.likes + b.engagement.comments + b.engagement.shares
        return bScore - aScore
      })
    } else if (sortBy === 'risk') {
      list = list.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    }

    return list
  }, [enrichedReports, search, levelFilter, areaFilter, mediaOnly, sortBy])

  const visibleReports = useMemo(
    () => filteredReports.slice(0, visibleCount),
    [filteredReports, visibleCount]
  )

  const stats = useMemo(() => {
    const total = enrichedReports.length
    const withEvidence = enrichedReports.filter((r) => r.image_url).length
    const highRisk = enrichedReports.filter((r) => ['high', 'critical'].includes(r.area_level)).length
    const criticalNow = enrichedReports.filter((r) => r.area_level === 'critical').length
    const activeAreas = new Set(enrichedReports.map((r) => r.area_name || r.area_key)).size
    const avgTrust = total > 0 ? Math.round(enrichedReports.reduce((sum, r) => sum + (r.trust_score || 0), 0) / total) : 0
    const totalConfirms = enrichedReports.reduce((sum, r) => sum + (r.confirmed_count || 0), 0)
    const tagCounts = {}
    enrichedReports.forEach((report) => {
      const tags = Array.isArray(report.hashtags) ? report.hashtags : []
      tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1
      })
    })
    const topKeywords = Object.entries(tagCounts)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    return { total, withEvidence, highRisk, criticalNow, activeAreas, avgTrust, totalConfirms, topKeywords }
  }, [enrichedReports])

  const topAreas = useMemo(() => {
    const grouped = {}
    enrichedReports.forEach((report) => {
      const key = report.area_name || report.area_key || 'Unknown Area'
      if (!grouped[key]) {
        grouped[key] = { name: key, reports: 0, weighted: 0 }
      }
      grouped[key].reports += 1
      grouped[key].weighted += report.riskScore || 0
    })
    return Object.values(grouped).sort((a, b) => b.weighted - a.weighted).slice(0, 5)
  }, [enrichedReports])

  const criticalDigest = useMemo(() => {
    return [...enrichedReports]
      .filter((r) => ['high', 'critical'].includes(r.area_level))
      .sort((a, b) => formatDate(b.created_at) - formatDate(a.created_at))
      .slice(0, 4)
  }, [enrichedReports])

  const toggleSetValue = (setter, id) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleConfirm = async (report) => {
    const nextConfirmed = !report.is_confirmed
    setConfirmingIds((prev) => new Set(prev).add(report.id))
    try {
      const payload = await confirmIncident(report.id, nextConfirmed)
      setReports((prev) =>
        prev.map((row) =>
          row.id === report.id
            ? {
                ...row,
                is_confirmed: payload.is_confirmed,
                confirmed_count: payload.confirmed_count
              }
            : row
        )
      )
    } catch (err) {
      setError(err.message || 'Failed to confirm report')
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev)
        next.delete(report.id)
        return next
      })
    }
  }

  const loadComments = async (reportId) => {
    setCommentsLoadingIds((prev) => new Set(prev).add(reportId))
    setCommentErrors((prev) => ({ ...prev, [reportId]: '' }))
    try {
      const data = await fetchComments(reportId)
      setCommentThreads((prev) => ({ ...prev, [reportId]: data }))
    } catch (err) {
      setCommentErrors((prev) => ({ ...prev, [reportId]: err.message || 'Failed to load comments' }))
    } finally {
      setCommentsLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(reportId)
        return next
      })
    }
  }

  const toggleComments = (reportId) => {
    setCommentOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(reportId)) {
        next.delete(reportId)
      } else {
        next.add(reportId)
        if (!commentThreads[reportId]) {
          loadComments(reportId)
        }
      }
      return next
    })
  }

  const postComment = async (reportId, parentId = null) => {
    const draftKey = parentId ? `${reportId}:${parentId}` : `${reportId}:root`
    const content = (commentDrafts[draftKey] || '').trim()
    if (!content) return

    setCommentErrors((prev) => ({ ...prev, [reportId]: '' }))
    try {
      await createComment(reportId, {
        author_name: (authorName || 'Citizen').trim() || 'Citizen',
        content,
        parent_id: parentId
      })
      setDraft(draftKey, '')
      setActiveReplyTarget((prev) => ({ ...prev, [reportId]: null }))
      await loadComments(reportId)
      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? { ...report, comments_count: (report.comments_count || 0) + 1 }
            : report
        )
      )
    } catch (err) {
      setCommentErrors((prev) => ({ ...prev, [reportId]: err.message || 'Failed to post comment' }))
    }
  }

  const renderComment = (reportId, comment, depth = 0) => {
    const replyKey = `${reportId}:${comment.id}`
    const isReplying = activeReplyTarget[reportId] === comment.id

    return (
      <div key={comment.id} className={`rounded-lg border border-slate-200 bg-white p-3 ${depth > 0 ? 'ml-6 mt-2' : 'mt-3'}`}>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700">{comment.author_name}</span>
          <span>{relativeTime(comment.created_at)}</span>
        </div>
        <p className="mt-1 text-sm text-slate-700">{comment.content}</p>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setActiveReplyTarget((prev) => ({ ...prev, [reportId]: isReplying ? null : comment.id }))}
            className="text-xs text-blue-700 hover:underline"
          >
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
        </div>
        {isReplying && (
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="Write a reply..."
              value={commentDrafts[replyKey] || ''}
              onChange={(e) => setDraft(replyKey, e.target.value)}
            />
            <Button size="sm" onClick={() => postComment(reportId, comment.id)}>
              Reply
            </Button>
          </div>
        )}
        {Array.isArray(comment.replies) && comment.replies.map((child) => renderComment(reportId, child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dbeafe,transparent_28%),radial-gradient(circle_at_90%_10%,#fee2e2,transparent_25%),#f8fafc]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 py-4 lg:grid-cols-[250px_1fr_320px]">
        <aside className="hidden lg:block">
          <Card className="sticky top-4 border-slate-200/70 bg-white/90 backdrop-blur">
            <CardContent className="p-4">
              <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Live Watch
              </div>

              <div className="mb-3 text-xs text-slate-600">Posting as</div>
              <Input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value.slice(0, 80))}
                placeholder="Your name"
                className="mb-4"
              />

              <div className="space-y-2 text-sm">
                <Link href="/feed" className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 font-medium text-slate-900">
                  <TrendingUp className="h-4 w-4" /> Timeline
                </Link>
                <Link href="/report" className="flex items-center gap-2 rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100">
                  <ShieldAlert className="h-4 w-4" /> Report Incident
                </Link>
                <Link href="/heatmap" className="flex items-center gap-2 rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100">
                  <ChartNoAxesCombined className="h-4 w-4" /> Heatmap
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                <Button className="w-full rounded-full" asChild>
                  <Link href="/report">Create Report</Link>
                </Button>
                <Button variant="outline" className="w-full rounded-full" onClick={loadReports} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh Feed
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main>
          <Card className="overflow-hidden border-slate-200/70 bg-white/90 backdrop-blur">
            <CardContent className="border-b p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Crime Feed</h1>
                  <p className="text-sm text-slate-600">Twitter-style live timeline of verified reports.</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs">
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                    Auto-refresh in {refreshCountdown}s
                  </Badge>
                  <span className="text-slate-500">
                    {lastUpdatedAt ? `Last sync ${relativeTime(lastUpdatedAt)}` : 'Syncing...'}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search by description, level, location..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="latest">Latest</option>
                    <option value="engagement">Most Engaging</option>
                    <option value="risk">Highest Risk Areas</option>
                  </select>
                  <Button
                    variant={mediaOnly ? 'default' : 'outline'}
                    className="h-9"
                    onClick={() => setMediaOnly((v) => !v)}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" /> Media
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {['all', 'low', 'medium', 'high'].map((level) => (
                  <Button
                    key={level}
                    variant={levelFilter === level ? 'default' : 'outline'}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setLevelFilter(level)}
                  >
                    Level: {level}
                  </Button>
                ))}
                {['all', 'low', 'medium', 'high', 'critical'].map((area) => (
                  <Button
                    key={area}
                    variant={areaFilter === area ? 'default' : 'outline'}
                    className="h-8 rounded-full px-3 text-xs"
                    onClick={() => setAreaFilter(area)}
                  >
                    Area: {area}
                  </Button>
                ))}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <p className="font-medium">Active Areas</p>
                  <p className="text-lg font-semibold text-slate-900">{stats.activeAreas}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <p className="font-medium">Critical Threads</p>
                  <p className="text-lg font-semibold text-rose-800">{stats.criticalNow}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <p className="font-medium">Live State</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-blue-900">
                    <Activity className="h-3.5 w-3.5" /> {error ? 'degraded' : 'healthy'}
                  </p>
                </div>
              </div>
            </CardContent>

            <div>
              {loading && <p className="p-4 text-sm text-slate-600">Loading timeline...</p>}
              {error && <p className="p-4 text-sm text-red-600">{error}</p>}

              {!loading && !error && visibleReports.length === 0 && (
                <div className="p-6 text-center">
                  <CircleAlert className="mx-auto mb-2 h-6 w-6 text-slate-500" />
                  <p className="text-sm text-slate-600">No reports match your filters.</p>
                </div>
              )}

              {visibleReports.map((report) => {
                const isLiked = likedIds.has(report.id)
                const isSaved = savedIds.has(report.id)
                const commentsOpen = commentOpenIds.has(report.id)
                const evidenceMeta = report.evidence_analysis || {}
                const hasEvidence = Boolean(report.image_url)
                const isSensitiveEvidence = Boolean(evidenceMeta.is_sensitive || report.has_sensitive_evidence)
                const showBlur = isSensitiveEvidence && !revealedSensitiveIds.has(report.id)
                const rootDraftKey = `${report.id}:root`

                return (
                  <article
                    key={report.id}
                    className="border-b border-slate-200/70 p-4 transition-colors hover:bg-slate-50/80"
                  >
                    <div className="flex gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white">
                          {report.reporter.initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-slate-900">{report.reporter.name}</span>
                          <span className="text-slate-500">@{report.reporter.handle}</span>
                          <span className="text-slate-400">.</span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Clock3 className="h-3.5 w-3.5" /> {relativeTime(report.created_at)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge className={`border ${LEVEL_STYLES[report.crime_level] || LEVEL_STYLES.low}`}>
                            {report.crime_level}
                          </Badge>
                          <Badge className={`border ${AREA_STYLES[report.area_level] || AREA_STYLES.low}`}>
                            area: {report.area_level}
                          </Badge>
                          <Badge variant="outline">heat: {report.area_count || 0}</Badge>
                          <Badge variant="outline">risk: {report.riskScore}</Badge>
                          <Badge className={`border ${report.trust_score >= 75 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : report.trust_score >= 50 ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            trust: {report.trust_score || 0}%
                          </Badge>
                          {report.otp_verified && <Badge variant="outline">otp verified</Badge>}
                          {report.fir_verified && <Badge variant="outline">fir verified</Badge>}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{report.description}</p>

                        {Array.isArray(report.hashtags) && report.hashtags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {report.hashtags.slice(0, 6).map((tag) => (
                              <button
                                key={`${report.id}-${tag}`}
                                type="button"
                                onClick={() => setSearch(tag)}
                                className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" /> {report.area_name || report.area_key || 'Unknown Area'}
                          </span>
                          <span>{formatDate(report.created_at).toLocaleString()}</span>
                          {hasEvidence && <span className="inline-flex items-center gap-1 text-blue-700"><ImageIcon className="h-4 w-4" /> evidence attached</span>}
                        </div>

                        {hasEvidence && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
                              <img
                                src={report.image_url}
                                alt="Report evidence"
                                className={`max-h-[360px] w-full object-cover transition duration-200 ${showBlur ? 'blur-lg scale-105' : ''}`}
                                loading="lazy"
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {isSensitiveEvidence && (
                                <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                                  Sensitive evidence auto-blurred
                                </Badge>
                              )}
                              {evidenceMeta.quality_ok === false && (
                                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                                  Low quality evidence
                                </Badge>
                              )}
                              {isSensitiveEvidence && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => toggleSetValue(setRevealedSensitiveIds, report.id)}
                                >
                                  {showBlur ? <Eye className="mr-1 h-3.5 w-3.5" /> : <EyeOff className="mr-1 h-3.5 w-3.5" />}
                                  {showBlur ? 'Show' : 'Hide'}
                                </Button>
                              )}
                            </div>
                            {Array.isArray(evidenceMeta.tips) && evidenceMeta.tips.length > 0 && (
                              <p className="mt-2 text-xs text-slate-600">
                                {evidenceMeta.tips[0]}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between pr-4 text-slate-500">
                          <button
                            type="button"
                            onClick={() => toggleComments(report.id)}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-blue-50 hover:text-blue-700"
                          >
                            <MessageCircle className="h-4 w-4" /> {report.engagement.comments}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleSetValue(setLikedIds, report.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-rose-50 ${
                              isLiked ? 'text-rose-600' : 'hover:text-rose-600'
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
                            {report.engagement.likes + (isLiked ? 1 : 0)}
                          </button>

                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Send className="h-4 w-4" /> {report.engagement.shares}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleConfirm(report)}
                            disabled={confirmingIds.has(report.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                              report.is_confirmed ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {confirmingIds.has(report.id) ? 'confirming...' : `confirm ${report.engagement.confirms}`}
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleSetValue(setSavedIds, report.id)}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
                              isSaved ? 'text-rose-600' : 'hover:bg-rose-50 hover:text-rose-700'
                            }`}
                          >
                            <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} /> save
                          </button>
                        </div>

                        {commentsOpen && (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-3 flex gap-2">
                              <Input
                                placeholder="Add a comment..."
                                value={commentDrafts[rootDraftKey] || ''}
                                onChange={(e) => setDraft(rootDraftKey, e.target.value)}
                              />
                              <Button size="sm" onClick={() => postComment(report.id)}>
                                Post
                              </Button>
                            </div>

                            {commentErrors[report.id] && (
                              <p className="mb-2 text-xs text-red-600">{commentErrors[report.id]}</p>
                            )}

                            {commentsLoadingIds.has(report.id) && (
                              <p className="text-xs text-slate-500">Loading comments...</p>
                            )}

                            {Array.isArray(commentThreads[report.id]) && commentThreads[report.id].length === 0 && !commentsLoadingIds.has(report.id) && (
                              <p className="text-xs text-slate-500">No comments yet.</p>
                            )}

                            {Array.isArray(commentThreads[report.id]) && commentThreads[report.id].map((comment) => renderComment(report.id, comment))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {!loading && visibleCount < filteredReports.length && (
              <div className="p-4">
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => setVisibleCount((v) => v + 8)}
                >
                  Load More Posts
                </Button>
              </div>
            )}
          </Card>
        </main>

        <aside>
          <div className="sticky top-4 space-y-4">
            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Feed Metrics</h2>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center justify-between"><span className="text-slate-600">Total Reports</span><span className="font-semibold">{stats.total}</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">High Risk Threads</span><span className="font-semibold text-rose-600">{stats.highRisk}</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">Critical Threads</span><span className="font-semibold text-red-600">{stats.criticalNow}</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">Active Areas</span><span className="font-semibold text-indigo-700">{stats.activeAreas}</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">With Evidence</span><span className="font-semibold text-blue-700">{stats.withEvidence}</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">Avg Trust</span><span className="font-semibold text-emerald-700">{stats.avgTrust}%</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">Community Confirms</span><span className="font-semibold text-emerald-700">{stats.totalConfirms}</span></p>
                  <p className="flex items-center justify-between"><span className="text-slate-600">Saved</span><span className="font-semibold text-rose-600">{savedIds.size}</span></p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Critical Alerts</h2>
                {criticalDigest.length === 0 && <p className="text-xs text-slate-500">No high-risk activity right now.</p>}
                <div className="space-y-2">
                  {criticalDigest.map((report) => (
                    <div key={`alert-${report.id}`} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                      <p className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-rose-800">
                          <AlertTriangle className="h-3.5 w-3.5" /> {report.area_name || report.area_key}
                        </span>
                        <span className="text-rose-700">{relativeTime(report.created_at)}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-rose-900">{report.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Geo-fenced Alerts</h2>
                <p className="mb-3 text-xs text-slate-600">Monitor a selected area and radius for high/critical hotspots.</p>
                <div className="space-y-2">
                  <Input
                    value={geoArea}
                    onChange={(e) => setGeoArea(e.target.value)}
                    placeholder="e.g. Sector 17, Chandigarh"
                  />
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={geoRadiusKm}
                      onChange={(e) => setGeoRadiusKm(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                      placeholder="Radius km"
                    />
                    <Button variant="outline" onClick={() => loadGeoAlerts({ silent: false })} disabled={geoLoading}>
                      {geoLoading ? 'Checking...' : 'Check'}
                    </Button>
                  </div>
                </div>
                {geoError && <p className="mt-2 text-xs text-red-600">{geoError}</p>}
                {!geoError && (
                  <p className={`mt-2 text-xs ${geoMeta.should_notify ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {geoMeta.should_notify
                      ? `${geoMeta.alerts_count} alert(s) near ${geoMeta.resolved_area}`
                      : `No high-risk alerts near ${geoMeta.resolved_area || geoArea}`}
                  </p>
                )}
                <div className="mt-3 space-y-2">
                  {geoAlerts.slice(0, 3).map((row) => (
                    <div key={`geo-${row.area_key}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-800">{row.area_name || row.area_key}</p>
                      <p className="text-xs text-slate-600">
                        {row.risk_band} risk | {row.distance_km} km | next24h {row.predicted_reports_next_24h}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Top Areas</h2>
                <div className="space-y-2">
                  {topAreas.map((area, index) => (
                    <div key={area.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <p className="inline-flex items-center gap-2 text-slate-800">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">#{index + 1}</span>
                        {area.name}
                      </p>
                      <p className="text-xs text-slate-600">{area.reports} reports</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Trending Terms</h2>
                <div className="space-y-2">
                  {stats.topKeywords.map((item) => (
                    <button
                      key={item.keyword}
                      type="button"
                      onClick={() => setSearch(item.keyword)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm text-slate-800">#{item.keyword}</span>
                      <span className="text-xs text-slate-500">{item.count}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/70 bg-white/90 backdrop-blur">
              <CardContent className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Trust Layer</h2>
                <p className="mb-3 text-xs text-slate-600">Reports are loaded from your Flask API and tagged with computed area risk.</p>
                <div className="space-y-2 text-xs text-slate-700">
                  <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> API-backed timeline</p>
                  <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Smart filters and sorting</p>
                  <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Threaded comments and replies</p>
                  <p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Live risk-scored area ranking</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}


