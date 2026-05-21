import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export function useSoltraTelemetry() {
  const [telemetry, setTelemetry] = useState({ wind: 0, irradiance: 0, azimuth: 0 });
  const [loading, setLoading] = useState(true);
  const simulationRef = useRef(null);

  useEffect(() => {
    let isSubscribed = true;

    const startSimulation = () => {
      setTelemetry({
        wind: (5 + Math.random() * 15).toFixed(1),
        irradiance: Math.floor(200 + Math.random() * 800),
        azimuth: Math.floor(90 + Math.sin(0) * 30),
      });

      simulationRef.current = setInterval(() => {
        if (!isSubscribed) return;
        setTelemetry({
          wind: (5 + Math.random() * 15).toFixed(1),
          irradiance: Math.floor(200 + Math.random() * 800),
          azimuth: Math.floor(90 + Math.sin(Date.now() / 1000) * 30),
        });
      }, 1000);
      setLoading(false);
    };

    const fetchLatest = async () => {
      if (!supabase) {
        startSimulation();
        return;
      }

      try {
        const { data, error } = await supabase
          .from('telemetry')
          .select('wind, irradiance, azimuth, created_at')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (data && data.length > 0) {
          setTelemetry(data[0]);
          setLoading(false);
        } else {
          startSimulation();
        }
      } catch (err) {
        console.error('Error fetching telemetry:', err);
        startSimulation();
      }
    };

    fetchLatest();

    let channel = null;
    if (supabase) {
      channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'telemetry' },
          (payload) => {
            if (simulationRef.current) {
              clearInterval(simulationRef.current);
              simulationRef.current = null;
            }
            setTelemetry(payload.new);
          }
        )
        .subscribe();
    }

    return () => {
      isSubscribed = false;
      if (simulationRef.current) clearInterval(simulationRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { telemetry, loading };
}
