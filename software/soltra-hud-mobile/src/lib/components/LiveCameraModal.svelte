<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { scale, fade } from 'svelte/transition';

  let { onClose } = $props();

  // ESP32-S3 Sense Camera Node URL (Overwatch Node - Corner 4)
  // Replace with the actual IP address of your XIAO ESP32-S3 Sense on the local network
  const esp32s3Url = "http://192.168.1.100/capture";
  
  let currentImageUrl = $state(esp32s3Url);
  let intervalId: any;
  let loading = $state(true);

  function refreshImage() {
    loading = true;
    currentImageUrl = `${esp32s3Url}?_cb=${new Date().getTime()}`;
  }

  onMount(() => {
    // Refresh the ESP32-S3 camera snapshot every 3 seconds
    intervalId = setInterval(refreshImage, 3000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
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
          <div class="w-2 h-2 rounded-full bg-[#ff2a2a] ml-2 animate-pulse"></div>
        {/if}
      </div>
      <button type="button" onclick={onClose} class="text-[#00d9ff] hover:text-white transition-colors">
        <iconify-icon icon="lucide:x" class="text-2xl"></iconify-icon>
      </button>
    </div>

    <!-- Camera Feed Container -->
    <div class="relative flex-1 bg-black overflow-hidden border border-primary/20 flex items-center justify-center min-h-[400px]">
      <img 
        src={currentImageUrl} 
        alt="Live Camera Feed" 
        class="w-full h-full object-contain"
        onload={() => loading = false}
        onerror={() => loading = false}
      />
      
      <!-- Overlay Text -->
      <div class="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 font-mono text-[10px] border border-white/20">
        CAM-01 / ONLINE
      </div>
      <div class="absolute bottom-4 left-4 bg-black/60 text-white px-2 py-1 font-mono text-[10px] border border-white/20">
        {new Date().toISOString()}
      </div>
    </div>
  </div>
</div>
