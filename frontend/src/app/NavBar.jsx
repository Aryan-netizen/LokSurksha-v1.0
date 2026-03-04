'use client'

import classNames from 'classnames'
import { Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'
import { useLanguage } from '@/lib/i18n'

const NavBar = () => {
  const currentpath = usePathname()
  const { language, setLanguage, t } = useLanguage()
  const routes = [
    { title: t.nav.report, href: '/report' },
    { title: t.nav.feed, href: '/feed' },
    { title: t.nav.heatmap, href: '/heatmap' },
    { title: t.nav.analytics, href: '/analytic' },
    { title: t.nav.safety, href: '/safety' },
    { title: t.nav.howItWorks, href: '/works' },
  ]

  return (
    <nav className='sticky top-0 z-50 border-b border-rose-100/80 bg-white/90 px-4 py-3 shadow-[0_1px_0_rgba(127,29,29,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/75'>
      <div className='mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <Link href='/' className='inline-flex w-fit items-center gap-2 rounded-full border border-rose-100 bg-[linear-gradient(180deg,#fff1f2,#ffffff)] px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm'>
          <Shield className='h-4 w-4' />
          LokSurksha
        </Link>

        <ul className='flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-end sm:overflow-visible'>
          {routes.map((route) => {
            const routePath = route.href.split('#')[0]
            const isActive = routePath === currentpath
            return (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className={classNames(
                    'whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-all duration-200',
                    isActive
                      ? 'bg-[linear-gradient(135deg,#dc2626,#e11d48)] text-white shadow-sm shadow-red-500/30'
                      : 'text-slate-600 hover:bg-rose-50 hover:text-slate-900'
                  )}
                >
                  {route.title}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type='button'
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className='rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-rose-50'
            >
              {language === 'en' ? 'EN | HI' : 'HI | EN'}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default NavBar

