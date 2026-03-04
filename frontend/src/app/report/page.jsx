'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle2, MapPin, Phone, Share2, Shield, UploadCloud } from 'lucide-react'
import {
  createReport,
  fetchReportSuggestions,
  geocodeLocation,
  reverseGeocodeLocation,
  sendOtp,
  verifyFir,
  verifyOtp
} from '@/lib/api'
import { useLanguage } from '@/lib/i18n'

const LOCATION_OPTIONS = {
  Chandigarh: ['Chandigarh'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Saket'],
  Punjab: ['Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala', 'Mohali'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Hisar'],
  'Uttar Pradesh': ['Noida', 'Ghaziabad', 'Lucknow', 'Kanpur', 'Varanasi'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Thane'],
}

const PLACE_TYPE_OPTIONS = [
  { value: '', label: 'General Area' },
  { value: 'market', label: 'Market/Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'school', label: 'School/College' },
  { value: 'hospital', label: 'Hospital/Clinic' },
  { value: 'transport', label: 'Transport Hub' },
  { value: 'office', label: 'Office/Industrial' },
  { value: 'other', label: 'Other Specific Place' },
]

const ReportPage = () => {
  const { language, t } = useLanguage()
  const [formData, setFormData] = useState({
    crimeLevel: 'low',
    description: '',
    state: 'Chandigarh',
    city: 'Chandigarh',
    locality: '',
    placeType: '',
    locationQuery: '',
    areaName: '',
    latitude: '',
    longitude: '',
    firState: 'Chandigarh',
    firPoliceStation: '',
    firNumber: '',
    firDate: '',
    firIpcSections: '',
    firFile: null,
    photo: null,
    phone: ''
  })
  const [otpCode, setOtpCode] = useState('')
  const [otpSessionId, setOtpSessionId] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [otpStatus, setOtpStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isResolvingArea, setIsResolvingArea] = useState(false)
  const [isGeocodingLocation, setIsGeocodingLocation] = useState(false)
  const [isVerifyingFir, setIsVerifyingFir] = useState(false)
  const [firVerificationMessage, setFirVerificationMessage] = useState('')
  const [firVerificationStatus, setFirVerificationStatus] = useState('')
  const [firVerificationFingerprint, setFirVerificationFingerprint] = useState('')
  const [firLookupUnavailable, setFirLookupUnavailable] = useState(false)
  const [locationDirty, setLocationDirty] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [formStartedAt, setFormStartedAt] = useState(() => Math.floor(Date.now() / 1000))
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [sosStatus, setSosStatus] = useState('')
  const [message, setMessage] = useState('')
  const [isAiAssisting, setIsAiAssisting] = useState(false)
  const [aiAssist, setAiAssist] = useState({
    summary: '',
    category: 'general',
    category_confidence: 0,
    urgency_hint: 'low',
    keywords: [],
    hashtags: [],
  })
  const stateOptions = useMemo(() => {
    const base = Object.keys(LOCATION_OPTIONS)
    if (formData.state && !base.includes(formData.state)) return [formData.state, ...base]
    return base
  }, [formData.state])
  const cityOptions = useMemo(() => {
    const base = LOCATION_OPTIONS[formData.state] || []
    if (formData.city && !base.includes(formData.city)) return [formData.city, ...base]
    return base
  }, [formData.state, formData.city])
  const locationReady = Boolean(formData.latitude && formData.longitude)
  const firReady = Boolean(formData.firState && formData.firPoliceStation && formData.firNumber && formData.firDate)
  const otpReady = Boolean(otpToken)
  const currentFirFingerprint = useMemo(
    () =>
      [
        (formData.firState || '').trim().toLowerCase(),
        (formData.firPoliceStation || '').trim().toLowerCase(),
        (formData.firNumber || '').trim().toLowerCase(),
        (formData.firDate || '').trim()
      ].join('|'),
    [formData.firState, formData.firPoliceStation, formData.firNumber, formData.firDate]
  )
  const firVerifiedReady = Boolean(firVerificationFingerprint && firVerificationFingerprint === currentFirFingerprint)
  const firGatePassed = firVerifiedReady || firLookupUnavailable
  const completion = useMemo(() => {
    let score = 0
    if (formData.description.trim()) score += 20
    if (formData.state && formData.city && formData.locality.trim()) score += 20
    if (locationReady) score += 20
    if (firReady) score += 20
    if (otpReady) score += 20
    return score
  }, [formData, locationReady, firReady, otpReady])

  const canSubmit = useMemo(
    () =>
      Boolean(
        formData.description &&
          formData.state &&
          formData.city &&
          (formData.locality || formData.areaName) &&
          formData.firState &&
          formData.firPoliceStation &&
          formData.firNumber &&
          formData.firDate &&
          firGatePassed &&
          otpToken &&
          ((formData.latitude && formData.longitude) || formData.locationQuery || buildLocationQuery())
      ),
    [formData, otpToken, firGatePassed]
  )

  const handleInputChange = (field, value) => {
    const firSensitiveFields = ['firState', 'firPoliceStation', 'firNumber', 'firDate', 'firIpcSections', 'firFile']
    setFormData((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'state') {
        const nextCities = LOCATION_OPTIONS[value] || []
        next.city = nextCities[0] || ''
        next.firState = value
      }
      if (['state', 'city', 'locality', 'locationQuery'].includes(field)) {
        next.latitude = ''
        next.longitude = ''
      }
      return next
    })
    if (['state', 'city', 'locality', 'locationQuery'].includes(field)) {
      setLocationDirty(true)
    }
    if (firSensitiveFields.includes(field)) {
      setFirVerificationStatus('')
      setFirVerificationMessage('')
      setFirVerificationFingerprint('')
      setFirLookupUnavailable(false)
    }
  }

  const buildLocationQuery = () => {
    const locality = (formData.locality || '').trim()
    const withSectorPrefix = locality && /^\d+[a-zA-Z-]*$/.test(locality) ? `Sector ${locality}` : locality
    const parts = [withSectorPrefix, formData.city, formData.state, 'India'].filter(Boolean)
    return parts.join(', ')
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsResolvingArea(true)
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = position.coords.latitude.toString()
          const longitude = position.coords.longitude.toString()
          try {
            const reverse = await reverseGeocodeLocation(latitude, longitude)
            setFormData((prev) => ({
              ...prev,
              latitude,
              longitude,
              state: reverse.state || prev.state,
              firState: reverse.state || prev.state,
              city: reverse.city || prev.city,
              locality: reverse.locality || prev.locality,
              areaName: reverse.area_name || prev.areaName,
              locationQuery:
                reverse.display_name ||
                [reverse.locality, reverse.city, reverse.state].filter(Boolean).join(', ') ||
                prev.locationQuery
            }))
            setMessage('Current location detected and form auto-filled.')
            setLocationDirty(false)
          } catch {
            setFormData((prev) => ({
              ...prev,
              latitude,
              longitude
            }))
            setMessage('Location captured. Area name not resolved, please type sector/city/state manually.')
          }
          setIsResolvingArea(false)
        },
        () => {
          setIsResolvingArea(false)
          setMessage('Unable to get your location. Enter location manually.')
        }
      )
    } else {
      setMessage('Geolocation is not supported in this browser.')
    }
  }

  const handleResolveLocation = async () => {
    const query = formData.locationQuery.trim() || buildLocationQuery()
    if (!query) {
      setMessage('Enter sector/city/state first.')
      return
    }
    setIsGeocodingLocation(true)
    setMessage('')
    try {
      const result = await geocodeLocation(query)
      setFormData((prev) => ({
        ...prev,
        latitude: String(result.location_lat),
        longitude: String(result.location_lng),
        state: result.state || prev.state,
        firState: result.state || prev.state,
        city: result.city || prev.city,
        locality: result.locality || prev.locality,
        areaName: result.area_name || prev.areaName,
        locationQuery: result.display_name || query
      }))
      setMessage('Location resolved successfully.')
      setLocationDirty(false)
    } catch (error) {
      setMessage(error.message || 'Could not resolve location.')
    } finally {
      setIsGeocodingLocation(false)
    }
  }

  const applyTemplate = (key) => {
    setSelectedTemplate(key)
    const template = (t.reportTemplates || []).find((item) => item.key === key)
    if (!template) return
    setFormData((prev) => ({
      ...prev,
      description: prev.description ? `${prev.description}\n${template.text}` : template.text
    }))
  }

  const handleAiAssist = async () => {
    if (!formData.description.trim()) {
      setMessage('Description likho, fir AI Assist chalao.')
      return
    }
    setIsAiAssisting(true)
    setMessage('')
    try {
      const result = await fetchReportSuggestions({
        description: formData.description,
        area_name: formData.areaName || formData.locality || '',
        crime_level: formData.crimeLevel,
      })
      const nextAi = {
        summary: result?.ai?.summary || '',
        category: result?.ai?.category || 'general',
        category_confidence: Number(result?.ai?.category_confidence || 0),
        urgency_hint: result?.ai?.urgency_hint || 'low',
        keywords: result?.ai?.keywords || [],
        hashtags: result?.hashtags || [],
      }
      setAiAssist(nextAi)
      if (nextAi.urgency_hint === 'critical' || nextAi.urgency_hint === 'high') {
        setFormData((prev) => ({ ...prev, crimeLevel: prev.crimeLevel === 'low' ? 'high' : prev.crimeLevel }))
      }
    } catch (error) {
      setMessage(error.message || 'AI suggestions failed.')
    } finally {
      setIsAiAssisting(false)
    }
  }

  const handleShareSOS = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setSosStatus(language === 'hi' ? 'लोकेशन शेयर सपोर्ट नहीं है।' : 'Live location sharing not supported.')
      return
    }
    setIsSharingLocation(true)
    setSosStatus('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6)
        const lng = pos.coords.longitude.toFixed(6)
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`
        const text = language === 'hi'
          ? `SOS: मुझे तुरंत सहायता चाहिए। मेरी लोकेशन: ${mapsUrl}`
          : `SOS: I need immediate help. My live location: ${mapsUrl}`
        try {
          if (navigator.share) {
            await navigator.share({ title: 'LokSurksha SOS', text, url: mapsUrl })
            setSosStatus(language === 'hi' ? 'SOS लोकेशन शेयर हो गई।' : 'SOS location shared.')
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
            setSosStatus(language === 'hi' ? 'SOS संदेश कॉपी हो गया।' : 'SOS message copied to clipboard.')
          } else {
            setSosStatus(text)
          }
        } catch {
          setSosStatus(language === 'hi' ? 'शेयर रद्द या असफल।' : 'Share canceled or failed.')
        } finally {
          setIsSharingLocation(false)
        }
      },
      () => {
        setSosStatus(language === 'hi' ? 'लोकेशन एक्सेस नहीं मिला।' : 'Unable to access location.')
        setIsSharingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const handleVerifyFirNow = async () => {
    if (!firReady) {
      setMessage('Fill FIR Number, Police Station, FIR Date, and State before verify.')
      return
    }
    setIsVerifyingFir(true)
    setFirVerificationMessage('')
    setFirVerificationStatus('')
    setFirLookupUnavailable(false)
    setMessage('')
    try {
      const payload = new FormData()
      payload.append('state', formData.firState)
      payload.append('police_station', formData.firPoliceStation)
      payload.append('fir_number', formData.firNumber)
      payload.append('fir_date', formData.firDate)
      payload.append('ipc_sections', formData.firIpcSections)
      const response = await verifyFir(payload)
      setFirVerificationStatus(response.status || '')
      const lookupMode = response.provider_mode === 'live' ? 'live' : 'unavailable'
      const providerUnavailable = lookupMode !== 'live'
      const lookupNote = response.provider_error ? String(response.provider_error) : ''
      const scoreText = lookupMode === 'live' ? String(response.score) : 'N/A'
      setFirVerificationMessage(
        `Verification score: ${scoreText} | Provider: ${response.provider || 'hyperverge'} | Lookup: ${lookupMode}${lookupNote ? ` | ${lookupNote}` : ''}`
      )
      const frontendPass = response.status === 'verified_likely'
      if (frontendPass) {
        setFirVerificationFingerprint(currentFirFingerprint)
      } else {
        setFirVerificationFingerprint('')
      }
      setFirLookupUnavailable(providerUnavailable)
    } catch (error) {
      setFirVerificationFingerprint('')
      setFirLookupUnavailable(false)
      setMessage(error.message || 'FIR verification failed.')
    } finally {
      setIsVerifyingFir(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      if (!firGatePassed) {
        setMessage('Please verify FIR details before submitting report.')
      } else {
        setMessage('Please fill all required fields.')
      }
      return
    }

    setIsSubmitting(true)
    setMessage('')
    try {
      let latitude = formData.latitude
      let longitude = formData.longitude
      let areaName = formData.areaName || [formData.locality, formData.city].filter(Boolean).join(', ')
      const locationQuery = buildLocationQuery()

      if ((locationDirty || !latitude || !longitude) && locationQuery) {
        const result = await geocodeLocation(locationQuery)
        latitude = String(result.location_lat)
        longitude = String(result.location_lng)
        if (!areaName) areaName = result.area_name || ''
      }

      if (!latitude || !longitude) {
        throw new Error('Please provide incident location (sector/city/state) and resolve it.')
      }

      const payload = new FormData()
      payload.append('description', formData.description)
      payload.append('area_name', areaName)
      payload.append('location_lat', latitude)
      payload.append('location_lng', longitude)
      payload.append('crime_level', formData.crimeLevel)
      payload.append('phone', formData.phone)
      payload.append('otp_token', otpToken)
      payload.append('fir_state', formData.firState)
      payload.append('fir_police_station', formData.firPoliceStation)
      payload.append('fir_number', formData.firNumber)
      payload.append('fir_date', formData.firDate)
      payload.append('fir_ipc_sections', formData.firIpcSections)
      payload.append('form_started_at', String(formStartedAt))
      payload.append('website', '')
      const submitTags = []
      if (formData.placeType) {
        const placeTag = `#${formData.placeType}zone`
        if (!submitTags.includes(placeTag)) submitTags.push(placeTag)
      }
      for (const tag of aiAssist.hashtags || []) {
        if (!submitTags.includes(tag)) submitTags.push(tag)
      }
      payload.append('hashtags', JSON.stringify(submitTags))
      if (formData.photo) payload.append('photo', formData.photo)
      if (formData.firFile) payload.append('fir_file', formData.firFile)

      await createReport(payload)
      setMessage('Report submitted successfully.')
      setFormData({
        crimeLevel: 'low',
        description: '',
        state: 'Chandigarh',
        city: 'Chandigarh',
        locality: '',
        placeType: '',
        locationQuery: '',
        areaName: '',
        latitude: '',
        longitude: '',
        firState: 'Chandigarh',
        firPoliceStation: '',
        firNumber: '',
        firDate: '',
        firIpcSections: '',
        firFile: null,
        photo: null,
        phone: ''
      })
      setOtpCode('')
      setOtpSessionId('')
      setOtpToken('')
      setOtpStatus('')
      setFirVerificationMessage('')
      setFirVerificationStatus('')
      setFirVerificationFingerprint('')
      setFirLookupUnavailable(false)
      setSelectedTemplate('')
      setAiAssist({
        summary: '',
        category: 'general',
        category_confidence: 0,
        urgency_hint: 'low',
        keywords: [],
        hashtags: [],
      })
      setFormStartedAt(Math.floor(Date.now() / 1000))
    } catch (error) {
      setMessage(error.message || 'Could not submit report.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendOtp = async () => {
    if (!formData.phone.trim()) {
      setMessage('Please enter phone number before sending OTP.')
      return
    }
    setIsSendingOtp(true)
    setMessage('')
    try {
      const result = await sendOtp(formData.phone)
      setOtpSessionId(result.session_id)
      setOtpToken('')
      const devHint = result.dev_otp_code ? ` Dev OTP: ${result.dev_otp_code}` : ''
      setOtpStatus(`OTP sent to ${result.masked_phone}.${devHint}`)
    } catch (error) {
      setOtpStatus('')
      setMessage(error.message || 'Could not send OTP.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otpSessionId) {
      setMessage('Send OTP first.')
      return
    }
    if (!otpCode.trim()) {
      setMessage('Enter OTP code.')
      return
    }
    setIsVerifyingOtp(true)
    setMessage('')
    try {
      const result = await verifyOtp(otpSessionId, otpCode)
      setOtpToken(result.otp_token)
      setOtpStatus('OTP verified successfully.')
    } catch (error) {
      setOtpToken('')
      setMessage(error.message || 'OTP verification failed.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(140deg,#fff8f8_0%,#ffffff_45%,#f8fafc_100%)] px-4 py-6">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-rose-100 bg-white/90 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-6 w-6 text-red-700" />
              File Incident Report
            </CardTitle>
            <CardDescription>
              Reports are sent directly to the backend and reflected in feed, analytics, and heatmap.
            </CardDescription>
            <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-600">
                <span>Submission readiness</span>
                <span className="font-semibold text-neutral-800">{completion}%</span>
              </div>
              <div className="h-2 rounded-full bg-rose-100">
                <div className="h-2 rounded-full bg-[linear-gradient(90deg,#dc2626,#e11d48)]" style={{ width: `${completion}%` }} />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-red-900">Location Auto-Fill</p>
                    <p className="text-xs text-red-700">Tap once to fill state, city, locality, and real map location.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={getCurrentLocation} disabled={isResolvingArea}>
                    <MapPin className="mr-2 h-4 w-4" /> {isResolvingArea ? 'Detecting...' : 'Use Current Location'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="crimeLevel">Crime Level *</Label>
                <Select
                  id="crimeLevel"
                  value={formData.crimeLevel}
                  onChange={(e) => handleInputChange('crimeLevel', e.target.value)}
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-rose-200 bg-white px-3 text-xs"
                    value={selectedTemplate}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">{language === 'hi' ? 'रिपोर्ट टेम्पलेट चुनें' : 'Choose report template'}</option>
                    {(t.reportTemplates || []).map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={handleAiAssist} disabled={isAiAssisting}>
                    {isAiAssisting ? 'Analyzing...' : 'AI Assist'}
                  </Button>
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe what happened, who was involved, and nearby landmarks..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="min-h-[130px]"
                  required
                />
                <p className="text-xs text-neutral-500">Keep it factual: what happened, where, and when.</p>
                {(aiAssist.summary || (aiAssist.hashtags || []).length > 0) && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
                    {aiAssist.summary && <p><strong>AI Summary:</strong> {aiAssist.summary}</p>}
                    <p className="mt-1">
                      <strong>Category:</strong> {aiAssist.category} ({Math.round((aiAssist.category_confidence || 0) * 100)}%)
                      {' | '}
                      <strong>Urgency:</strong> {aiAssist.urgency_hint}
                    </p>
                    {(aiAssist.keywords || []).length > 0 && (
                      <p className="mt-1"><strong>Keywords:</strong> {(aiAssist.keywords || []).join(', ')}</p>
                    )}
                    {(aiAssist.hashtags || []).length > 0 && (
                      <p className="mt-1"><strong>Suggested tags:</strong> {(aiAssist.hashtags || []).join(' ')}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>State *</Label>
                <select
                  className="h-10 w-full rounded-md border border-rose-200 bg-white px-3 text-sm"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                >
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>City *</Label>
                <select
                  className="h-10 w-full rounded-md border border-rose-200 bg-white px-3 text-sm"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                >
                  {cityOptions.length === 0 && <option value="">Select City</option>}
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locality">Sector/Locality *</Label>
                <Input
                  id="locality"
                  placeholder="e.g. Sector 17, MG Road, CP"
                  value={formData.locality}
                  onChange={(e) => handleInputChange('locality', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Specific Place Type</Label>
                <select
                  className="h-10 w-full rounded-md border border-rose-200 bg-white px-3 text-sm"
                  value={formData.placeType}
                  onChange={(e) => handleInputChange('placeType', e.target.value)}
                >
                  {PLACE_TYPE_OPTIONS.map((item) => (
                    <option key={item.value || 'general'} value={item.value}>{item.label}</option>
                  ))}
                </select>
                {formData.placeType && (
                  <p className="text-xs text-rose-700">
                    Specific place reports are auto-tagged for separate clustering and color analysis.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationQuery">Location Preview</Label>
                <Input
                  id="locationQuery"
                  placeholder="Auto-built from sector, city, state"
                  value={formData.locationQuery || buildLocationQuery()}
                  onChange={(e) => handleInputChange('locationQuery', e.target.value)}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-neutral-500">Coordinates are handled in backend. Users only enter area details.</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleResolveLocation} disabled={isGeocodingLocation}>
                    {isGeocodingLocation ? 'Resolving...' : 'Resolve Location'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="areaName">Area Label *</Label>
                <Input
                  id="areaName"
                  placeholder="Auto-filled from location (editable)"
                  value={formData.areaName}
                  onChange={(e) => handleInputChange('areaName', e.target.value)}
                  required
                />
              </div>

              {formData.latitude && formData.longitude && (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  Real location locked from geocoding.
                </p>
              )}

              <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-semibold text-rose-900">FIR Verification Required</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>FIR State *</Label>
                    <select
                      className="h-10 w-full rounded-md border border-rose-200 bg-white px-3 text-sm"
                      value={formData.firState}
                      onChange={(e) => handleInputChange('firState', e.target.value)}
                      disabled
                      required
                    >
                      {stateOptions.map((state) => (
                        <option key={`fir-${state}`} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firDate">FIR Date *</Label>
                    <Input
                      id="firDate"
                      type="date"
                      value={formData.firDate}
                      onChange={(e) => handleInputChange('firDate', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firNumber">FIR Number *</Label>
                    <Input
                      id="firNumber"
                      placeholder="e.g. 123/2026"
                      value={formData.firNumber}
                      onChange={(e) => handleInputChange('firNumber', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firPoliceStation">Police Station *</Label>
                    <Input
                      id="firPoliceStation"
                      placeholder="e.g. Sector 17 Police Station"
                      value={formData.firPoliceStation}
                      onChange={(e) => handleInputChange('firPoliceStation', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleVerifyFirNow} disabled={isVerifyingFir || !firReady}>
                    {isVerifyingFir ? 'Verifying...' : 'Verify FIR Number'}
                  </Button>
                </div>
                {firVerificationMessage && (
                  <p className={`text-xs ${firVerificationStatus.includes('verified') ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {firVerificationMessage}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="firIpcSections">IPC/CrPC Sections (optional)</Label>
                  <Input
                    id="firIpcSections"
                    placeholder="e.g. IPC 379, 356"
                    value={formData.firIpcSections}
                    onChange={(e) => handleInputChange('firIpcSections', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firFile">FIR Document (Optional)</Label>
                  <Input
                    id="firFile"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => handleInputChange('firFile', e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-neutral-500">Optional upload for record keeping.</p>
                </div>
              </div>

              {!firGatePassed ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Verify FIR Number successfully to unlock remaining form fields.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="photo">Evidence Photo (Optional)</Label>
                    <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/40 p-3">
                      <Input
                        id="photo"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleInputChange('photo', e.target.files?.[0] || null)}
                      />
                      <p className="mt-2 text-xs text-neutral-500">Accepted: image formats only.</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50/40 p-3">
                    <Label htmlFor="phone">Phone Number (OTP required) *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+91XXXXXXXXXX"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        required
                      />
                      <Button type="button" variant="outline" onClick={handleSendOtp} disabled={isSendingOtp}>
                        {isSendingOtp ? 'Sending...' : 'Send OTP'}
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                      />
                      <Button type="button" onClick={handleVerifyOtp} disabled={isVerifyingOtp || !otpSessionId}>
                        {isVerifyingOtp ? 'Verifying...' : 'Verify OTP'}
                      </Button>
                    </div>

                    {otpStatus && (
                      <p className={`text-xs ${otpToken ? 'text-emerald-700' : 'text-rose-700'}`}>{otpStatus}</p>
                    )}
                  </div>
                </>
              )}

              {message && (
                <p className={`text-sm ${message.toLowerCase().includes('success') ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {message}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting || !canSubmit || !firGatePassed}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-rose-200 bg-white/95">
            <CardHeader>
              <CardTitle className="text-base">SOS Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-neutral-700">
              <a href="tel:112" className="block">
                <Button type="button" className="w-full">
                  <Phone className="mr-2 h-4 w-4" /> One-tap Emergency Call (112)
                </Button>
              </a>
              <Button type="button" variant="outline" className="w-full" onClick={handleShareSOS} disabled={isSharingLocation}>
                <Share2 className="mr-2 h-4 w-4" />
                {isSharingLocation ? 'Sharing...' : 'Share Live Location'}
              </Button>
              {sosStatus && <p className="text-xs text-rose-700">{sosStatus}</p>}
            </CardContent>
          </Card>

          <Card className="border-rose-100 bg-white/90 backdrop-blur">
            <CardHeader><CardTitle className="text-base">Submission Checklist</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-neutral-700">
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${formData.description.trim() ? 'text-emerald-600' : 'text-neutral-400'}`} />
                Incident description added
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${locationReady ? 'text-emerald-600' : 'text-neutral-400'}`} />
                Real location resolved
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${firReady ? 'text-emerald-600' : 'text-neutral-400'}`} />
                FIR details completed
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${firGatePassed ? 'text-emerald-600' : 'text-neutral-400'}`} />
                FIR verified or provider unavailable
              </p>
              <p className="inline-flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${otpReady ? 'text-emerald-600' : 'text-neutral-400'}`} />
                OTP verified
              </p>
              <p className="inline-flex items-center gap-2"><UploadCloud className="h-4 w-4 text-rose-600" /> Upload evidence when available.</p>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base text-rose-800"><AlertTriangle className="h-4 w-4" /> Emergency</CardTitle></CardHeader>
            <CardContent className="text-sm text-rose-800">
              For immediate danger, contact emergency services first. This platform supports reporting and intelligence aggregation.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ReportPage

