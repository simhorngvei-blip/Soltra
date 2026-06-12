import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ─── DB Column → UI field name mapping ───────────────────────────────────────
function normalize(row) {
  return {
    wind:        Number(row.wind_speed_ms ?? 0),
    irradiance:  Number(row.irradiance_wm2 ?? 0),
    azimuth:     Number(row.pan_angle_deg  ?? 0),
    tilt_angle:  Number(row.tilt_angle_deg ?? 0),
    lux:         Number(row.lux ?? 0),
    uv_index:    Number(row.uv_index ?? 0),
    battery_pct: Number(row.battery_pct ?? 0),
    humidity_pct: Number(row.humidity_pct ?? 0),
    power_watts: Number(row.power_watts ?? 0),
    panel_volts: Number(row.panel_volts ?? 0),
    wind_alert:  Boolean(row.wind_alert),
    node_status: row.node_status ?? null,
    created_at:  row.recorded_at ?? row.created_at,
  };
}

// ─── Supabase client (lazy — only if env vars are present) ───────────────────
const supabaseUrl      = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('YOUR-PROD-PROJECT-ID')) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSoltraTelemetry() {
  const [telemetry, setTelemetry]             = useState({ wind: 0, irradiance: 0, azimuth: 0 });
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [sysError, setSysError]               = useState(null);

  useEffect(() => {
    let isSubscribed = true;

    const fetchLatest = async () => {
      if (!supabase) {
        setSysError("SYSTEM OFFLINE: DATABASE NOT CONFIGURED");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('telemetry')
          .select('wind_speed_ms, irradiance_wm2, lux, uv_index, battery_pct, humidity_pct, power_watts, panel_volts, pan_angle_deg, tilt_angle_deg, wind_alert, node_status, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        if (data && data.length > 0) {
          const normalized = data.map(normalize).reverse();
          setTelemetry(normalized[normalized.length - 1]);
          setTelemetryHistory(normalized);
        }
        setLoading(false);
      } catch (err) {
        console.error('[useSoltraTelemetry] Fetch error:', err);
        setSysError("SYSTEM OFFLINE: DATABASE UNREACHABLE");
        setLoading(false);
      }
    };

    fetchLatest();

    // ── Supabase Realtime subscription ─────────────────────────────────────
    let channel = null;
    if (supabase) {
      channel = supabase
        .channel('soltra-dashboard-telemetry')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'telemetry' },
          (payload) => {
            if (!isSubscribed) return;
            setSysError(null); // Clear errors if real data starts flowing
            const normalized = normalize(payload.new);
            setTelemetry(normalized);
            setTelemetryHistory(prev => [...prev.slice(-19), normalized]);
            setLoading(false);
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useSoltraTelemetry] Realtime channel error');
            setSysError("SYSTEM OFFLINE: REALTIME LINK LOST");
          }
        });
    }

    return () => {
      isSubscribed = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  return { telemetry, telemetryHistory, loading, sysError };
}
