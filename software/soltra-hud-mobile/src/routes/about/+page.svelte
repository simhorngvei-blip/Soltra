<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { telemetry, mqttStatus } from "$lib/mqttStore";

  const CHARS = ["/persona_assets/char1.png", "/persona_assets/char2.png", "/persona_assets/char3.png"];
  const MAIN_IMAGES = ["/persona_assets/mainm.jpeg", "/persona_assets/mainm2.jpeg", "/persona_assets/mainf.jpeg"];

  let revealContent = $derived([
    {
      upper: [
        `WIND SPEED: ${$telemetry.wind_speed ? $telemetry.wind_speed.toFixed(1) : '--'} m/s`,
        `SOLAR YIELD: ${$telemetry.solar_yield ? $telemetry.solar_yield.toFixed(1) : '--'} W/m²`,
        `PANEL AZIMUTH: ${$telemetry.panel_angle ? $telemetry.panel_angle.toFixed(1) : '--'}°`
      ],
      lower: "Helios Telemetry Matrix",
    },
    {
      upper: [
        `TRACKER STATUS: ${$telemetry.status.toUpperCase()}`,
        `WIND ALERT: ${$telemetry.wind_alert ? 'ALERT!' : 'NOMINAL'}`,
        `SENSOR NODE: ${$telemetry.node_online ? 'ONLINE' : 'OFFLINE'}`,
      ],
      lower: `Link: ${$mqttStatus} | Light: ${$telemetry.light_level}`,
    },
    {
      upper: [
        "SYSTEM VERSION 4.2.0",
        "NODE DIAGNOSTICS: OPTIMAL",
        "ALL ACTUATORS RESPONSIVE"
      ],
      lower: "diagnostics nominal",
    },
  ]);

  const ROLES = [
    { text: "HELIOS", color: "#e8c100", bg: "rgba(232,193,0,0.12)", border: "rgba(232,193,0,0.5)" },
    { text: "STATUS",  color: "#4a8fff", bg: "rgba(74,143,255,0.12)", border: "rgba(74,143,255,0.5)" },
    { text: "DIAG",  color: "#4a8fff", bg: "rgba(74,143,255,0.12)", border: "rgba(74,143,255,0.5)" },
  ];

  const ITEMS = [
    { id: "telemetry", label: "TELEMETRY" },
    { id: "status", label: "SYSTEM STATUS" },
    { id: "sensors", label: "DIAGNOSTICS" },
  ];

  let active = $state(0);
  let mounted = $state(false);
  let revealed = $state(false);

  onMount(() => {
    const t = setTimeout(() => mounted = true, 60);
    return () => clearTimeout(t);
  });

  function handleBarClick(index: number) {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches && active === index) {
      revealed = !revealed;
      return;
    }

    active = index;
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      revealed = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowUp") active = Math.max(0, active - 1);
    if (e.key === "ArrowDown") active = Math.min(ITEMS.length - 1, active + 1);
    if (e.key === "Enter") revealed = true;
    if (e.key === "ArrowRight") revealed = true;
    if (e.key === "ArrowLeft") {
      if (revealed) revealed = false;
      else goto('/');
    }
    if (e.key === "Escape" || e.key === "Backspace") goto('/');
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div id="menu-screen">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video src="/persona_assets/main1.mp4" autoplay loop muted playsinline></video>
  
  {#if revealed}
    <div class="sc-dim"></div>
  {/if}

  {#if revealed}
    <div class="sc-reveal-panel {mounted ? 'mounted' : ''}">
      <div class="sc-reveal-upper-bar">
        {#each revealContent[active].upper as line}
          <div class="sc-reveal-upper-line">{line}</div>
        {/each}
      </div>
      <div class="sc-reveal-lower-bar">{revealContent[active].lower}</div>
    </div>
  {/if}

  {#if revealed}
    <div class="sc-right-nav">
      <span class="sc-nav-arrow left">◄</span>
      <span class="sc-nav-btn">LB</span>
      <span class="sc-nav-dot"></span>
      <span class="sc-nav-btn">RB</span>
      <span class="sc-nav-arrow right">►</span>
    </div>
  {/if}

  {#if revealed}
    <div class="sc-main-portrait-shell {mounted ? 'mounted' : ''}">
      <img
        class="sc-main-portrait"
        src={MAIN_IMAGES[active]}
        alt=""
      />
    </div>
  {/if}

  <div class="sc-root" role="navigation">
    {#each ITEMS as item, i}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="sc-bar-outer {active === i ? 'active' : ''} {mounted ? 'mounted' : ''}"
        onclick={() => handleBarClick(i)}
        onmouseenter={() => active = i}
      >
        <div class="sc-bar-red"></div>
        <div class="sc-bar">
          <img class="sc-char" src={CHARS[i]} alt="" />
          <div class="sc-bar-fill"></div>
          <div class="sc-bar-shade"></div>
          <div class="sc-bar-content">
            <div class="sc-role">{ROLES[i].text}</div>
            <div class="sc-main">
              <div class="sc-main-top">
                <div class="sc-label">{item.label}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <div class="sc-footer {mounted ? 'mounted' : ''}">
    <div class="sc-footer-row"><span class="sc-footer-key">↑↓</span><span>SELECT</span></div>
    <div class="sc-footer-row"><span class="sc-footer-key">↵</span><span>REVEAL</span></div>
    <div class="sc-footer-row"><span class="sc-footer-key">ESC</span><span>BACK</span></div>
  </div>

  <div class="sc-mobile-controls" aria-label="About mobile controls">
    <button class="sc-mobile-btn" type="button" onclick={() => goto('/')}>
      BACK
    </button>
    <button class="sc-mobile-btn" type="button" onclick={() => revealed = !revealed}>
      {revealed ? "HIDE" : "REVEAL"}
    </button>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:ital,wght@0,400;0,700;1,700&family=Montserrat:wght@300&display=swap');
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

  .sc-root {
    position: absolute;
    inset: 0;
    z-index: 6;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
    padding-left: 0;
  }

  .sc-dim {
    position: absolute;
    inset: 0;
    z-index: 12;
    background: rgba(40, 45, 54, 0.68);
    pointer-events: none;
    animation: sc-dim-in 0.32s ease-out;
  }

  @keyframes sc-dim-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes sc-reveal-bar-in {
    0% {
      opacity: 0;
      transform: translateX(-120px) rotate(-20deg) scaleX(0.72);
    }
    60% {
      opacity: 0.96;
      transform: translateX(18px) rotate(-20deg) scaleX(1.03);
    }
    100% {
      opacity: 0.92;
      transform: translateX(0) rotate(-20deg) scaleX(1);
    }
  }

  @keyframes sc-portrait-in {
    0% {
      opacity: 0;
      transform: translateX(78px) skewX(-8deg) scale(0.94);
      filter: blur(8px);
    }
    55% {
      opacity: 0.9;
      transform: translateX(-8px) skewX(-8deg) scale(1.015);
      filter: blur(0);
    }
    100% {
      opacity: 0.96;
      transform: translateX(0) skewX(-8deg) scale(1);
      filter: blur(0);
    }
  }

  @keyframes sc-arrow-left {
    0%, 100% { transform: translateX(0); opacity: 1; }
    50% { transform: translateX(-5px); opacity: 0.4; }
  }

  @keyframes sc-arrow-right {
    0%, 100% { transform: translateX(0); opacity: 1; }
    50% { transform: translateX(5px); opacity: 0.4; }
  }

  .sc-main-portrait-shell {
    position: absolute;
    top: 0;
    right: -3vw;
    z-index: 13;
    pointer-events: none;
    width: 43vw;
    height: 100vh;
    overflow: hidden;
    opacity: 0;
    transform: translateX(24px) skewX(-8deg) scale(0.98);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
  .sc-main-portrait-shell.mounted {
    opacity: 0.96;
    transform: translateX(0) skewX(-8deg) scale(1);
    animation: sc-portrait-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .sc-reveal-panel {
    position: absolute;
    top: 44vh;
    left: -6vw;
    width: 88vw;
    height: 60vh;
    z-index: 12;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(243,246,252,0.98) 100%);
    clip-path: polygon(0 0, 100% 0, calc(100% - 88px) 100%, 0 100%);
    box-shadow:
      0 0 0 2px rgba(255,255,255,0.18),
      18px 0 0 rgba(215, 13, 44, 0.82),
      28px 0 0 rgba(255,255,255,0.26);
    opacity: 0;
    transform: translateX(-40px) rotate(-20deg);
    transform-origin: left bottom;
    transition: opacity 0.3s ease, transform 0.35s ease;
  }
  .sc-reveal-panel.mounted {
    opacity: 0.92;
    transform: translateX(0) rotate(-20deg);
    animation: sc-reveal-bar-in 0.46s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .sc-reveal-panel::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 8px;
    background: linear-gradient(180deg, #e03d31 0%, #eb3333 100%);
    clip-path: inherit;
  }
  .sc-reveal-upper-bar {
    position: absolute;
    top: 10%;
    left: 0%;
    width: 100%;
    height: 40%;
    background: rgba(0, 0, 0, 0.92);
    clip-path: polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #fff;
    text-align: center;
  }
  .sc-reveal-upper-line {
    font-family: 'Montserrat', sans-serif;
    font-weight: 300;
    font-size: 20px;
    letter-spacing: 0.5px;
    line-height: 1.15;
  }
  .sc-reveal-lower-bar {
    position: absolute;
    top: 58%;
    right: 0;
    width: 48%;
    min-height: 20%;
    max-height: 34%;
    background: rgba(0, 0, 0, 0.92);
    clip-path: polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%);
    box-shadow: 0 0 0 1px rgba(255,255,255,0.06);
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    color: #fff;
    font-family: 'Montserrat', sans-serif;
    font-weight: 300;
    font-size: 22px;
    line-height: 1.18;
    letter-spacing: 0.4px;
    text-transform: lowercase;
    white-space: normal;
    overflow-y: auto;
    padding: 10px 18px 10px 22px;
  }

  @keyframes sc-right-nav-pop {
    0%   { opacity: 0; transform: scale(0.55) translateY(-10px); }
    65%  { opacity: 1; transform: scale(1.1) translateY(2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .sc-right-nav {
    position: absolute;
    top: 10vh;
    left: 6vw;
    display: flex;
    align-items: center;
    gap: 6px;
    pointer-events: none;
    z-index: 14;
    transform: translateX(-40px) rotate(-20deg);
    transform-origin: left bottom;
    animation: sc-right-nav-pop 0.38s cubic-bezier(0.22,1,0.36,1) both;
  }
  .sc-right-nav .sc-nav-btn {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 100px;
    letter-spacing: 3px;
    line-height: 1;
    user-select: none;
    color: #fff;
    -webkit-text-stroke: 2px #000;
    paint-order: stroke fill;
    background: none;
    border: none;
    padding: 0 6px;
  }
  .sc-right-nav .sc-nav-dot {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    background: #111;
    margin: 0 10px;
    flex-shrink: 0;
  }
  .sc-right-nav .sc-nav-arrow {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    color: #c4001a;
    display: inline-block;
    user-select: none;
  }
  .sc-right-nav .sc-nav-arrow.left  { animation: sc-arrow-left  0.8s ease-in-out infinite; }
  .sc-right-nav .sc-nav-arrow.right { animation: sc-arrow-right 0.8s ease-in-out infinite; }

  .sc-main-portrait {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top right;
    transform: skewX(8deg) scale(1.08);
    transform-origin: top right;
  }

  /* ── Each bar ── */
  .sc-bar {
    position: relative;
    width: 45vw;
    height: 64px;
    transition: height 0.3s cubic-bezier(0.22,1,0.36,1);
    background: #111;
    cursor: pointer;
    pointer-events: all;
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
    box-shadow: 0 6px 24px rgba(0,0,0,0.65);
    z-index: 1;
  }

  /* wrapper holds both the red underlay and the bar */
  .sc-bar-outer {
    position: relative;
    flex-shrink: 0;
    transform: translateX(-100%);
    transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .sc-bar-outer.active .sc-bar     { height: 90px; }
  .sc-bar-outer.active .sc-bar-red { height: 90px; }
  .sc-bar-outer.mounted { transform: translateX(0); }
  .sc-bar-outer:nth-child(1) { transition-delay: 0ms; }
  .sc-bar-outer:nth-child(2) { transition-delay: 80ms; }
  .sc-bar-outer:nth-child(3) { transition-delay: 160ms; }

  /* red underlay — peeks out below the bar when active */
  .sc-bar-red {
    position: absolute;
    top: 0; left: 0;
    width: 45vw;
    height: 64px;
    background: #c4001a;
    clip-path: polygon(50% 0, 100% 0, 100% 100%, calc(50% - 10px) 100%);
    transform: translateY(-7px);
    opacity: 0;
    transition: opacity 0.2s ease;
    z-index: 0;
    pointer-events: none;
  }
  .sc-bar-outer.active .sc-bar-red { opacity: 1; }

  /* white fill — skewed parallelogram on the right 25% */
  .sc-bar-fill {
    position: absolute;
    inset: 0;
    width: 100%;
    background: #ffffff;
    clip-path: polygon(100% 0, 100% 0, calc(100% - 32px) 100%, calc(100% - 32px) 100%);
    transition: clip-path 0.35s cubic-bezier(0.22, 1, 0.36, 1);
    z-index: 0;
  }
  .sc-bar-outer.active .sc-bar-fill {
    clip-path: polygon(22% 0, 100% 0, calc(100% - 14px) 100%, calc(22% + 138px) 100%);
  }

  /* shade on the left edge of the white fill */
  .sc-bar-shade {
    position: absolute;
    top: 0; bottom: 0;
    left: 73%;
    width: 6%;
    background: linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 100%);
    z-index: 1;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.35s ease;
  }
  .sc-bar-outer.active .sc-bar-shade { opacity: 1; }

  /* bottom shadow line under each bar */
  .sc-bar::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 6px;
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%);
    z-index: 10;
    pointer-events: none;
  }

  /* content layout inside each bar */
  .sc-bar-content {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px 0 20px;
  }

  /* left: role label */
  .sc-role {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    font-family: 'Anton', sans-serif;
    font-size: 50px;
    letter-spacing: -2px;
    color: #ffffff;
    transform: rotate(-30deg);
    user-select: none;
    line-height: 1;
    padding: 0 16px 0 8px;
  }

  /* left: icon + name centered in remaining space */
  .sc-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding-left: 78px;
  }
  .sc-main-top {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .sc-label {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    letter-spacing: 4px;
    line-height: 1;
    color: rgba(255,255,255,0.85);
    transition: color 0.2s ease;
    user-select: none;
  }
  .sc-bar-outer.active .sc-label { color: #111111; }

  /* character portrait */
  .sc-char {
    position: absolute;
    top: 0;
    left: 110px;
    height: 100%;
    width: auto;
    max-width: 160px;
    object-fit: cover;
    object-position: top;
    pointer-events: none;
    z-index: 3;
    clip-path: polygon(20px 0%, 100% 0%, calc(100% - 20px) 100%, 0% 100%);
  }

  /* footer hints */
  .sc-footer {
    position: fixed;
    bottom: 20px; right: 28px;
    display: flex; flex-direction: column;
    align-items: flex-end; gap: 5px;
    font-family: 'Bebas Neue', sans-serif;
    z-index: 14;
    opacity: 0;
    transition: opacity 0.4s ease 0.6s;
  }
  .sc-footer.mounted { opacity: 1; }
  .sc-footer-row {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; letter-spacing: 2px;
    color: rgba(255,255,255,0.22);
  }
  .sc-footer-key {
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 3px;
    padding: 1px 6px; font-size: 11px;
  }

  .sc-mobile-controls {
    display: none;
  }

  .sc-mobile-btn {
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-family: 'Bebas Neue', sans-serif;
    letter-spacing: 1.2px;
    font-size: 13px;
    padding: 7px 12px;
    border-radius: 8px;
    min-width: 86px;
  }

  @media (max-width: 768px) {
    .sc-main-portrait-shell {
      top: 8vh;
      right: -9vw;
      width: 46vw;
      height: 44vh;
      z-index: 13;
    }

    .sc-main-portrait {
      transform: none;
      object-position: center top;
    }

    .sc-reveal-panel {
      top: 44vh !important;
      left: 4vw !important;
      right: 6vw !important;
      width: auto !important;
      height: 50vh !important;
      z-index: 14;
      transform: translateX(0) rotate(0deg) !important;
      clip-path: polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%);
      box-shadow:
        0 0 0 2px rgba(255,255,255,0.24),
        10px 0 0 rgba(215, 13, 44, 0.9),
        16px 0 0 rgba(255,255,255,0.24);
    }

    .sc-reveal-panel.mounted {
      transform: translateX(0) rotate(0deg) !important;
    }

    .sc-reveal-panel::after {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      width: 18px;
      height: 100%;
      background: linear-gradient(180deg, rgba(224,61,49,0.95) 0%, rgba(168,22,43,0.92) 100%);
      clip-path: polygon(20% 0, 100% 0, 100% 100%, 0 100%);
      opacity: 0.95;
      pointer-events: none;
    }

    .sc-reveal-upper-bar {
      top: 10%;
      height: 46%;
      width: 96%;
      left: 2%;
    }

    .sc-reveal-upper-line {
      font-size: 14px;
      line-height: 1.1;
      padding: 0 10px;
    }

    .sc-reveal-lower-bar {
      top: 62%;
      width: 88%;
      bottom: 8%;
      height: auto;
      max-height: none;
      font-size: 15px;
      line-height: 1.2;
      padding: 8px 12px 8px 12px;
    }

    .sc-right-nav {
      top: 2vh;
      left: 4vw;
      transform: translateX(0) rotate(-12deg);
    }

    .sc-mobile-controls {
      position: fixed;
      left: 8px;
      right: 8px;
      bottom: max(8px, env(safe-area-inset-bottom));
      z-index: 18;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      pointer-events: all;
    }

    .sc-footer {
      display: none;
    }
  }

  @media (min-width: 769px) and (max-width: 1200px) {
    .sc-main-portrait-shell {
      right: -6vw;
      width: 44vw;
      height: 92vh;
    }

    .sc-reveal-panel {
      top: 46vh;
      left: -2vw;
      width: 78vw;
      height: 52vh;
      transform: translateX(0) rotate(-14deg);
    }

    .sc-reveal-panel.mounted {
      transform: translateX(0) rotate(-14deg);
    }
  }
</style>
