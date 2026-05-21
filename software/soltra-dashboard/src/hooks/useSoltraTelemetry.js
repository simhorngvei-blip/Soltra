import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ─── DB Column → UI field name mapping ───────────────────────────────────────
// DB schema uses:  wind_speed, irradiance, pan_angle, tilt_angle, recorded_at
// App.jsx reads:   .wind,       .irradiance, .azimuth
//
// The normalize() function translates DB rows to the shape App.jsx expects.
// This approach keeps App.jsx unchanged while fixing the mismatch.

function normalize(row) {
  return {
    wind:        Number(row.wind_speed ?? 0),
    irradiance:  Number(row.irradiance ?? 0),
    azimuth:     Number(row.pan_angle  ?? 0),  // pan_angle is the horizontal/azimuth axis
    tilt_angle:  Number(row.tilt_angle ?? 0),
    wind_alert:  Boolean(row.wind_alert),
    node_status: row.node_status ?? null,
    created_at:  row.recorded_at ?? row.created_at,
  };
}

function makeFallbackRow() {
  return {
    wind:       Number((5 + Math.random() * 15).toFixed(1)),
    irradiance: Math.floor(200 + Math.random() * 800),
    azimuth:    Math.floor(90 + Math.sin(Date.now() / 1000) * 30),
    tilt_angle: 0,
    wind_alert: false,
    node_status: 'SIMULATION',
    created_at:  new Date().toISOString(),
  };
}

// ─── Supabase client (lazy — only if env vars are present) ───────────────────
const supabaseUrl      = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSoltraTelemetry() {
  const [telemetry, setTelemetry]             = useState({ wind: 0, irradiance: 0, azimuth: 0 });
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const simulationRef                         = useRef(null);

  useEffect(() => {
    let isSubscribed = true;

    // ── Simulation fallback (no Supabase configured) ──────────────────────
    const startSimulation = () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        ...makeFallbackRow(),
        created_at: new Date(Date.now() - (20 - i) * 5000).toISOString(),
        irradiance: Math.floor(200 + Math.random() * 800),
        azimuth:    Math.floor(90 + Math.sin(i * 0.1) * 30),
      }));
      setTelemetryHistory(history);
      setTelemetry(history[19]);

      simulationRef.current = setInterval(() => {
        if (!isSubscribed) return;
        const newRow = makeFallbackRow();
        setTelemetry(newRow);
        setTelemetryHistory(prev => [...prev.slice(-19), newRow]);
      }, 1000);

      setLoading(false);
    };

    // ── Fetch last 20 records from DB ──────────────────────────────────────
    const fetchLatest = async () => {
      if (!supabase) {
        startSimulation();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('telemetry')
          .select('wind_speed, irradiance, pan_angle, tilt_angle, wind_alert, node_status, recorded_at')
          .order('recorded_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        if (data && data.length > 0) {
          const normalized = data.map(normalize).reverse(); // oldest-first for chart
          setTelemetry(normalized[normalized.length - 1]);
          setTelemetryHistory(normalized);
          setLoading(false);
        } else {
          // No rows yet — use simulation until hardware sends data
          startSimulation();
        }
      } catch (err) {
        console.error('[useSoltraTelemetry] Fetch error:', err);
        startSimulation();
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

            // Stop simulation as soon as real data arrives
            if (simulationRef.current) {
              clearInterval(simulationRef.current);
              simulationRef.current = null;
            }

            const normalized = normalize(payload.new);
            setTelemetry(normalized);
            setTelemetryHistory(prev => [...prev.slice(-19), normalized]);
            setLoading(false);
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[useSoltraTelemetry] Realtime channel error — falling back to simulation');
          }
        });
    }

    return () => {
      isSubscribed = false;
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  return { telemetry, telemetryHistory, loading };
}
