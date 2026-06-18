<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { scale, fade } from 'svelte/transition';
  import { listProfiles, generateVoiceboxTTS } from '$lib/ttsService';
  import { telemetry } from '$lib/mqttStore';
  import { generateAIReport } from '$lib/llmService';
  import { goto } from '$app/navigation';
  import { Lock, Unlock, Clock } from 'lucide-svelte';

  let profiles: any[] = $state([]);
  let loading = $state(true);
  let generating = $state(false);
  let aiGenerating = $state(false);
  let errorMsg: string | null = $state(null);
  let selectedProfileId: string | null = $state(null);
  let currentTelemetry: any = null;

  let reportText = $state("");
  let hasGeneratedReport = $state(false);

  let touchStartX = 0;
  let touchEndX = 0;

  // Time-gating state
  let now = $state(new Date());
  let devOverride = $state(false);
  let timerInterval: any;

  // Compute lock status
  let isLocked = $derived(now.getHours() < 19 && !devOverride);

  // Compute countdown to 19:00
  let countdownText = $derived(() => {
    const target = new Date(now);
    target.setHours(19, 0, 0, 0);
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return "00:00:00";
    
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  // Watch for unlock to trigger auto-generation
  let previousLockState = true;
  $effect(() => {
    const currentlyLocked = isLocked;
    if (previousLockState === true && currentlyLocked === false) {
      // Just unlocked! Trigger generation if we haven't yet.
      if (!hasGeneratedReport) {
        handleAIReport();
      }
    }
    previousLockState = currentlyLocked;
  });

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    if (touchEndX - touchStartX > 100) {
      goto('/');
    }
  }

  async function loadProfiles() {
    loading = true;
    try {
      profiles = await listProfiles();
      if (profiles.length > 0) {
        selectedProfileId = profiles[0].id;
      }
    } catch (err) {
      console.error(err);
      errorMsg = "Failed to load profiles";
    }
    loading = false;
  }

  onMount(() => {
    loadProfiles();
    telemetry.subscribe(data => {
      currentTelemetry = data;
    });

    // Check time immediately
    now = new Date();
    previousLockState = now.getHours() < 19 && !devOverride;

    // Start clock
    timerInterval = setInterval(() => {
      now = new Date();
    }, 1000);
    
    // If it's already unlocked on mount, generate it
    if (!previousLockState && !hasGeneratedReport) {
      handleAIReport();
    }
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  async function handleAIReport() {
    aiGenerating = true;
    errorMsg = null;
    try {
      reportText = await generateAIReport(currentTelemetry || {});
      hasGeneratedReport = true;
    } catch (err: any) {
      errorMsg = `AI Generation failed: ${err.message}`;
    }
    aiGenerating = false;
  }

  async function handleGenerate() {
    if (!selectedProfileId) {
      errorMsg = "Please select a voice profile first.";
      return;
    }

    generating = true;
    errorMsg = null;
    
    try {
      const audioBuffer = await generateVoiceboxTTS(reportText, 'en', selectedProfileId);
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        const decoded = await audioCtx.decodeAudioData(audioBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(audioCtx.destination);
        
        source.onended = () => {
          generating = false;
        };
        
        source.start(0);
      } catch (audioErr: any) {
        throw new Error("Audio playback blocked by phone. Check volume and permissions: " + audioErr.message);
      }
    } catch (err: any) {
      errorMsg = `Generation failed: ${err.message}`;
      generating = false;
    }
  }
</script>

<div class="absolute inset-0 w-full h-full flex items-center justify-center bg-black/85 backdrop-blur-md px-4 py-8" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd} transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={() => goto('/')}></div>
  
  <div class="relative bg-bg/95 border border-primary/30 border-t-4 border-t-[#00ff41] p-8 w-[80%] h-[80%] overflow-y-auto z-10 flex flex-col" transition:scale={{ start: 0.9, duration: 250 }}>
    
    <!-- Header -->
    <div class="flex justify-between items-center mb-6 border-b-2 border-primary pb-3 shrink-0">
      <div class="flex items-center gap-2 relative group">
        <iconify-icon icon="lucide:file-audio" class="text-[#00ff41] text-2xl"></iconify-icon>
        <span class="text-white text-2xl italic font-anton tracking-widest">DAILY REPORT</span>
        <!-- Hidden Dev Override Button -->
        <button 
          class="absolute inset-0 opacity-0 cursor-pointer z-50" 
          onclick={() => devOverride = !devOverride}
          aria-label="Toggle Dev Override"
        ></button>
      </div>
      <button type="button" onclick={() => goto('/')} class="text-[#00ff41] hover:text-white transition-colors cursor-pointer z-50 relative">
        <iconify-icon icon="lucide:x" class="text-2xl"></iconify-icon>
      </button>
    </div>

    {#if isLocked}
      <!-- LOCKED UI -->
      <div class="flex-1 flex flex-col items-center justify-center text-center px-4" in:fade>
        <Lock size={64} class="text-slate-500 mb-6" />
        <h2 class="text-3xl font-anton tracking-widest text-white mb-2 uppercase">Time-Gated Access</h2>
        <p class="text-slate-400 font-mono mb-8 max-w-sm leading-relaxed">The automated Daily Report unlocks at 19:00 local time to ensure full-day solar telemetry analysis.</p>
        
        <div class="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center min-w-[280px]">
          <div class="flex items-center gap-2 text-primary mb-2">
            <Clock size={20} />
            <span class="font-bold tracking-widest text-sm uppercase">Unlocks In</span>
          </div>
          <div class="text-5xl font-mono font-bold text-white tracking-widest">
            {countdownText()}
          </div>
        </div>
      </div>
    {:else}
      <!-- UNLOCKED UI -->
      <div class="flex-1 flex flex-col min-h-0" in:fade>
        <!-- Status Messages -->
        {#if errorMsg}
          <div class="bg-[#ff2a2a]/15 border border-[#ff2a2a] p-3 mb-4 text-[#ff2a2a] text-xs font-mono flex justify-between items-center shrink-0" transition:scale>
            <span>[ERR] {errorMsg}</span>
            <button onclick={() => errorMsg = null} class="cursor-pointer"><iconify-icon icon="lucide:x"></iconify-icon></button>
          </div>
        {/if}

        <div class="mb-5 shrink-0">
          <label class="text-sm font-bold text-primary block mb-1">SELECT VOICE</label>
          {#if loading}
            <div class="text-gray-400 text-sm font-mono">Loading profiles...</div>
          {:else if profiles.length === 0}
            <div class="text-gray-400 text-sm font-mono py-2">No voice profiles found. Clone a voice first.</div>
          {:else}
            <select
              bind:value={selectedProfileId}
              class="w-full bg-[#001428]/80 border border-primary/30 text-white p-3 font-mono text-sm outline-none focus:border-primary transition-colors"
            >
              {#each profiles as p}
                <option value={p.id}>{p.name} ({p.id.substring(0,8)})</option>
              {/each}
            </select>
          {/if}
        </div>

        <div class="mb-6 flex-1 flex flex-col min-h-[150px]">
          <div class="flex justify-between items-center mb-2 shrink-0">
            <label class="text-sm font-bold text-primary">REPORT TEXT</label>
            <button
              type="button"
              onclick={handleAIReport}
              disabled={aiGenerating}
              class="text-xs text-[#00d9ff] font-mono border border-[#00d9ff]/40 px-3 py-1 hover:bg-[#00d9ff]/20 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {#if aiGenerating}
                <iconify-icon icon="lucide:loader" class="animate-spin"></iconify-icon>
                GENERATING...
              {:else}
                RE-GENERATE (AI)
              {/if}
            </button>
          </div>
          <div class="relative flex-1 bg-[#001428]/80 border border-primary/30 min-h-0">
            {#if aiGenerating}
              <div class="absolute inset-0 flex flex-col items-center justify-center text-[#00d9ff] z-10 font-mono bg-black/60 backdrop-blur-sm">
                <iconify-icon icon="lucide:cpu" class="text-4xl animate-pulse mb-3"></iconify-icon>
                <div class="tracking-widest animate-pulse">SYNTHESIZING REPORT...</div>
              </div>
            {/if}
            <textarea
              bind:value={reportText}
              class="absolute inset-0 w-full h-full bg-transparent text-white p-4 font-mono text-base outline-none focus:border-primary transition-colors resize-none leading-relaxed"
            ></textarea>
          </div>
        </div>

        <div class="flex gap-3 shrink-0">
          <button
            type="button"
            onclick={handleGenerate}
            disabled={generating || profiles.length === 0 || aiGenerating || reportText.length === 0}
            class="flex-1 bg-[#00ff41] text-[#001428] border-none py-4 font-anton text-xl tracking-widest flex items-center justify-center gap-3 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {#if generating}
              <iconify-icon icon="lucide:loader" class="animate-spin text-2xl"></iconify-icon> GENERATING & PLAYING...
            {:else}
              <iconify-icon icon="lucide:play" class="text-2xl"></iconify-icon> PLAY DAILY REPORT
            {/if}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  textarea::-webkit-scrollbar {
    width: 6px;
  }
  textarea::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.2);
  }
  textarea::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 65, 0.4);
    border-radius: 6px;
  }
  textarea:hover::-webkit-scrollbar-thumb {
    background: rgba(0, 255, 65, 0.8);
  }
</style>
