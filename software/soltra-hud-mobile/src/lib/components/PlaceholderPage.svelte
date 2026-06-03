<script lang="ts">
  import { goto } from "$app/navigation";
  
  let { title, description }: { title: string, description: string } = $props();
</script>

<div class="h-screen w-screen bg-bg text-fg flex flex-col items-center justify-center font-skip relative overflow-hidden">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    loop
    autoplay
    src="/background.mp4"
    class="fixed h-full object-cover object-left -z-10 opacity-30"
  ></video>

  <h1 class="text-6xl font-bold mb-4 tracking-tight" style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">{title}</h1>
  <p class="text-2xl text-[#00d9ff] mb-16 italic font-new-rodin">{description}</p>
  
  <button 
    class="text-4xl hover:text-red transition-colors flex items-center gap-4 cursor-pointer bg-black/50 px-8 py-4 rounded-lg border border-[#00d9ff]/30 backdrop-blur-sm"
    onclick={() => goto("/")}
  >
    <iconify-icon icon="mdi:arrow-left-bold"></iconify-icon>
    RETURN TO HUD
  </button>
</div>
