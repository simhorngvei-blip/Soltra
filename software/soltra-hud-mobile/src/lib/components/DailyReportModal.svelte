<script lang="ts">
  import { onMount } from 'svelte';
  import { scale, fade } from 'svelte/transition';
  import { listProfiles, generateVoiceboxTTS } from '$lib/ttsService';
  import { telemetry } from '$lib/mqttStore';
  import { generateAIReport } from '$lib/llmService';

  let { onClose } = $props();

  let profiles: any[] = $state([]);
  let loading = $state(true);
  let generating = $state(false);
  let aiGenerating = $state(false);
  let errorMsg: string | null = $state(null);
  let selectedProfileId: string | null = $state(null);
  let currentTelemetry: any = null;

  let reportText = $state("Good morning. Soltra Systems are nominal. Telemetry data is syncing.");

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
  });

  async function handleAIReport() {
    aiGenerating = true;
    errorMsg = null;
    try {
      reportText = await generateAIReport(currentTelemetry || {});
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
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(audioBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        generating = false;
      };
      
      source.start(0);
    } catch (err: any) {
      errorMsg = `Generation failed: ${err.message}`;
      generating = false;
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md" transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={onClose}></div>
  
  <div class="relative bg-bg/95 border border-primary/30 border-t-4 border-t-[#00ff41] p-8 w-[520px] max-h-[80vh] overflow-y-auto z-10" transition:scale={{ start: 0.9, duration: 250 }}>
    
    <!-- Header -->
    <div class="flex justify-between items-center mb-6 border-b-2 border-primary pb-3">
      <div class="flex items-center gap-2">
        <iconify-icon icon="lucide:file-audio" class="text-[#00ff41] text-2xl"></iconify-icon>
        <span class="text-white text-2xl italic font-anton tracking-widest">DAILY REPORT</span>
      </div>
      <button type="button" onclick={onClose} class="text-[#00ff41] hover:text-white transition-colors">
        <iconify-icon icon="lucide:x" class="text-2xl"></iconify-icon>
      </button>
    </div>

    <!-- Status Messages -->
    {#if errorMsg}
      <div class="bg-[#ff2a2a]/15 border border-[#ff2a2a] p-3 mb-4 text-[#ff2a2a] text-xs font-mono flex justify-between items-center" transition:scale>
        <span>[ERR] {errorMsg}</span>
        <button onclick={() => errorMsg = null}><iconify-icon icon="lucide:x"></iconify-icon></button>
      </div>
    {/if}

    <div class="mb-5">
      <label class="text-[11px] text-primary block mb-1">SELECT VOICE</label>
      {#if loading}
        <div class="text-gray-400 text-xs font-mono">Loading profiles...</div>
      {:else if profiles.length === 0}
        <div class="text-gray-400 text-xs font-mono py-2">No voice profiles found. Clone a voice first.</div>
      {:else}
        <select
          bind:value={selectedProfileId}
          class="w-full bg-[#001428]/80 border border-primary/30 text-white p-2.5 font-mono text-[13px] outline-none focus:border-primary transition-colors"
        >
          {#each profiles as p}
            <option value={p.id}>{p.name} ({p.id.substring(0,8)})</option>
          {/each}
        </select>
      {/if}
    </div>

    <div class="mb-5">
      <div class="flex justify-between items-center mb-1">
        <label class="text-[11px] text-primary">REPORT TEXT</label>
        <button
          type="button"
          onclick={handleAIReport}
          disabled={aiGenerating}
          class="text-[9px] text-[#00d9ff] font-mono border border-[#00d9ff]/40 px-2 py-0.5 hover:bg-[#00d9ff]/20 transition-colors disabled:opacity-50"
        >
          {#if aiGenerating}
            GENERATING...
          {:else}
            AUTO-GENERATE (AI)
          {/if}
        </button>
      </div>
      <textarea
        bind:value={reportText}
        rows="5"
        class="w-full bg-[#001428]/80 border border-primary/30 text-white p-2.5 font-mono text-[13px] outline-none focus:border-primary transition-colors resize-y"
      ></textarea>
    </div>

    <div class="flex gap-3">
      <button
        type="button"
        onclick={handleGenerate}
        disabled={generating || profiles.length === 0}
        class="flex-1 bg-[#00ff41] text-[#001428] border-none py-2.5 font-anton text-sm tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-colors disabled:opacity-60"
      >
        {#if generating}
          <iconify-icon icon="lucide:loader" class="animate-spin"></iconify-icon> GENERATING & PLAYING...
        {:else}
          <iconify-icon icon="lucide:play"></iconify-icon> GENERATE & PLAY
        {/if}
      </button>
      <button
        type="button"
        onclick={onClose}
        class="bg-transparent border border-primary/40 text-primary py-2.5 px-6 font-anton text-xs tracking-widest hover:bg-primary/20 transition-colors"
      >
        CLOSE
      </button>
    </div>

  </div>
</div>
