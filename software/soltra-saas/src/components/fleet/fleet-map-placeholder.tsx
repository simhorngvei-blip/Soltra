'use client'

import { useEffect, useRef } from 'react'
import type { Site, Node } from '@/lib/types'
import { MapPin } from 'lucide-react'

interface FleetMapProps {
  sites: Site[]
  nodes: (Node & { siteName: string })[]
}

// ─── Fleet Map ────────────────────────────────────────────────────────────────
export function FleetMap({ sites, nodes }: FleetMapProps) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)

  const sitesWithCoords    = sites.filter((s) => s.lat != null && s.lng != null)
  const sitesWithoutCoords = sites.filter((s) => s.lat == null || s.lng == null)

  useEffect(() => {
    if (!mapRef.current || sitesWithCoords.length === 0) return

    import('leaflet').then((L) => {
      if (leafletRef.current) {
        leafletRef.current.remove()
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const firstSite = sitesWithCoords[0]
      const map = L.map(mapRef.current!, {
        center:          [firstSite.lat!, firstSite.lng!],
        zoom:            12,
        zoomControl:     true,
        scrollWheelZoom: true,
      })

      leafletRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains:  'abcd',
        maxZoom:     20,
      }).addTo(map)

      for (const site of sitesWithCoords) {
        const nodeCount  = nodes.filter((n) => n.site_id === site.id).length
        const active     = nodes.filter((n) => n.site_id === site.id && n.status === 'active').length
        const hasAlert   = nodes.some((n) => n.site_id === site.id && n.status !== 'active' && n.status !== 'offline')

        // Custom pulsing marker based on status
        const color  = active > 0 ? '#10b981' : '#52525b'
        const pulse  = active > 0 ? 'animation: soltra-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;' : ''
        const ring   = hasAlert   ? 'box-shadow: 0 0 0 4px rgba(239,68,68,0.4);' : ''

        const icon = L.divIcon({
          html: `
            <div style="position:relative;width:16px;height:16px;">
              <div style="
                position:absolute;inset:0;border-radius:50%;
                background:${color};opacity:0.3;${pulse}
              "></div>
              <div style="
                position:absolute;inset:3px;border-radius:50%;
                background:${color};${ring}
              "></div>
            </div>
            <style>
              @keyframes soltra-ping {
                75%,100% { transform: scale(2.5); opacity: 0; }
              }
            </style>
          `,
          className: '',
          iconSize:  [16, 16],
          iconAnchor:[8, 8],
        })

        const marker = L.marker([site.lat!, site.lng!], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family: monospace; font-size: 12px; color: #111;">
            <strong style="font-size: 14px;">${site.name}</strong><br/>
            <span style="color: #555;">${site.timezone}</span><br/>
            <span style="color: #059669;">● ${active} active</span> / ${nodeCount} total
          </div>
        `)
      }

      if (sitesWithCoords.length > 1) {
        const group = L.featureGroup(
          sitesWithCoords.map((s) => L.marker([s.lat!, s.lng!]))
        )
        map.fitBounds(group.getBounds().pad(0.2))
      }
    })

    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
      }
    }
  }, [sitesWithCoords.length]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <>
          <div ref={mapRef} className="h-72 w-full" />
          <style>{`
            .leaflet-container { background: #09090b; }
            .leaflet-popup-content-wrapper { border-radius: 8px; }
          `}</style>
        </>
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
