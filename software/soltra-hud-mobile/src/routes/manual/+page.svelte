<script lang="ts">
  import { goto } from "$app/navigation";
  import { publishCmd, mqttStatus } from "$lib/mqttStore";
  import { Settings, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Zap, Power, ShieldAlert, Loader, ChevronLeft } from "lucide-svelte";

  let motorX = 180;
  let motorY = 45;
  let power = true;

  let activeCmd: number | null = $state(null);
  let isPublishing = $state(false);

  function startCmd(cmd: number) {
    if ($mqttStatus !== 'CONNECTED') return;
    activeCmd = cmd;
    isPublishing = true;
    publishCmd(cmd);
    setTimeout(() => { isPublishing = false; }, 500);
  }

  function stopCmd(stopCode: number) {
    activeCmd = null;
    publishCmd(stopCode);
  }

  function emergencyStop() {
    if ($mqttStatus !== 'CONNECTED') return;
    isPublishing = true;
    publishCmd(3);
    setTimeout(() => publishCmd(6), 50);
    setTimeout(() => { isPublishing = false; }, 500);
  }

  const btnClass = "bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl p-4 flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg backdrop-blur-sm";
  
  let disabledControls = $derived($mqttStatus !== 'CONNECTED' || isPublishing);
</script>

<div class="w-full min-h-screen bg-[#0B0F19] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F19] to-black text-slate-300 flex flex-col p-10 box-border font-sans antialiased overflow-y-auto overflow-x-hidden relative custom-scrollbar">
  <!-- Decorative background elements -->
  <div class="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
  <div class="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-red-500/10 blur-[120px] rounded-full pointer-events-none"></div>

  <!-- Header -->
  <div class="flex items-center justify-between border-b border-white/10 pb-6 mb-8 relative z-10">
    <div class="flex items-center gap-4">
      <div class="p-3 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
        <Settings size={28} />
      </div>
      <div>
        <h1 class="text-5xl font-bold text-white tracking-tight">Manual Hardware Override</h1>
        <p class="text-xl text-slate-400 mt-1">Direct actuator control and system diagnostics</p>
      </div>
    </div>
    <button 
      class="flex items-center gap-2 px-8 py-4 text-xl font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-white/10 shadow-lg"
      onclick={() => goto('/')}
    >
      <ChevronLeft size={28} />
      Back to Hub
    </button>
  </div>

  <div class="grid grid-cols-2 gap-8 flex-1 relative z-10">
    <!-- Left: Motor Controls -->
    <div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 relative flex flex-col shadow-2xl">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-3xl font-semibold text-white">Actuator Matrix</h2>
        <div class="px-4 py-1.5 bg-blue-500/20 text-blue-400 text-base font-medium rounded-full border border-blue-500/20">
          X/Y CONTROL
        </div>
      </div>
      
      <div class="flex flex-col items-center justify-center gap-6 flex-1">
         <button class="{btnClass} w-24 h-24 !p-0" disabled={disabledControls}
            onmousedown={() => { motorY = Math.min(90, motorY + 5); startCmd(1); }} 
            onmouseup={() => stopCmd(3)} onmouseleave={() => activeCmd === 1 && stopCmd(3)}><ArrowUp size={40} /></button>
         <div class="flex gap-6 items-center">
            <button class="{btnClass} w-24 h-24 !p-0" disabled={disabledControls}
               onmousedown={() => { motorX = (motorX - 5 + 360) % 360; startCmd(4); }} 
               onmouseup={() => stopCmd(6)} onmouseleave={() => activeCmd === 4 && stopCmd(6)}><ArrowLeft size={40} /></button>
            
            <div class="w-48 h-48 bg-black/40 rounded-full border-4 {disabledControls ? 'border-slate-700 text-slate-500' : 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]'} flex flex-col items-center justify-center text-white transition-all">
              <span class="text-5xl font-bold font-mono">{motorX}&deg;</span>
              <div class="w-16 h-[2px] bg-white/20 my-2"></div>
              <span class="text-3xl font-medium font-mono text-slate-400">{motorY}&deg;</span>
            </div>

            <button class="{btnClass} w-24 h-24 !p-0" disabled={disabledControls}
               onmousedown={() => { motorX = (motorX + 5) % 360; startCmd(5); }} 
               onmouseup={() => stopCmd(6)} onmouseleave={() => activeCmd === 5 && stopCmd(6)}><ArrowRight size={40} /></button>
         </div>
         <button class="{btnClass} w-24 h-24 !p-0" disabled={disabledControls}
            onmousedown={() => { motorY = Math.max(0, motorY - 5); startCmd(2); }} 
            onmouseup={() => stopCmd(3)} onmouseleave={() => activeCmd === 2 && stopCmd(3)}><ArrowDown size={40} /></button>
      </div>

      <div class="mt-8 grid grid-cols-2 gap-4">
         <button disabled={disabledControls} class="{btnClass} text-xl font-bold hover:!bg-blue-500/20 !bg-blue-500/10 !text-blue-400 !border-blue-500/30" onclick={() => { motorX = 180; motorY = 45; startCmd(7); }}>
           {#if isPublishing && activeCmd === 7}
             <Loader size={28} class="mr-3 animate-spin" /> EXECUTING
           {:else}
             <Home size={28} class="mr-3" /> HOME SENSORS
           {/if}
         </button>
         <button disabled={disabledControls} class="{btnClass} text-xl font-bold {power ? 'hover:!bg-emerald-500/20 !bg-emerald-500/10 !text-emerald-400 !border-emerald-500/30' : 'hover:!bg-slate-800'}" onclick={() => { power = !power; startCmd(8); }}>
           {#if isPublishing && activeCmd === 8}
             <Loader size={28} class="mr-3 animate-spin" /> EXECUTING
           {:else}
             <Power size={28} class="mr-3" /> {power ? 'POWER: ON' : 'POWER: OFF'}
           {/if}
         </button>
      </div>
    </div>

    <!-- Right: Diagnostics -->
    <div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col shadow-2xl relative">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-3xl font-semibold text-white">System Diagnostics</h2>
        <div class="flex items-center gap-3 px-4 py-1.5 bg-emerald-500/20 text-emerald-400 text-base font-medium rounded-full border border-emerald-500/20">
          <div class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
          NOMINAL
        </div>
      </div>
      
      <div class="flex flex-col gap-4 font-mono text-xl">
        {#each [
          { label: 'L_ACTUATOR_1', val: 'NOMINAL', color: 'text-emerald-400' },
          { label: 'L_ACTUATOR_2', val: 'NOMINAL', color: 'text-emerald-400' },
          { label: 'VOLTAGE_BUS', val: '24.2V', color: 'text-emerald-400' },
          { label: 'CURRENT_DRAW', val: '1.4A', color: 'text-amber-400' },
          { label: 'TEMP_MOSFET', val: '42°C', color: 'text-emerald-400' }
        ] as item}
          <div class="flex justify-between items-center p-4 bg-black/20 rounded-xl border border-white/5">
            <span class="text-slate-400">{item.label}</span>
            <span class="{item.color} font-bold">{item.val}</span>
          </div>
        {/each}
        
        <div class="mt-6 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl relative overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <div class="text-red-400 font-bold text-xl flex items-center gap-3 mb-3 font-sans">
            <ShieldAlert size={24} /> WARNING: OVERRIDE ACTIVE
          </div>
          <div class="text-lg text-slate-300 leading-relaxed font-sans opacity-90">
            Automatic safety limits have been disengaged. Ensure clearance of all mechanical components before initiating movement.
          </div>
        </div>
        
        <div class="flex-1"></div>
        <button disabled={disabledControls} onclick={emergencyStop} class="mt-8 flex items-center justify-center gap-3 w-full bg-red-500 hover:bg-red-600 text-white font-bold text-2xl rounded-2xl p-6 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] border border-red-400/50">
          {#if isPublishing && activeCmd === 3}
            <Loader size={32} class="animate-spin" /> DISENGAGING...
          {:else}
            <Zap size={32} /> EMERGENCY STOP
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Footer Decoration -->
  <div class="absolute bottom-6 left-10 text-sm text-slate-500 font-mono tracking-widest z-10">
    SYS_VER: 4.2.0-STABLE <span class="opacity-30 mx-2">|</span> HARDWARE_ID: SOLTRA-T1-N1
  </div>
</div>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
