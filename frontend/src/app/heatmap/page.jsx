import Map from './map'

export default function HeatmapPage() {
  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-red-950 via-red-800 to-rose-600 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold">Live Crime Heatmap</h1>
          <p className="mt-1 text-sm text-rose-100">Play trend timeline with smooth transitions, inspect multiple hotspots, and switch between density and point views.</p>
        </div>

        <Map />
      </div>
    </div>
  )
}

