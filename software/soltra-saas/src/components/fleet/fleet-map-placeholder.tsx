'use client'

import { useEffect, useRef } from 'react'
import type { Site, Node } from '@/lib/types'
import { MapPin } from 'lucide-react'

interface FleetMapProps {
  sites: Site[]
  nodes: (Node & { siteName: string })[]
}

// ─── Fleet Map ────────────────────────────────────────────────────────────────
// Uses Leaflet (react-leaflet) to display sites on a real map.
// Sites without lat/lng are shown in a side-list instead.
export function FleetMap({ sites, nodes }: FleetMapProps) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)

  const sitesWithCoords    = sites.filter((s) => s.lat != null && s.lng != null)
  const sitesWithoutCoords = sites.filter((s) => s.lat == null || s.lng == null)

  useEffect(() => {
    if (!mapRef.current || sitesWithCoords.length === 0) return

    // Dynamically import Leaflet (avoids SSR issues since this is a client component)
    import('leaflet').then((L) => {
      // Prevent double-initialization
      if (leafletRef.current) {
        leafletRef.current.remove()
      }

      // Fix Leaflet default marker icon path (Webpack asset handling)
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // Center on first site, or default to world view
      const firstSite = sitesWithCoords[0]
      const map = L.map(mapRef.current!, {
        center:        [firstSite.lat!, firstSite.lng!],
        zoom:          12,
        zoomControl:   true,
        scrollWheelZoom: true,
      })

      leafletRef.current = map

      // Dark tile layer matching the app's dark theme
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains:  'abcd',
        maxZoom:     20,
      }).addTo(map)

      // Add a marker for each site
      for (const site of sitesWithCoords) {
        const nodeCount = nodes.filter((n) => n.site_id === site.id).length
        const active    = nodes.filter((n) => n.site_id === site.id && n.status === 'active').length

        const marker = L.marker([site.lat!, site.lng!]).addTo(map)
        marker.bindPopup(`
          <div style="font-family: monospace; font-size: 12px; color: #111;">
            <strong style="font-size: 14px;">${site.name}</strong><br/>
            <span style="color: #555;">${site.timezone}</span><br/>
            <span style="color: #16a34a;">● ${active} active</span> / ${nodeCount} total nodes
          </div>
        `)
      }

      // Fit map to show all markers if multiple sites
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
  }, [sitesWithCoords.length])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <MapPin size={14} className="text-emerald-400" />
        <span className="text-sm font-semibold text-zinc-200">Fleet Map</span>
        <span className="text-xs text-zinc-500 font-mono">({sitesWithCoords.length} sites plotted)</span>
      </div>

      {sitesWithCoords.length === 0 ? (
        /* No GPS data available */
        <div className="p-8 text-center">
          <p className="text-sm text-zinc-500 font-mono">
            No GPS coordinates set for any sites.
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Edit site coordinates in the Supabase dashboard or add a site edit form.
          </p>
        </div>
      ) : (
        <>
          {/* Leaflet map container — must have explicit height */}
          <div ref={mapRef} className="h-72 w-full" />

          {/* Import Leaflet CSS via style tag */}
          <style>{`
            .leaflet-container { background: #09090b; }
            .leaflet-popup-content-wrapper { border-radius: 8px; }
          `}</style>
        </>
      )}

      {/* Sites without coordinates */}
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

// Keep the old export name for backward compatibility with fleet/page.tsx
export { FleetMap as FleetMapPlaceholder }
