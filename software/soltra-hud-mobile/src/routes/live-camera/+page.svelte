<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { scale, fade } from 'svelte/transition';
  import { goto } from '$app/navigation';

  // ESP32-S3 Sense Camera Node URL — set VITE_CAMERA_URL in .env
  const esp32s3Url = import.meta.env.VITE_CAMERA_URL;
  if (!esp32s3Url) throw new Error('[Camera] VITE_CAMERA_URL is not set in .env');
  
  // We assume the stream URL ends with /stream, so the snapshot URL is /capture
  const streamUrl = esp32s3Url;
  const captureUrl = esp32s3Url.replace('/stream', '/capture');
  
  let isStreamActive = $state(false);
  let currentImageUrl = $state(`${captureUrl}?_cb=${new Date().getTime()}`);
  let loading = $state(true);

  let snapshots = $state<{url: string, timestamp: Date}[]>([]);

  let touchStartX = 0;
  let touchEndX = 0;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    if (touchEndX - touchStartX > 100) {
      goto('/');
    }
  }

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
    const timestamp = new Date();
    const url = `${captureUrl}?_cb=${timestamp.getTime()}`;
    currentImageUrl = url;
    
    // Add to gallery
    snapshots = [{url, timestamp}, ...snapshots];
  }

  onMount(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Automatically capture a snapshot on boot
    requestSnapshot();
  });

  onDestroy(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });
</script>

<div class="absolute inset-0 w-full h-full flex items-center justify-center bg-black/85 backdrop-blur-md px-4 py-8" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd} transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={() => goto('/')}></div>
  
  <div class="relative bg-zinc-950/90 border border-white/10 p-6 w-[80%] h-[80%] flex flex-col z-10 rounded-xl shadow-2xl overflow-hidden" transition:scale={{ start: 0.95, duration: 250 }}>
    <!-- Decorative background elements -->
    <div class="absolute top-0 right-0 w-[40rem] h-[40rem] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
    <div class="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-blue-500/10 rounded-full blur-[80px] pointer-events-none translate-y-1/2 -translate-x-1/2"></div>
    
    <!-- Header -->
    <div class="flex justify-between items-center mb-6 border-b border-white/10 pb-4 shrink-0 relative z-10">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
          <iconify-icon icon="lucide:video" class="text-2xl"></iconify-icon>
        </div>
        <div>
          <h2 class="text-white text-4xl font-bold tracking-tight">S3 OVERWATCH CV NODE</h2>
          <div class="flex items-center gap-2 text-lg font-medium text-zinc-400 mt-1">
            {#if loading}
              <iconify-icon icon="lucide:loader" class="animate-spin"></iconify-icon> Connecting...
            {:else}
              <div class="w-2 h-2 rounded-full {isStreamActive ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}"></div>
              {isStreamActive ? 'LIVE STREAM ACTIVE' : 'SYSTEM IDLE / SNAPSHOT MODE'}
            {/if}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" onclick={requestSnapshot} class="flex items-center gap-2 px-6 py-3 text-lg font-semibold bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-all cursor-pointer">
          <iconify-icon icon="lucide:camera" class="text-2xl"></iconify-icon> CAPTURE
        </button>
        <button type="button" onclick={toggleStream} class="flex items-center gap-2 px-6 py-3 text-lg font-semibold rounded-lg transition-all cursor-pointer {isStreamActive ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'}">
          {#if isStreamActive}
            <iconify-icon icon="lucide:square" class="text-lg"></iconify-icon> STOP
          {:else}
            <iconify-icon icon="lucide:play" class="text-lg"></iconify-icon> STREAM
          {/if}
        </button>
        <div class="w-px h-6 bg-white/10 mx-2"></div>
        <button type="button" onclick={() => goto('/')} class="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
          <iconify-icon icon="lucide:x" class="text-2xl"></iconify-icon>
        </button>
      </div>
    </div>

    <!-- Main Content: Two Columns -->
    <div class="flex-1 flex gap-6 overflow-hidden relative z-10">
      
      <!-- Left Column: Camera Feed -->
      <div class="flex-[2] flex flex-col min-h-0 bg-black/40 rounded-xl border border-white/5 overflow-hidden relative">
        <div class="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-md text-white font-mono text-base">
            <iconify-icon icon="lucide:cpu" class="text-indigo-400"></iconify-icon> CAM-01 / ONLINE
          </div>
          <div class="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-md {isStreamActive ? 'text-red-400' : 'text-zinc-400'} font-mono text-base">
            <span>{isStreamActive ? '▶ MJPEG STREAM' : '📷 SNAPSHOT'}</span>
          </div>
        </div>

        <img 
          src={currentImageUrl} 
          alt="Live Camera Feed" 
          class="w-full h-full object-contain"
          onload={() => { loading = false; }}
          onerror={() => { 
            loading = false;
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
        
        <div class="absolute bottom-0 left-0 w-full p-4 flex justify-between items-end pointer-events-none z-10 bg-gradient-to-t from-black/60 to-transparent">
          <div class="font-mono text-base text-white/70 bg-black/40 px-2 py-1 rounded">
            {new Date().toISOString()}
          </div>
          <div class="font-mono text-sm text-white/50 tracking-widest uppercase">
            ESP32-S3 SENSE
          </div>
        </div>
      </div>

      <!-- Right Column: Snapshot Gallery -->
      <div class="flex-1 flex flex-col min-h-0 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
        <div class="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between shrink-0">
          <h3 class="text-lg font-semibold text-white flex items-center gap-2">
            <iconify-icon icon="lucide:image" class="text-indigo-400"></iconify-icon> Recent Captures
          </h3>
          <span class="text-base text-zinc-500 font-mono">{snapshots.length} total</span>
        </div>
        
        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {#if snapshots.length === 0}
            <div class="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
              <iconify-icon icon="lucide:camera-off" class="text-4xl opacity-50"></iconify-icon>
              <p class="text-lg">No captures yet</p>
            </div>
          {:else}
            {#each snapshots as snap, index}
              <button 
                class="w-full text-left group relative bg-black/30 rounded-lg overflow-hidden border border-white/5 hover:border-indigo-500/50 transition-all cursor-pointer aspect-video"
                onclick={() => {
                  isStreamActive = false;
                  currentImageUrl = snap.url;
                }}
              >
                <img src={snap.url} alt="Snapshot" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <div class="text-sm font-mono text-white/90 truncate">
                    {snap.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>

    </div>
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
