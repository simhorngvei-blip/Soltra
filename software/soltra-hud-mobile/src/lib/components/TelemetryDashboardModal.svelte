<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { telemetry, mqttStatus } from '$lib/mqttStore';

  let { onClose } = $props();

  const isConnected = $derived($mqttStatus === 'CONNECTED');
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md" transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={onClose}></div>
  
  <div class="relative bg-bg/95 border border-[#00d9ff]/30 border-t-4 border-t-[#00d9ff] p-8 w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto z-10 font-mono shadow-[0_0_30px_rgba(0,217,255,0.15)]" transition:scale={{ start: 0.9, duration: 250 }}>
    
    <!-- Header -->
    <div class="flex justify-between items-center mb-8 border-b-2 border-primary pb-4">
      <div class="flex items-center gap-3">
        <iconify-icon icon="lucide:activity" class="text-[#00d9ff] text-3xl"></iconify-icon>
        <span class="text-white text-3xl italic font-anton tracking-widest uppercase text-shadow-under">Telemetry Dashboard</span>
        <div class="ml-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 border border-[#00d9ff]/30 rounded-sm">
          <div class="w-3 h-3 rounded-full {isConnected ? 'bg-[#00d9ff] animate-pulse' : 'bg-[#ff2a2a]'}"></div>
          <span class="text-sm font-bold {isConnected ? 'text-[#00d9ff]' : 'text-[#ff2a2a]'}">{$mqttStatus}</span>
        </div>
      </div>
      <button type="button" onclick={onClose} class="text-[#00d9ff] hover:text-white transition-colors cursor-pointer">
        <iconify-icon icon="lucide:x" class="text-4xl"></iconify-icon>
      </button>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
      
      <!-- Solar Irradiance -->
      <div class="bg-black/60 border border-primary/20 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <iconify-icon icon="lucide:sun" class="absolute -right-4 -top-4 text-[8rem] text-primary/10"></iconify-icon>
        <div class="text-primary text-base font-bold tracking-widest mb-3 z-10">IRRADIANCE</div>
        <div class="text-6xl font-bold text-white z-10 flex items-baseline gap-2">
          {$telemetry.irradiance_wm2 != null ? $telemetry.irradiance_wm2.toFixed(0) : '--'}
          <span class="text-2xl text-primary font-normal">W/m²</span>
        </div>
      </div>

      <!-- True Lux -->
      <div class="bg-black/60 border border-primary/20 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <iconify-icon icon="lucide:eye" class="absolute -right-4 -top-4 text-[8rem] text-primary/10"></iconify-icon>
        <div class="text-primary text-base font-bold tracking-widest mb-3 z-10">TRUE LUX</div>
        <div class="text-6xl font-bold text-white z-10 flex items-baseline gap-2">
          {$telemetry.lux != null ? $telemetry.lux : '--'}
          <span class="text-2xl text-primary font-normal">lx</span>
        </div>
      </div>

      <!-- Battery -->
      <div class="bg-black/60 border border-primary/20 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <iconify-icon icon="lucide:battery-charging" class="absolute -right-4 -top-4 text-[8rem] text-[#00ff41]/10"></iconify-icon>
        <div class="text-primary text-base font-bold tracking-widest mb-3 z-10">BATTERY</div>
        <div class="text-6xl font-bold z-10 flex items-baseline gap-2 {$telemetry.battery_pct > 20 ? 'text-[#00ff41]' : 'text-[#ff2a2a]'}">
          {$telemetry.battery_pct != null ? $telemetry.battery_pct.toFixed(0) : '--'}
          <span class="text-2xl font-normal">%</span>
        </div>
        <div class="w-full h-3 bg-black/80 mt-6 border border-primary/30 relative overflow-hidden">
          <div class="absolute top-0 left-0 h-full {$telemetry.battery_pct > 20 ? 'bg-[#00ff41]' : 'bg-[#ff2a2a]'}" style="width: {$telemetry.battery_pct || 0}%"></div>
        </div>
      </div>

      <!-- Wind Speed -->
      <div class="bg-black/60 border border-primary/20 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <iconify-icon icon="lucide:wind" class="absolute -right-4 -top-4 text-[8rem] text-primary/10"></iconify-icon>
        <div class="text-primary text-base font-bold tracking-widest mb-3 z-10">WIND SPEED</div>
        <div class="text-6xl font-bold text-white z-10 flex items-baseline gap-2">
          {$telemetry.wind_speed_ms != null ? $telemetry.wind_speed_ms.toFixed(1) : '--'}
          <span class="text-2xl text-primary font-normal">m/s</span>
        </div>
      </div>

      <!-- Panel Azimuth -->
      <div class="bg-black/60 border border-primary/20 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <iconify-icon icon="lucide:compass" class="absolute -right-4 -top-4 text-[8rem] text-primary/10"></iconify-icon>
        <div class="text-primary text-base font-bold tracking-widest mb-3 z-10">PANEL ANGLE</div>
        <div class="text-6xl font-bold text-white z-10 flex items-baseline gap-2">
          {$telemetry.pan_angle_deg != null ? $telemetry.pan_angle_deg.toFixed(1) : '--'}
          <span class="text-2xl text-primary font-normal">°</span>
        </div>
      </div>

      <!-- Status Code -->
      <div class="bg-black/60 border border-primary/20 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <iconify-icon icon="lucide:cpu" class="absolute -right-4 -top-4 text-[8rem] text-primary/10"></iconify-icon>
        <div class="text-primary text-base font-bold tracking-widest mb-3 z-10">SYSTEM STATUS</div>
        <div class="text-3xl font-bold text-white z-10 flex items-baseline gap-2 text-center mt-3 uppercase tracking-widest">
          {$telemetry.status || '--'}
        </div>
      </div>
      
    </div>

  </div>
</div>
