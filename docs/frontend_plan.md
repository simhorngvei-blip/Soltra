# Project Soltra: Frontend Audit & Implementation Plan

This document outlines the identified flaws across the SOLTRA ecosystem frontends and provides a structured implementation plan to address them.

## 🛡️ Persona Hub (5174) Audit Checklist
- [x] **Settings/Logout buttons**: Logic attached; `SettingsPage.jsx` integrated.
- [x] **Sensor Fusion Readings**: Connected to real-time stream via `useSoltraTelemetry`.
- [x] **Facial Override**: Integrated with LLM sentiment analysis for auto-expressions.
- [x] **Voice Clone Button**: Interaction logic fixed and integrated with backend.
- [x] **Voicebox TTS**: Health probe and browser fallback reliability improved.
- [x] **Shader Mode**: Toon shader enforced via props in `SystemHub`.
- [x] **Navigation Links**: Fixed redirects and initialized router paths.
- [x] **Hardware Logs / Grid**: Linked to live Supabase data feed.

## 📊 SOLTRA Dashboard (5173) Audit Checklist
- [x] **LLM Expression Sync**: Avatar auto-reacts to conversation sentiment.
- [x] **Command List**: Visual CLI command reference added to terminal.
- [x] **Live Sensor Data**: Switched from static to real-time Supabase telemetry.
- [x] **History Graphs**: Integrated `recharts` for irradiance trends.
- [x] **Weather Component**: Integrated Open-Meteo API for real-time environment data.
- [x] **S3 Camera Feed**: Live surveillance feed integrated into modal.

## 🌐 SOLTRA SaaS (3001) Audit Checklist
- [x] **Idle Animation Error**: Resolved mixer/loader race conditions in `vrm-scene.tsx` and fixed SSR dynamic import.

---

# 🚀 Implementation Plan: Phase 1

> [!IMPORTANT]
> This plan focuses on "Hardware-Software Parity" — ensuring the UI reflects actual machine state.

## 1. Unified Sensor & Telemetry Integration
- **Action**: Connect `Sensor Fusion` and `Telemetry` panels to real data.
- **Method**: 
  - Implement a `useSoltraTelemetry` hook using Supabase Realtime or MQTT.
  - Bridge the `d:\SOLTRA\soltra-saas\supabase` logic to the dashboard.
- **Files**: `persona/src/SystemHub.jsx`, `soltra-dashboard/src/App.jsx`.

## 2. AI Overseer Functional Hardening (Persona Hub)
- **Action**: Fix VRM Shader & Expression controls.
- **Method**:
  - Pass `shaderMode="toon"` to `VrmAvatar`.
  - Fix `VoiceCloningModule` upload handler to POST to the Voicebox API.
  - Verify `ttsService.js` endpoint configuration.
- **Files**: `persona/src/SystemHub.jsx`, `persona/src/components/VoiceCloningModule.jsx`.

## 3. Dashboard Logic Expansion
- **Action**: Add "Mission Control" features.
- **Method**:
  - Integrate `recharts` for the history graph.
  - Create `WeatherPanel` component (OpenWeather API).
  - Add `CameraFeed` component with an S3 MJPEG stream toggle.
  - Update `processCommand` to return emotional sentiment for auto-expressions.
- **Files**: `soltra-dashboard/src/App.jsx`, `soltra-dashboard/src/utils/llmService.js`.

## 4. SaaS Stability
- **Action**: Fix VRM loader race conditions.
- **Method**:
  - Refactor `vrm-scene.tsx` to use `useEffect` for animations instead of `useMemo`.
  - Validate bone mapping for `idle_anim.fbx`.
- **Files**: `soltra-saas/src/components/ui/vrm-scene.tsx`.

---

# 🛡️ Quality Gates
1. **Approval**: User confirms the plan.
2. **Phase 1 Execution**: Fix Persona Hub core functional buttons.
3. **Phase 2 Execution**: Connect Realtime Telemetry.
4. **Phase 3 Execution**: Dashboard UI feature additions.
5. **Phase 4 Execution**: SaaS Stability.

---

---

**Status:** Implementation Phase 1-4 Complete. Hardware-Software Parity established.
