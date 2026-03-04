'use client'

import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import NavBar from './NavBar'
import GlobalAlertStrip from './GlobalAlertStrip'

const BRAND_NAME = 'LokSurksha'
const TAGLINES = ['Report Faster', 'Detect Hotspots', 'Protect Communities']

export default function AppShell({ children }) {
  const [typed, setTyped] = useState('')
  const [showIntro, setShowIntro] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const [taglineIndex, setTaglineIndex] = useState(0)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setTyped(BRAND_NAME)
      setTimeout(() => setShowIntro(false), 220)
      return
    }

    let index = 0
    const typeTimer = setInterval(() => {
      index += 1
      setTyped(BRAND_NAME.slice(0, index))
      if (index >= BRAND_NAME.length) {
        clearInterval(typeTimer)
        setTimeout(() => {
          setIsExiting(true)
          setTimeout(() => setShowIntro(false), 650)
        }, 500)
      }
    }, 110)

    return () => clearInterval(typeTimer)
  }, [])

  useEffect(() => {
    if (!showIntro || isExiting) return undefined
    const ticker = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % TAGLINES.length)
    }, 720)
    return () => clearInterval(ticker)
  }, [showIntro, isExiting])

  const closeIntro = () => {
    if (!showIntro) return
    setIsExiting(true)
    setTimeout(() => setShowIntro(false), 650)
  }

  return (
    <>
      {showIntro && (
        <div className={`intro-screen ${isExiting ? 'intro-screen-exit' : ''}`}>
          <div className="intro-grid" />
          <div className="intro-scanline" />
          <div className="intro-glow intro-glow-left" />
          <div className="intro-glow intro-glow-right" />
          <div className="intro-orb" />
          <div className="intro-content">
            <span className="intro-logo-wrap">
              <Shield className="h-7 w-7" />
            </span>
            <h1 className="intro-title">
              {typed}
              <span className="intro-caret" />
            </h1>
            <p className="intro-tagline">{TAGLINES[taglineIndex]}</p>
            <p className="intro-subtitle">Community Safety Intelligence</p>
            <div className="intro-progress-track">
              <div className="intro-progress-bar" />
            </div>
            <button type="button" className="intro-skip" onClick={closeIntro}>
              Skip
            </button>
          </div>
        </div>
      )}

      <div
        className={`transition-all duration-700 ${showIntro ? 'pointer-events-none translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
      >
        <NavBar />
        <GlobalAlertStrip />
        <main className="pb-10">{children}</main>
      </div>
    </>
  )
}
