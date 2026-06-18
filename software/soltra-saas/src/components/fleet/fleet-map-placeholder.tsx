'use client'

import type { Site, Node } from '@/lib/types'
import { MapPin } from 'lucide-react'
import { Map, MapMarker, MarkerContent, MarkerPopup, MapControls } from '@/components/ui/mapcn-map-arc'

interface FleetMapProps {
  sites: Site[]
  nodes: (Node & { siteName: string })[]
}

export function FleetMap({ sites, nodes }: FleetMapProps) {
  const sitesWithCoords    = sites.filter((s) => s.lat != null && s.lng != null)
  const sitesWithoutCoords = sites.filter((s) => s.lat == null || s.lng == null)

  const initialViewState = sitesWithCoords.length > 0 
    ? { center: [sitesWithCoords[0].lng!, sitesWithCoords[0].lat!] as [number, number], zoom: 12 }
    : { center: [-98.5795, 39.8283] as [number, number], zoom: 3 };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <MapPin size={14} className="text-emerald-400" />
        <span className="text-sm font-semibold text-zinc-200">Fleet Map</span>
        <span className="text-xs text-zinc-500 font-mono">({sitesWithCoords.length} sites plotted)</span>
      </div>

      {sitesWithCoords.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm text-zinc-500 font-mono">
            No GPS coordinates set for any sites.
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            You can add coordinates via your account settings once a site edit form is available.
          </p>
        </div>
      ) : (
        <div className="h-[400px] w-full relative">
          <Map viewport={initialViewState}>
            {sitesWithCoords.map(site => {
              const nodeCount = nodes.filter(n => n.site_id === site.id).length
              const active = nodes.filter(n => n.site_id === site.id && n.status === 'active').length
              const hasAlert = nodes.some(n => n.site_id === site.id && n.status !== 'active' && n.status !== 'offline')

              const colorClass = active > 0 ? 'bg-emerald-500' : 'bg-zinc-500'
              const ringClass = hasAlert ? 'ring-[3px] ring-red-500/50 ring-offset-2 ring-offset-transparent' : ''
              const pulseClass = active > 0 ? 'animate-ping' : ''

              return (
                <MapMarker
                  key={site.id}
                  longitude={site.lng!}
                  latitude={site.lat!}
                >
                  <MarkerContent>
                    <div className="relative w-4 h-4 cursor-pointer">
                      {/* Pulse */}
                      {active > 0 && (
                        <div className={`absolute inset-0 rounded-full opacity-30 ${colorClass} ${pulseClass} [animation-duration:2s]`} />
                      )}
                      {/* Center */}
                      <div className={`absolute inset-[3px] rounded-full ${colorClass} ${ringClass}`} />
                    </div>
                  </MarkerContent>
                  <MarkerPopup offset={16} closeButton={false} className="bg-zinc-900 border-zinc-800 shadow-xl">
                    <div className="font-mono text-xs text-zinc-200 min-w-[140px]">
                      <strong className="text-sm font-sans block mb-1">{site.name}</strong>
                      <span className="text-zinc-500 block mb-2">{site.timezone}</span>
                      <span className="text-emerald-400">● {active} active</span> <span className="text-zinc-500">/ {nodeCount} total</span>
                    </div>
                  </MarkerPopup>
                </MapMarker>
              )
            })}
            <MapControls position="bottom-right" showZoom showLocate />
          </Map>
        </div>
      )}

      {sitesWithoutCoords.length > 0 && (
        <div className="px-4 pb-4 pt-3 border-t border-zinc-800">
          <p className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-widest">
            Sites without GPS coordinates
          </p>
          <div className="flex flex-wrap gap-2">
            {sitesWithoutCoords.map((site) => (
              <span
                key={site.id}
                className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-400 font-mono"
              >
                {site.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { FleetMap as FleetMapPlaceholder }
