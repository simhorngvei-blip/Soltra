<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { scale, fade } from 'svelte/transition';

  let { onClose } = $props();

  // ESP32-S3 Sense Camera Node URL
  const esp32s3Url = import.meta.env.VITE_CAMERA_URL || "http://192.168.1.100/stream";
  
  // We assume the stream URL ends with /stream, so the snapshot URL is /capture
  const streamUrl = esp32s3Url;
  const captureUrl = esp32s3Url.replace('/stream', '/capture');
  
  let isStreamActive = $state(false);
  let currentImageUrl = $state(`${captureUrl}?_cb=${new Date().getTime()}`);
  let loading = $state(true);

  function handleVisibilityChange() {
    if (document.hidden) {
      currentImageUrl = "";
    } else {
      loading = true;
      currentImageUrl = isStreamActive 
        ? `${streamUrl}?_cb=${new Date().getTime()}`
        : `${captureUrl}?_cb=${new Date().getTime()}`;
    }
  }
  
  function toggleStream() {
    isStreamActive = !isStreamActive;
    loading = true;
    currentImageUrl = isStreamActive 
      ? `${streamUrl}?_cb=${new Date().getTime()}`
      : `${captureUrl}?_cb=${new Date().getTime()}`;
  }

  function requestSnapshot() {
    if (isStreamActive) {
      isStreamActive = false;
    }
    loading = true;
    currentImageUrl = `${captureUrl}?_cb=${new Date().getTime()}`;
  }

  onMount(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  });

  onDestroy(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md" transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={onClose}></div>
  
  <div class="relative bg-bg/95 border border-primary/30 border-t-4 border-t-[#00d9ff] p-6 w-[800px] max-w-[90vw] max-h-[90vh] flex flex-col z-10" transition:scale={{ start: 0.9, duration: 250 }}>
    
    <!-- Header -->
    <div class="flex justify-between items-center mb-4 border-b-2 border-primary pb-2 shrink-0">
      <div class="flex items-center gap-2">
        <iconify-icon icon="lucide:video" class="text-[#00d9ff] text-2xl"></iconify-icon>
        <span class="text-white text-2xl italic font-anton tracking-widest">S3 OVERWATCH CV NODE</span>
        {#if loading}
          <iconify-icon icon="lucide:loader" class="text-primary animate-spin ml-2"></iconify-icon>
        {:else}
          <div class="w-2 h-2 rounded-full {isStreamActive ? 'bg-[#ff2a2a] animate-ping' : 'bg-[#00d9ff]'} ml-2"></div>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <button type="button" onclick={requestSnapshot} class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-sm border border-zinc-700 transition-colors">
          <iconify-icon icon="lucide:camera" class="text-sm"></iconify-icon> REQUEST SNAPSHOT
        </button>
        <button type="button" onclick={toggleStream} class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-sm transition-colors {isStreamActive ? 'bg-red-950/50 text-red-400 hover:bg-red-900/50 border border-red-900/50' : 'bg-emerald-950/50 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-900/50'}">
          {#if isStreamActive}
            <iconify-icon icon="lucide:square" class="text-sm"></iconify-icon> STOP STREAM
          {:else}
            <iconify-icon icon="lucide:play" class="text-sm"></iconify-icon> START STREAM
          {/if}
        </button>
        <button type="button" onclick={onClose} class="text-[#00d9ff] hover:text-white transition-colors ml-2">
          <iconify-icon icon="lucide:x" class="text-2xl"></iconify-icon>
        </button>
      </div>
    </div>

    <!-- Camera Feed Container -->
    <div class="relative flex-1 bg-black overflow-hidden border border-primary/20 flex items-center justify-center min-h-[400px]">
      <img 
        src={currentImageUrl} 
        alt="Live Camera Feed" 
        class="w-full h-full object-contain"
        onload={() => { loading = false; }}
        onerror={() => { 
          loading = false;
          // Retry on error after 3 seconds if we are supposed to be connected
          setTimeout(() => {
            if (!document.hidden) {
              loading = true;
              currentImageUrl = isStreamActive 
                ? `${streamUrl}?_cb=${new Date().getTime()}`
                : `${captureUrl}?_cb=${new Date().getTime()}`;
            }
          }, 3000);
        }}
      />
      
      <!-- Overlay Text -->
      <div class="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 font-mono text-[10px] border border-white/20">
        CAM-01 / ONLINE
      </div>
      <div class="absolute bottom-4 left-4 bg-black/60 {isStreamActive ? 'text-red-400' : 'text-zinc-400'} px-2 py-1 font-mono text-[10px] border border-white/20 flex flex-col gap-1">
        <span>{isStreamActive ? '▶ LIVE MJPEG STREAM' : '📷 LATEST S3 SNAPSHOT'}</span>
        <span>{new Date().toISOString()}</span>
      </div>
    </div>
  </div>
</div>
