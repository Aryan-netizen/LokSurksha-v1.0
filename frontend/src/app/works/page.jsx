import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, CircleDot, FileText, Phone, Shield, Sparkles, Timer } from 'lucide-react'

const steps = [
  {
    icon: FileText,
    title: 'Create Report',
    eta: '1-2 min',
    description: 'Select incident type, add description, and enter area details (state, city, sector/locality).',
    points: ['Smart tags suggested automatically', 'Current or manual location flow', 'Evidence upload supported'],
  },
  {
    icon: Phone,
    title: 'Phone OTP Verification',
    eta: '15-30 sec',
    description: 'Submit is locked until OTP is verified. This blocks most fake and bot traffic.',
    points: ['Twilio OTP delivery', 'Session-bound verification', 'Invalid attempts rejected'],
  },
  {
    icon: Shield,
    title: 'Backend Validation',
    eta: 'Instant',
    description: 'Server validates payload, anti-spam checks, and stores normalized area metadata for analytics.',
    points: ['Duplicate pattern checks', 'Rate-limit controls', 'Area-to-coordinate resolution'],
  },
  {
    icon: CheckCircle2,
    title: 'Live Intelligence Update',
    eta: 'Real-time',
    description: 'Feed, heatmap, safety index, and route safety modules consume the new record automatically.',
    points: ['Hotspot intensity updates', 'Analytics trends recalculate', 'Cluster tags improve grouping'],
  },
]

const trustItems = [
  'OTP-gated reporting',
  'Backend validation + anti-spam pipeline',
  'Location normalized as area-first input',
  'Live updates across Feed / Heatmap / Safety',
]

export default function HowItWorksPage() {
  return (
    <div className="relative overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(239,68,68,0.1),transparent_35%),radial-gradient(circle_at_90%_15%,rgba(59,130,246,0.08),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,1))]" />

      <div className="mx-auto max-w-6xl">
        <section className="mb-8 rounded-3xl border border-rose-100 bg-white/90 p-8 shadow-sm backdrop-blur">
          <Badge variant="secondary" className="mb-4 border border-rose-200 bg-rose-50 text-rose-700">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Platform Flow
          </Badge>
          <h1 className="text-3xl font-bold text-slate-900 md:text-5xl">How LokSurksha Works</h1>
          <p className="mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
            One clean reporting flow: collect incident details, verify authenticity with OTP, validate on backend,
            then push live updates into feed, heatmap, analytics, and route safety.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/report">
              <Button size="lg">Report Incident</Button>
            </Link>
            <Link href="/heatmap">
              <Button variant="outline" size="lg">Open Heatmap</Button>
            </Link>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <Card key={step.title} className="surface-card surface-card-hover relative overflow-hidden">
              <div className="absolute right-4 top-4 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                Step {index + 1}
              </div>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="rounded-xl bg-rose-50 p-2 text-rose-700">
                    <step.icon className="h-5 w-5" />
                  </span>
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600">{step.description}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Timer className="h-3.5 w-3.5" /> {step.eta}
                </p>
                <div className="mt-4 space-y-2">
                  {step.points.map((point) => (
                    <p key={point} className="flex items-start gap-2 text-sm text-slate-700">
                      <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                      {point}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mb-8 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">Trust And Quality Layer</h2>
          <p className="mt-2 text-sm text-slate-600">
            Reports are accepted only after verification and checks to reduce false submissions.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm text-slate-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white p-6 text-center">
          <h3 className="text-2xl font-bold text-slate-900">Ready To Use It Live?</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Submit a report and instantly inspect how risk clusters, feed entries, and safety modules react in real time.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/report">
              <Button size="lg">File Report</Button>
            </Link>
            <Link href="/feed">
              <Button variant="outline" size="lg">View Live Feed</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
