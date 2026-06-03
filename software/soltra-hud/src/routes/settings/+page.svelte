<script lang="ts">
  import { goto } from "$app/navigation";
  import { appState } from "$lib/appState.svelte";
  import SettingsOption from "$lib/components/SettingsOption.svelte";
  import { animate } from "animejs";

  let currentSettingIndex = $state(0);
  let settingsOptionElement = $state<HTMLDivElement>();

  function setSettingsIndex(index: number) {
    if (index === currentSettingIndex) return;
    currentSettingIndex = index;
    animate(settingsOptionElement!, {
      translateY: index * 56,
      duration: 100,
      easing: "easeOutQuad"
    });
  }
</script>

<div class="h-screen w-screen bg-bg text-fg font-skip relative overflow-hidden flex flex-col p-8 z-10">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video loop autoplay src="/background.mp4" class="fixed inset-0 w-full h-full object-cover object-left -z-10 opacity-30"></video>

  <!-- Header -->
  <div class="flex justify-between items-center border-b border-[#00d9ff]/30 pb-4 mb-8">
    <h1 class="text-4xl tracking-tight uppercase" style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">SETTINGS</h1>
    <button class="text-2xl hover:text-red transition-colors flex items-center gap-2 cursor-pointer bg-black/50 px-4 py-2 rounded-md border border-[#00d9ff]/30 backdrop-blur-sm" onclick={() => goto("/")}>
      <iconify-icon icon="mdi:arrow-left-bold"></iconify-icon> BACK
    </button>
  </div>

  <div class="flex-1 max-w-4xl mx-auto w-full flex items-center justify-center">
    <div class="flex flex-col gap-2 relative bg-black/40 p-12 rounded-lg border border-[#00d9ff]/20 backdrop-blur-md shadow-[0_0_15px_rgba(0,217,255,0.1)]">
      <h2 class="text-2xl text-[#00d9ff] tracking-widest uppercase mb-8 pb-4 border-b border-[#00d9ff]/20 w-full">◈ Preferences</h2>
      
      <div class="relative w-[32rem]">
        <SettingsOption onSelect={() => setSettingsIndex(0)} isSelected={currentSettingIndex === 0} bind:value={appState.isMusicEnabled}>
          Toggle Music
        </SettingsOption>
        <SettingsOption onSelect={() => setSettingsIndex(1)} isSelected={currentSettingIndex === 1} bind:value={appState.isSFXEnabled}>
          Toggle SFX
        </SettingsOption>

        <div
          bind:this={settingsOptionElement}
          class="w-full h-12 bg-red -z-1 absolute -top-2 -right-1 rounded-md"
        ></div>
      </div>
    </div>
  </div>
</div>
