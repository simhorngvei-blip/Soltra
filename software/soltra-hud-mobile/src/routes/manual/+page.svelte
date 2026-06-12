<script lang="ts">
  import { goto } from "$app/navigation";
  import { publishCmd, mqttStatus } from "$lib/mqttStore";
  import { Settings, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, Zap, Power, ShieldAlert, Loader } from "lucide-svelte";

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

  const btnClass = "bg-[#ff2a2a]/10 border border-[#ff2a2a]/40 text-[#ff2a2a] p-3 flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed";
  
  let disabledControls = $derived($mqttStatus !== 'CONNECTED' || isPublishing);
</script>

<div class="w-full h-full bg-black text-[#00d9ff] flex flex-col p-10 box-border" style="font-family: 'Anton', sans-serif; letter-spacing: 2px;">
  <!-- Header -->
  <div class="flex justify-between border-b-2 border-[#ff2a2a] pb-5 mb-10">
    <div class="text-3xl italic flex items-center gap-3">
      <Settings />
      MANUAL HARDWARE OVERRIDE
    </div>
    <button 
      class="{btnClass} !bg-[#ff2a2a] !text-white !px-6 !py-2"
      onclick={() => goto('/')}
    >
      EXIT TO HUB
    </button>
  </div>

  <div class="grid grid-cols-2 gap-10 flex-1">
    <!-- Left: Motor Controls -->
    <div class="bg-[#000a14]/80 border border-[#00d9ff]/20 p-8 relative">
      <div class="text-xl text-white mb-8 border-l-4 border-[#ff2a2a] pl-3">ACTUATOR MATRIX</div>
      
      <div class="flex flex-col items-center gap-5">
         <button class="{btnClass} hover:bg-[#ff2a2a]/20" disabled={disabledControls}
            onmousedown={() => { motorY = Math.min(90, motorY + 5); startCmd(1); }} 
            onmouseup={() => stopCmd(3)} onmouseleave={() => activeCmd === 1 && stopCmd(3)}><ArrowUp /></button>
         <div class="flex gap-5">
            <button class="{btnClass} hover:bg-[#ff2a2a]/20" disabled={disabledControls}
               onmousedown={() => { motorX = (motorX - 5 + 360) % 360; startCmd(4); }} 
               onmouseup={() => stopCmd(6)} onmouseleave={() => activeCmd === 4 && stopCmd(6)}><ArrowLeft /></button>
            <div class="w-30 h-30 border-2 border-dashed {disabledControls ? 'border-gray-600 text-gray-500' : 'border-[#00d9ff]'} flex items-center justify-center text-2xl">
              {motorX}° / {motorY}°
            </div>
            <button class="{btnClass} hover:bg-[#ff2a2a]/20" disabled={disabledControls}
               onmousedown={() => { motorX = (motorX + 5) % 360; startCmd(5); }} 
               onmouseup={() => stopCmd(6)} onmouseleave={() => activeCmd === 5 && stopCmd(6)}><ArrowRight /></button>
         </div>
         <button class="{btnClass} hover:bg-[#ff2a2a]/20" disabled={disabledControls}
            onmousedown={() => { motorY = Math.max(0, motorY - 5); startCmd(2); }} 
            onmouseup={() => stopCmd(3)} onmouseleave={() => activeCmd === 2 && stopCmd(3)}><ArrowDown /></button>
      </div>

      <div class="mt-10 grid grid-cols-2 gap-2.5">
         <button disabled={disabledControls} class="{btnClass} hover:bg-[#00d9ff]/20 !bg-[#00d9ff]/10 !text-[#00d9ff] !border-[#00d9ff]" onclick={() => { motorX = 180; motorY = 45; startCmd(7); }}>
           {#if isPublishing && activeCmd === 7}
             <Loader size={16} class="mr-2 animate-spin" /> EXECUTING...
           {:else}
             <Home size={16} class="mr-2" /> HOME SENSORS
           {/if}
         </button>
         <button disabled={disabledControls} class="{btnClass} {power ? 'hover:bg-[#00ff41]/20 !bg-[#00ff41]/10 !text-[#00ff41] !border-[#00ff41]' : 'hover:bg-gray-800'}" onclick={() => { power = !power; startCmd(8); }}>
           {#if isPublishing && activeCmd === 8}
             <Loader size={16} class="mr-2 animate-spin" /> EXECUTING...
           {:else}
             <Power size={16} class="mr-2" /> {power ? 'SYS POWER: ON' : 'SYS POWER: OFF'}
           {/if}
         </button>
      </div>
    </div>

    <!-- Right: Diagnostics -->
    <div class="bg-[#000a14]/80 border border-[#00d9ff]/20 p-8 flex flex-col">
      <div class="text-xl text-white mb-8 border-l-4 border-[#00d9ff] pl-3">DIAGNOSTICS</div>
      
      <div class="flex flex-col gap-4 font-mono text-sm">
        <div class="flex justify-between"><span>&gt; L_ACTUATOR_1</span><span class="text-[#00ff41]">NOMINAL</span></div>
        <div class="flex justify-between"><span>&gt; L_ACTUATOR_2</span><span class="text-[#00ff41]">NOMINAL</span></div>
        <div class="flex justify-between"><span>&gt; VOLTAGE_BUS</span><span class="text-[#00ff41]">24.2V</span></div>
        <div class="flex justify-between"><span>&gt; CURRENT_DRAW</span><span class="text-[#e8c100]">1.4A</span></div>
        <div class="flex justify-between"><span>&gt; TEMP_MOSFET</span><span class="text-[#00ff41]">42°C</span></div>
        
        <div class="mt-5 p-4 bg-[#ff2a2a]/5 border border-[#ff2a2a]/20">
          <div class="text-[#ff2a2a] flex items-center gap-2 mb-2">
            <ShieldAlert size={14} /> WARNING: MANUAL OVERRIDE
          </div>
          <div class="text-xs text-white/50 leading-relaxed">
            AUTOMATIC SAFETY LIMITS HAVE BEEN DISENGAGED. ENSURE CLEARANCE OF ALL MECHANICAL COMPONENTS BEFORE INITIATING MOVEMENT.
          </div>
        </div>
        
        <div class="flex-1"></div>
        <button disabled={disabledControls} onclick={emergencyStop} class="{btnClass} hover:bg-[#ff2a2a]/80 w-full !bg-[#ff2a2a] !text-white text-xl p-5 mt-auto">
          {#if isPublishing && activeCmd === 3}
            <Loader size={24} class="mr-3 animate-spin" /> DISENGAGING...
          {:else}
            <Zap class="mr-3" /> EMERGENCY STOP
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Footer Decoration -->
  <div class="absolute bottom-5 left-10 text-xs text-white/20 font-mono">
    SYS_VER: 4.2.0-STABLE // HARDWARE_ID: SOLTRA-T1-N1
  </div>
</div>
