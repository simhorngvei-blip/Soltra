<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { logs, telemetry } from "$lib/mqttStore";

  const ITEMS = [
    { id: "health", badge: "I", title: "SYSTEM HEALTH", subtitle: "Diagnostics & Status", rank: 1 },
    { id: "comms", badge: "II", title: "COMM LOG", subtitle: "Live MQTT Feed", rank: 2 },
  ];

  let active = $state(0);
  let mounted = $state(false);

  onMount(() => {
    const t = setTimeout(() => mounted = true, 80);
    return () => clearTimeout(t);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowUp") active = Math.max(0, active - 1);
    if (e.key === "ArrowDown") active = Math.min(ITEMS.length - 1, active + 1);
    if (e.key === "ArrowLeft") goto('/');
    if (e.key === "Escape" || e.key === "Backspace") goto('/');
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div id="menu-screen">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video src="/persona_assets/main2.mp4" autoplay loop muted playsinline></video>
  <div class="resume-entry-mask" aria-hidden="true">
    <video class="resume-entry-video" src="/persona_assets/main2.mp4" autoplay loop muted playsinline></video>
  </div>

  <div class="resume-overlay">
    <div class="resume-stack">
      <div class="resume-list-tag {mounted ? 'mounted' : ''}">HARDWARE DIAGNOSTICS</div>
      {#each ITEMS as item, index}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="resume-card-wrap {active === index ? 'active' : ''} {mounted ? 'mounted' : ''}"
          style="transition-delay: {index * 55}ms"
          onmouseenter={() => active = index}
          onclick={() => active = index}
        >
          <div class="resume-card">
            <div class="resume-badge">
              <div class="resume-badge-text">{item.badge}</div>
            </div>
            <div class="resume-card-inner">
              <div class="resume-title">{item.title}</div>
              <div class="resume-rank">
                <div class="resume-rank-label">RANK</div>
                <div class="resume-rank-number">{item.rank}</div>
              </div>
            </div>
            <div class="resume-subtitle-bar">
              <div class="resume-subtitle">{item.subtitle}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if active === 0}
      <div class="resume-detail-panel">
        <div class="resume-detail-top">
          <div class="resume-detail-top-index">01</div>
          <div class="resume-detail-top-title">HEALTH METRICS</div>
          <div class="resume-detail-top-progress">SYS</div>
        </div>

        <div class="resume-detail-list">
          <div class="resume-detail-row">
            <div class="resume-detail-row-index">01</div>
            <div class="resume-detail-row-title">Link Quality</div>
            <div class="resume-detail-status text-[#00FF41] font-bold" style="background: rgba(0,255,65,0.2)">OPTIMAL</div>
          </div>
          <div class="resume-detail-row">
            <div class="resume-detail-row-index">02</div>
            <div class="resume-detail-row-title">Tracker Actuators</div>
            <div class="resume-detail-status text-[#00FF41] font-bold" style="background: rgba(0,255,65,0.2)">{$telemetry.status.toUpperCase()}</div>
          </div>
          <div class="resume-detail-row">
            <div class="resume-detail-row-index">03</div>
            <div class="resume-detail-row-title">Sensor Node</div>
            <div class="resume-detail-status font-bold {$telemetry.node_online ? 'text-[#00FF41]' : 'text-[#FF3B3B]'}" style="background: rgba(255,255,255,0.1)">{$telemetry.node_online ? 'ONLINE' : 'OFFLINE'}</div>
          </div>
        </div>

        <div class="resume-detail-bottom">
          <div class="resume-detail-bottom-title">DETAILS</div>
          <div class="resume-detail-bullets">
            <div class="resume-detail-bullet">- Maintain progress across required systems.</div>
            <div class="resume-detail-bullet">- All hardware diagnostics pass pre-flight checks.</div>
          </div>
        </div>
      </div>
    {:else if active === 1}
      <div class="resume-detail-panel" style="display: flex; flex-direction: column;">
        <div class="resume-detail-top">
          <div class="resume-detail-top-index">02</div>
          <div class="resume-detail-top-title">COMMUNICATIONS LOG</div>
          <div class="resume-detail-top-progress">RX</div>
        </div>

        <div class="resume-detail-list overflow-y-auto" style="flex: 1; max-height: 52vh; padding-right: 10px;">
          {#each $logs as log}
            <div class="resume-detail-row" style="min-height: auto; padding: 10px 14px; gap: 8px; display: flex; flex-wrap: wrap;">
              <span class="text-[#00FF41]/80 font-mono text-sm" style="color: #94f4ff;">[{log.timestamp}]</span>
              <span class="text-[#FFB000] font-bold font-mono text-sm" style="color: #f2fcff;">RX [{log.topic}]:</span>
              <span class="text-[#f2fcff] font-mono text-sm break-all" style="color: #fff;">{log.payload}</span>
            </div>
          {:else}
            <div class="text-[#94f4ff] italic mt-4 text-center" style="font-family: 'Bebas Neue', sans-serif; font-size: 24px;">No logs received yet...</div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <div class="resume-mobile-controls" aria-label="Resume mobile controls">
    <button class="resume-mobile-btn" type="button" onclick={() => goto('/')}>
      BACK
    </button>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&display=swap');

  #menu-screen {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }
  #menu-screen > video {
    position: absolute;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 0;
  }

  .resume-entry-mask {
    position: absolute;
    inset: 0;
    z-index: 9;
    overflow: hidden;
    background: #0047FF;
    clip-path: circle(0 at 50% 50%);
    animation: resume-entry-reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    pointer-events: none;
  }

  .resume-entry-video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @keyframes resume-entry-reveal {
    from { clip-path: circle(0 at 50% 50%); }
    to { clip-path: circle(150vmax at 50% 50%); }
  }

  .resume-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }

  .resume-stack {
    position: absolute;
    top: 9vh;
    left: 2.8vw;
    width: min(47vw, 720px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
    transform: scale(0.9);
    transform-origin: top left;
  }

  .resume-list-tag {
    font-family: 'Anton', sans-serif;
    font-size: 92px;
    line-height: 0.9;
    color: #f6fbff;
    letter-spacing: 2px;
    margin: 0 0 6px 12px;
    text-shadow: 0 2px 0 rgba(0,0,0,0.18);
    opacity: 0;
    transform: translateX(-24px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
  .resume-list-tag.mounted {
    opacity: 1;
    transform: translateX(0);
  }

  .resume-card-wrap {
    position: relative;
    opacity: 0;
    transform: translateX(-48px);
    transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: all;
    cursor: pointer;
  }
  .resume-card-wrap.mounted {
    opacity: 1;
    transform: translateX(0);
  }

  .resume-card {
    position: relative;
    height: 112px;
    background: #10185f;
    clip-path: polygon(0 0, 97% 0, 100% 100%, 3% 100%);
    box-shadow: 0 8px 0 rgba(5, 13, 59, 0.85);
    transition: transform 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
    overflow: visible;
  }
  .resume-card-wrap.active .resume-card {
    background: #ffffff;
    box-shadow: 10px 8px 0 #d63232;
    transform: translateX(6px);
  }

  .resume-card-inner {
    position: absolute;
    inset: 0;
    padding: 14px 22px 14px 62px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }

  .resume-badge {
    position: absolute;
    top: 10px;
    left: -10px;
    width: 56px;
    height: 70px;
    background: #0b113d;
    border: 3px solid #9cf7ff;
    clip-path: polygon(14% 0, 100% 0, 84% 100%, 0 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(-8deg);
    box-shadow: 0 4px 0 rgba(0,0,0,0.28);
    transition: background 0.22s ease, border-color 0.22s ease;
  }
  .resume-badge-text {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 36px;
    color: #d2fdff;
    letter-spacing: 1px;
    transform: rotate(8deg);
  }
  .resume-card-wrap.active .resume-badge {
    background: #000;
    border-color: #000;
  }
  .resume-card-wrap.active .resume-badge-text {
    color: #fff;
  }

  .resume-title {
    font-family: 'Anton', sans-serif;
    font-size: 56px;
    line-height: 0.9;
    letter-spacing: 1px;
    color: #a5f6ff;
    transition: color 0.22s ease;
  }
  .resume-card-wrap.active .resume-title {
    color: #000;
  }

  .resume-rank {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .resume-rank-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: 2px;
    color: #9ffbff;
    transition: color 0.22s ease;
  }
  .resume-rank-number {
    font-family: 'Anton', sans-serif;
    font-size: 70px;
    line-height: 0.82;
    color: #9ffbff;
    transition: color 0.22s ease;
  }
  .resume-card-wrap.active .resume-rank-label,
  .resume-card-wrap.active .resume-rank-number {
    color: #000;
  }

  .resume-subtitle-bar {
    position: absolute;
    left: 64px;
    right: 14px;
    bottom: 12px;
    height: 34px;
    background: #85f4ff;
    clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
    display: flex;
    align-items: center;
    padding: 0 18px;
    transition: background 0.22s ease;
  }
  .resume-card-wrap.active .resume-subtitle-bar {
    background: #000;
  }

  .resume-subtitle {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    line-height: 1;
    letter-spacing: 1px;
    color: #041238;
    transition: color 0.22s ease;
  }
  .resume-card-wrap.active .resume-subtitle {
    color: #fff;
  }

  .resume-detail-panel {
    position: absolute;
    top: 9.5vh;
    right: 4.5vw;
    width: min(39vw, 620px);
    min-height: 74vh;
    z-index: 12;
    padding: 22px 24px 24px 24px;
    background: linear-gradient(180deg, rgba(15, 28, 105, 0.96) 0%, rgba(8, 16, 68, 0.97) 100%);
    clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%);
    box-shadow:
      inset 0 0 0 1px rgba(133, 244, 255, 0.16),
      16px 16px 0 rgba(0, 6, 30, 0.55);
    overflow: hidden;
  }
  .resume-detail-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, rgba(133, 244, 255, 0.08) 0 15%, transparent 15% 100%),
      linear-gradient(180deg, rgba(255,255,255,0.05), transparent 24%);
    pointer-events: none;
  }
  .resume-detail-top {
    position: relative;
    display: grid;
    grid-template-columns: 70px 1fr auto;
    align-items: center;
    gap: 14px;
    min-height: 92px;
    padding: 0 18px;
    background: linear-gradient(90deg, #8ef5ff 0%, #d3fdff 100%);
    clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
    color: #08153f;
    box-shadow: 10px 0 0 rgba(255, 94, 136, 0.88);
  }
  .resume-detail-top-index {
    font-family: 'Anton', sans-serif;
    font-size: 46px;
    line-height: 1;
  }
  .resume-detail-top-title {
    font-family: 'Anton', sans-serif;
    font-size: 42px;
    line-height: 0.92;
    letter-spacing: 1px;
  }
  .resume-detail-top-progress {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 42px;
    letter-spacing: 2px;
    line-height: 1;
  }
  .resume-detail-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 18px;
  }
  .resume-detail-row {
    display: grid;
    grid-template-columns: 50px 1fr auto;
    align-items: center;
    gap: 14px;
    min-height: 56px;
    padding: 0 14px;
    background: rgba(8, 18, 72, 0.96);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
    box-shadow: inset 0 0 0 1px rgba(140, 239, 255, 0.12);
    transition: transform 0.16s ease, background 0.16s ease;
  }
  .resume-detail-row:hover {
    transform: translateX(4px);
    background: rgba(12, 26, 94, 1);
  }
  .resume-detail-row-index {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 26px;
    letter-spacing: 1px;
    color: #94f4ff;
  }
  .resume-detail-row-title {
    font-family: 'Anton', sans-serif;
    font-size: 28px;
    line-height: 1;
    color: #f2fcff;
  }
  .resume-detail-status {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    line-height: 1;
    letter-spacing: 1.1px;
    color: #06133b;
    background: #8df6ff;
    padding: 7px 12px;
    clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
  }
  .resume-detail-bottom {
    position: relative;
    margin-top: 22px;
    padding: 18px;
    background: rgba(5, 13, 57, 0.97);
    clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%);
    box-shadow: inset 0 0 0 1px rgba(145, 239, 255, 0.12);
  }
  .resume-detail-bottom-title {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 30px;
    letter-spacing: 2px;
    color: #91f5ff;
    margin-bottom: 14px;
  }
  .resume-detail-bullets {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .resume-detail-bullet {
    font-family: 'Anton', sans-serif;
    font-size: 21px;
    line-height: 1.15;
    color: #edfaff;
  }

  .resume-mobile-controls {
    display: none;
  }

  .resume-mobile-btn {
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(6, 13, 55, 0.8);
    color: #fff;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 1.2px;
    font-size: 13px;
    padding: 7px 12px;
    border-radius: 8px;
    min-width: 84px;
  }

  @media (max-width: 768px) {
    .resume-mobile-controls {
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: max(8px, env(safe-area-inset-bottom));
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      pointer-events: all;
    }
  }

  /* Custom scrollbar for logs */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(148, 244, 255, 0.3);
    border-radius: 4px;
  }
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(148, 244, 255, 0.6);
  }
</style>
