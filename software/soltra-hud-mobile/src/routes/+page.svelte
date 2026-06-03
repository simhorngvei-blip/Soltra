<script lang="ts">
  import Option from "$lib/components/Option.svelte";
  import { animate } from "animejs";
  import VoiceCloningModal from "$lib/components/VoiceCloningModal.svelte";
  import DailyReportModal from "$lib/components/DailyReportModal.svelte";
  import LiveCameraModal from "$lib/components/LiveCameraModal.svelte";

  import Control from "$lib/components/Control.svelte";
  import SettingsOption from "$lib/components/SettingsOption.svelte";
  import { fade } from "svelte/transition";
  import type { OptionValue } from "$lib/types";
  import { onMount } from "svelte";
  import { Howl } from "howler";

  import { initMqtt, mqttStatus, telemetry } from "$lib/mqttStore";
  import { goto } from "$app/navigation";
  import { appState } from "$lib/appState.svelte";

  const options: OptionValue[] = [
    { name: "SYSTEM OVERVIEW", description: "View the System Hub", rotation: -40, zIndex: 1, offsetX: -180, offsetY: 100 },
    { name: "LIVE CAMERA", description: "S3 Sense CV Node", rotation: -30, zIndex: 1, offsetX: -120, offsetY: 70 },
    { name: "HARDWARE LOGS", description: "System Logs & Diags", rotation: -20, zIndex: 2, offsetX: -60, offsetY: 40 },
    { name: "MANUAL OVERRIDE", description: "Actuator Matrix", rotation: -10, zIndex: 3, offsetX: -20, offsetY: 10 },
    { name: "NETWORK", description: "Connectivity Node", rotation: 0, zIndex: 4, offsetX: 0, offsetY: 0 },
    { name: "SETTINGS", description: "Preferences", rotation: 10, zIndex: 3, offsetX: -20, offsetY: -10 },
    { name: "VOICE CLONING", description: "AI Voice Synthesis", rotation: 20, zIndex: 2, offsetX: -60, offsetY: -40 },
    { name: "DAILY REPORT", description: "Pre-cloned AI Voice Status", rotation: 30, zIndex: 1, offsetX: -120, offsetY: -70 },
    { name: "LOGOUT", description: "End Session", rotation: 40, zIndex: 1, offsetX: -180, offsetY: -100 }
  ];

  const musicTracks = [
    "Changing Seasons -Reload-.mp3",
    "Color Your Night.mp3",
    "Full Moon Full Life.mp3",
    "It's Going Down Now.mp3",
    "Mass Destruction -Reload-.mp3",
    "When The Moon's Reaching Out Stars -Reload-.mp3",
    "キミの記憶 -Reload-.mp3",
    "全ての人の魂の戦い.mp3",
    "巌戸台分寮 -Reload-.mp3"
  ];

  let backgroundVideo: HTMLVideoElement;
  let selectedIndex = $state(0);
  let showVoiceCloning = $state(false);
  let showDailyReport = $state(false);
  let showLiveCamera = $state(false);
  let currentOptionElement = $state<HTMLButtonElement>();
  let settingsOptionElement = $state<HTMLDivElement>();
  let currentSettingIndex = $state(0);

  const navigationSound = new Howl({
    src: ["/sfx/navigation.wav"],
    volume: 0.5,
  });

  function setIndex(index: number) {
    if (index === selectedIndex) return;
    selectedIndex = index;
    currentOptionElement = document.getElementById(`option-${index}`) as HTMLButtonElement;
    playSound();
  }

  function setSettingsIndex(index: number) {
    if (index === currentSettingIndex) return;
    currentSettingIndex = index;
    // playSound();
    animate(settingsOptionElement!, {
      translateY: index * 56,
      duration: 100,
      easing: "easeOutQuad"
    });
  }

  function executeOption(index: number) {
    const name = options[index].name;
    if (name === "MANUAL OVERRIDE") {
      goto("/manual");
    } else if (name === "SYSTEM OVERVIEW") {
      goto("/about");
    } else if (name === "HARDWARE LOGS") {
      goto("/resume");
    } else if (name === "NETWORK") {
      goto("/socials");
    } else if (name === "SETTINGS") {
      goto("/settings");
    } else if (name === "VOICE CLONING") {
      showVoiceCloning = true;
    } else if (name === "DAILY REPORT") {
      showDailyReport = true;
    } else if (name === "LIVE CAMERA") {
      showLiveCamera = true;
    } else if (name === "LOGOUT") {
      window.location.href = "/";
    }
  }

  function start() {
    appState.isStarted = true;
    backgroundVideo.play();

    if (appState.isMusicEnabled && !appState.bgm) {
      const randomIndex = Math.floor(Math.random() * musicTracks.length);
      appState.bgm = new Howl({
        src: [`/music/${musicTracks[randomIndex]}`],
        loop: true,
        autoplay: true,
        volume: 0.5,
        html5: true, // Force HTML5 streaming instead of Web Audio API decoding
      });
    }
  }

  function playSound() {
    if (appState.isSFXEnabled) {
      navigationSound.play();
    }
  }

  onMount(() => {
    setIndex(0);

    if (appState.isStarted && backgroundVideo) {
      backgroundVideo.play();
    }

    document.addEventListener("keydown", (e) => {
      if (!appState.isStarted) return;

      if (e.key === "ArrowDown" || e.key === "s") {
        setIndex((selectedIndex + 1) % options.length);
      } else if (e.key === "ArrowUp" || e.key === "w") {
        setIndex((selectedIndex - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        executeOption(selectedIndex);
      }
    });

    initMqtt();
  });
</script>

<main class="h-full w-full relative overflow-hidden">

  {#if !appState.isStarted}
    <div class="fixed bg-bg/90 size-full flex justify-center items-center z-20" transition:fade>
      <div class="flex flex-col gap-20 justify-center items-center scale-[1.4]">
        <div class="rotate-3 space-y-2">
        <h1 class="bg-fg text-bg px-6 py-4 rounded-md text-6xl tracking-[-0.08em] text-center uppercase">
          SOLTRA HELIOS<br>
          OVERSEER HUD
        </h1>
        <h2 class="flex items-center w-full gap-2 italic text-xl font-new-rodin text-shadow-under">
          <span>
            System Version 4.2.0
          </span>
          <hr class="border border-fg grow shadow-under">
          <span>
            Soltra Automation
          </span>
        </h2>
      </div>

      <div class="flex flex-col gap-2 relative">
        <SettingsOption onSelect={() => setSettingsIndex(0)} isSelected={currentSettingIndex === 0} bind:value={appState.isMusicEnabled}>
          Toggle Music
        </SettingsOption>
        <SettingsOption onSelect={() => setSettingsIndex(1)} isSelected={currentSettingIndex === 1} bind:value={appState.isSFXEnabled}>
          Toggle SFX
        </SettingsOption>

        <div
          bind:this={settingsOptionElement}
          class="w-[32rem] h-12 bg-red -z-1 absolute -top-2 -right-1 rounded-md"
        ></div>
      </div>

      <button onclick={start} class="text-6xl flex gap-4 cursor-pointer">
        <span class="tracking-[-0.05em]">ENTER</span>
        <iconify-icon icon="mdi:arrow-right-bold" class=" text-6xl"></iconify-icon>
      </button>
      </div>
    </div>
  {/if}

  <!-- background -->
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={backgroundVideo}
    loop
    muted
    playsinline
    autoplay
    src="/background.mp4"
    class="fixed w-full h-full object-cover object-center -z-10"
  ></video>

  <!-- options -->
  <div class="3xl:left-[80rem] left-[65rem] flex flex-col items-start justify-center h-full relative -space-y-32">
    {#each options as option, i}
      <Option
        index={i}
        isSelected={selectedIndex === i}
        onSelect={() => setIndex(i)}
        onClick={() => executeOption(i)}
        {option}
      />
    {/each}
  </div>

  {#if showVoiceCloning}
    <VoiceCloningModal onClose={() => showVoiceCloning = false} />
  {/if}

  {#if showDailyReport}
    <DailyReportModal onClose={() => showDailyReport = false} />
  {/if}

  {#if showLiveCamera}
    <LiveCameraModal onClose={() => showLiveCamera = false} />
  {/if}

  <!-- controls & telemetry -->
  <div class="absolute bottom-0 right-0 font-new-rodin flex flex-col items-start z-10 w-full" style="max-width: 400px; padding: 20px;">
    <p class="italic text-3xl mb-4 text-shadow-under text-right w-full text-white pr-8">
      {options[selectedIndex].description}
    </p>

    <div class="bg-black/50 border border-[#00d9ff]/30 p-4 w-full mb-8 mr-8 text-white text-sm" style="font-family: monospace;">
      <div class="mb-2 text-[#00d9ff]">&gt; LINK {$mqttStatus}</div>
      <div class="flex justify-between"><span>LUX:</span> <span>{$telemetry.solar_yield ? $telemetry.solar_yield.toFixed(1) + ' W/m²' : '-- W/m²'}</span></div>
      <div class="flex justify-between"><span>PANELS:</span> <span>{$telemetry.panel_angle ? $telemetry.panel_angle.toFixed(1) + '°' : 'OPTIMIZED'}</span></div>
      <div class="flex justify-between"><span>WIND:</span> <span>{$telemetry.wind_speed ? $telemetry.wind_speed.toFixed(1) + ' m/s' : '-- m/s'}</span></div>
    </div>
  </div>

  <!-- side text -->
  <div class="absolute rotate-90 tracking-[-0.2em] text-muted italic" style="left: -4.5rem; top: -18rem; font-size: 37vh;">
    <span class="z-1">0{selectedIndex + 1}</span>
  </div>
</main>
