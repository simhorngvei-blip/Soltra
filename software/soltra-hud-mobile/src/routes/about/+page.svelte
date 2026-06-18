<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { telemetry, mqttStatus } from "$lib/mqttStore";
  import { Activity, Server, Stethoscope, ChevronLeft, Wifi, Wind, Sun, Compass, Download } from 'lucide-svelte';

  const TABS = [
    { id: "telemetry", label: "Telemetry", icon: Activity },
    { id: "status", label: "System Status", icon: Server },
    { id: "sensors", label: "Diagnostics", icon: Stethoscope },
  ];

  let activeTab = $state(0);

  // 24-hour Mock Data
  let historicalData = $state(
    Array.from({ length: 24 }).map((_, i) => ({
      hour: i,
      solarYield: Math.max(0, Math.sin((i - 6) * Math.PI / 12) * 1000 + (Math.random() * 100 - 50)),
      windSpeed: 2 + Math.random() * 8
    }))
  );

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowUp") activeTab = Math.max(0, activeTab - 1);
    if (e.key === "ArrowDown") activeTab = Math.min(TABS.length - 1, activeTab + 1);
    if (e.key === "Escape" || e.key === "Backspace") goto('/');
  }

  function exportCSV() {
    const headers = "Hour,SolarYield_W_m2,WindSpeed_m_s\n";
    const rows = historicalData.map(d => `${d.hour}:00,${d.solarYield.toFixed(2)},${d.windSpeed.toFixed(2)}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soltra_telemetry_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Calculate SVG path
  let maxYield = $derived(Math.max(...historicalData.map(d => d.solarYield), 1000));
  let yieldPath = $derived(historicalData.map((d, i) => {
    const x = (i / 23) * 100;
    const y = 100 - (d.solarYield / maxYield) * 100;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' '));
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="w-full h-full bg-[#0B0F19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-black text-slate-300 flex flex-col p-8 box-border font-sans antialiased overflow-y-auto overflow-x-hidden relative custom-scrollbar">
  <!-- Decorative background elements -->
  <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
  <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>

  <!-- Header -->
  <div class="flex items-center justify-between border-b border-white/10 pb-6 mb-8 relative z-10 shrink-0">
    <div>
      <h1 class="text-4xl font-bold text-white tracking-tight uppercase">System Overview</h1>
      <p class="text-lg text-slate-400 mt-1">Real-time telemetry and 24-hour analytics</p>
    </div>
    <div class="flex items-center gap-4">
      <button 
        class="flex items-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-white/10 shadow-lg"
        onclick={() => goto('/')}
      >
        <ChevronLeft size={24} />
        BACK
      </button>
    </div>
  </div>

  <div class="flex flex-1 gap-8 relative z-10 flex-col lg:flex-row pb-12">
    <!-- Sidebar -->
    <div class="w-full lg:w-80 flex flex-col gap-4 shrink-0">
      {#each TABS as tab, i}
        <button 
          class="flex items-center gap-5 px-6 py-5 rounded-2xl transition-all text-left border {activeTab === i ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}"
          onclick={() => activeTab = i}
        >
          <svelte:component this={tab.icon} size={28} class={activeTab === i ? 'text-blue-400' : 'text-slate-400'} />
          <span class="font-bold text-xl">{tab.label}</span>
        </button>
      {/each}
      
      <div class="mt-4 p-6 bg-white/5 border border-white/10 rounded-2xl">
        <div class="text-sm text-slate-500 font-mono tracking-wider mb-3">MQTT LINK</div>
        <div class="flex items-center gap-4">
          <div class="relative flex h-4 w-4">
            {#if $mqttStatus === 'CONNECTED'}
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            {:else}
              <span class="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            {/if}
          </div>
          <span class="text-xl font-bold text-white tracking-widest uppercase">{$mqttStatus}</span>
        </div>
      </div>

      <button 
        class="mt-auto flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold rounded-2xl transition-all border border-emerald-500/30 shadow-lg w-full"
        onclick={exportCSV}
      >
        <Download size={24} />
        EXPORT CSV
      </button>
    </div>

    <!-- Main Content Panel -->
    <div class="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 shadow-2xl flex flex-col gap-8 min-h-[600px]">
      {#if activeTab === 0}
        <!-- Telemetry -->
        <h2 class="text-3xl font-bold text-white tracking-wider uppercase mb-2">Live Telemetry</h2>
        
        <!-- Live Data Grid -->
        <div class="grid grid-cols-2 gap-8">
          <div class="bg-black/20 border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center">
            <Wind size={48} class="text-blue-400 mb-4" />
            <div class="text-lg text-slate-400 font-bold tracking-widest">WIND SPEED</div>
            <div class="text-6xl font-bold text-white mt-4 font-mono">{$telemetry.wind_speed_ms !== undefined ? $telemetry.wind_speed_ms.toFixed(1) : '--'}<span class="text-2xl text-slate-500 ml-2">m/s</span></div>
          </div>
          <div class="bg-black/20 border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center">
            <Sun size={48} class="text-amber-400 mb-4" />
            <div class="text-lg text-slate-400 font-bold tracking-widest">SOLAR YIELD</div>
            <div class="text-6xl font-bold text-white mt-4 font-mono">{$telemetry.irradiance_wm2 !== undefined ? $telemetry.irradiance_wm2.toFixed(1) : '--'}<span class="text-2xl text-slate-500 ml-2">W/m²</span></div>
          </div>
          <div class="bg-black/20 border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center">
            <Compass size={48} class="text-emerald-400 mb-4" />
            <div class="text-lg text-slate-400 font-bold tracking-widest">PANEL AZIMUTH</div>
            <div class="text-6xl font-bold text-white mt-4 font-mono">{$telemetry.pan_angle_deg !== undefined ? $telemetry.pan_angle_deg.toFixed(1) : '--'}&deg;</div>
          </div>
          <div class="bg-black/20 border border-white/5 p-8 rounded-2xl flex flex-col items-center justify-center">
            <Activity size={48} class="text-indigo-400 mb-4" />
            <div class="text-lg text-slate-400 font-bold tracking-widest">LIGHT LEVEL</div>
            <div class="text-6xl font-bold text-white mt-4 font-mono">{$telemetry.lux !== undefined ? $telemetry.lux : '--'}<span class="text-2xl text-slate-500 ml-2">lx</span></div>
          </div>
        </div>

        <!-- 24-Hour Graph -->
        <div class="mt-4 bg-black/20 border border-white/5 p-8 rounded-2xl">
          <div class="text-xl font-bold tracking-widest text-white mb-6 uppercase">24-Hour Yield Graph</div>
          <div class="relative w-full h-48 mt-4 border-b border-l border-white/10 ml-8">
            <!-- Background gradient for chart -->
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(59,130,246,0.3)" />
                <stop offset="100%" stop-color="rgba(59,130,246,0.0)" />
              </linearGradient>
              <path d="{yieldPath} L 100 100 L 0 100 Z" fill="url(#chartGrad)" />
              <path d="{yieldPath}" fill="none" stroke="#3b82f6" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="absolute bottom-0 w-full flex justify-between text-xs text-slate-500 translate-y-6 font-mono pr-4">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div class="absolute -left-14 h-full flex flex-col justify-between text-xs text-slate-500 font-mono items-end w-12">
              <span>{Math.round(maxYield)}</span>
              <span>{Math.round(maxYield / 2)}</span>
              <span>0</span>
            </div>
          </div>
        </div>

      {:else if activeTab === 1}
        <!-- System Status -->
        <h2 class="text-3xl font-bold text-white tracking-wider uppercase mb-6">System Status</h2>
        <div class="flex flex-col gap-6">
          <div class="p-8 bg-black/20 border border-white/5 rounded-2xl flex items-center justify-between">
            <div>
              <div class="text-lg text-slate-400 font-bold tracking-widest mb-2">TRACKER STATUS</div>
              <div class="text-4xl font-bold text-white uppercase">{$telemetry.status}</div>
            </div>
            <div class="h-20 w-20 rounded-full flex items-center justify-center {$telemetry.status === 'tracking' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
              <Server size={40} />
            </div>
          </div>
          <div class="p-8 bg-black/20 border border-white/5 rounded-2xl flex items-center justify-between">
            <div>
              <div class="text-lg text-slate-400 font-bold tracking-widest mb-2">WIND ALERT</div>
              <div class="text-4xl font-bold {$telemetry.wind_alert ? 'text-red-400' : 'text-emerald-400'} uppercase">{$telemetry.wind_alert ? 'ALERT ACTIVE' : 'NOMINAL'}</div>
            </div>
            <div class="h-20 w-20 rounded-full flex items-center justify-center {$telemetry.wind_alert ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}">
              <Wind size={40} />
            </div>
          </div>
          <div class="p-8 bg-black/20 border border-white/5 rounded-2xl flex items-center justify-between">
            <div>
              <div class="text-lg text-slate-400 font-bold tracking-widest mb-2">SENSOR NODE</div>
              <div class="text-4xl font-bold text-white uppercase">{$telemetry.node_mac ? 'ONLINE' : 'OFFLINE'}</div>
            </div>
            <div class="h-20 w-20 rounded-full flex items-center justify-center {$telemetry.node_mac ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}">
              <Wifi size={40} />
            </div>
          </div>
        </div>
      {:else}
        <!-- Diagnostics -->
        <h2 class="text-3xl font-bold text-white tracking-wider uppercase mb-6">Diagnostics Log</h2>
        <div class="flex-1 bg-black/30 border border-white/5 rounded-2xl p-8 font-mono text-lg overflow-y-auto custom-scrollbar">
          <div class="text-emerald-400 mb-6 text-xl">>> INITIATING DIAGNOSTIC SCAN...</div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">SYSTEM VERSION</span><span class="text-white font-bold">4.2.0</span></div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">CORE TEMPERATURE</span><span class="text-emerald-400 font-bold">42&deg;C (OPTIMAL)</span></div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">MEMORY UTILIZATION</span><span class="text-white font-bold">18.4%</span></div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">ACTUATOR X RESPONSE</span><span class="text-emerald-400 font-bold">NOMINAL (12ms)</span></div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">ACTUATOR Y RESPONSE</span><span class="text-emerald-400 font-bold">NOMINAL (14ms)</span></div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">NETWORK LATENCY</span><span class="text-white font-bold">8ms</span></div>
          <div class="flex justify-between border-b border-white/10 py-4"><span class="text-slate-300">POWER BUS VOLTAGE</span><span class="text-white font-bold">24.2V</span></div>
          <div class="text-blue-400 mt-8 text-xl">>> ALL SYSTEMS RESPONSIVE</div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.2);
    border-radius: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.4);
    border-radius: 6px;
  }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background: rgba(59, 130, 246, 0.8);
  }
</style>
