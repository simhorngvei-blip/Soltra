# Project Soltra (including legacy Argus) - Full Development History

| Date | Time | Main Objective / First Prompt |
|---|---|---|
| 2026-05-21 | 02:53:52 | Can you start up the frontend and backend |
| 2026-05-21 | 03:15:17 | can you confirm if there is audio generated when using the audio tab. add a tts where i can just type to test out the tts |
| 2026-05-21 | 03:31:50 | can you use this as our tts https://github.com/hexgrad/kokoro |
| 2026-05-21 | 17:35:21 | As a softwre and  hardware engineer, I need you to go through the Argus workspace and reorganise the files and folders in preparation to push to github. Ensure all are separated accordingly. Make sure the name of the everything is Soltra, As I wan... |
| 2026-05-21 | 17:59:38 | /prompt-engineer /prompt-engineering i want to know what prompt can i use to get the agent to tell me what needs to be done for my whole Project Soltra to be ready to be deployed and start be sold. I need to know is there missing link between back... |
| 2026-05-21 | 18:01:09 | You are a senior full-stack software architect and SaaS deployment expert. Your task is to perform a complete pre-deployment readiness audit of Project Soltra — a SaaS platform with a Next.js frontend (soltra-saas), a Vite dashboard (soltra-dashbo... |
| 2026-05-21 | 20:48:20 | /prompt-engineer /prompt-engineering I need a prompt to make a report on the project soltra here is the basic guide lines for  it: 1. General Formatting Specifications i. Length: The report shall be no longer than 50 pages (excluding Appendices). ... |
| 2026-05-21 | 20:49:41 | Role: You are an expert technical writer and senior engineering student preparing a final academic project report. Instructions: Write a comprehensive and professional engineering project report for the \ |
| 2026-05-22 | 01:24:39 | Make sure there is no more Argus in this Soltra workspace. Have mention of Argus to Soltra |
| 2026-05-22 | 02:49:07 | You are a senior IoT firmware engineer and full-stack systems architect. Your task is to audit the hardware firmware codes (`.ino` files) in Project Soltra to determine if they need updating to ensure full compatibility and production readiness wi... |
| 2026-05-22 | 15:13:58 | can you look through the motor.ino and tell me what connection is needed for the wemos |
| 2026-05-22 | 22:14:01 | can you tell me abouth the tts in this workspace |
| 2026-05-22 | 22:21:48 | You are a senior AI audio engineer and backend systems architect. Your task is to perform a deep-dive audit and integration review of the Soltra Text-to-Speech (TTS) module located in `D:\\Soltra\\software\\soltra-tts`. ## Objective Analyze the `s... |
| 2026-05-23 | 01:59:14 | Ineed a honest opinion, tell me straight. what do you think about using the kokoro as a main tts and have the voicebox ada tts as a final day report tts. Like for causual conversation we use kokoro and we will generate a report at the end of the d... |
| 2026-05-23 | 02:07:36 | can you load the experiment folder frontends |
| 2026-05-25 | 03:11:24 | can you look through the frontend in soltra workspace and tell me which one is not connected to the deployed website |
| 2026-05-25 | 03:43:03 | we have a tts in soltra hud? what is it for? |
| 2026-05-25 | 07:26:13 | Look at the .md in the files and update them according to our progress |
| 2026-05-25 | 11:20:23 | can you look at the motor controller and remove the rtc part it is not needed anymore |
| 2026-05-25 | 15:17:23 | Let see your understanding of this workspace hardware is correct. So soltra hardware has 3 parts. Sensor nodes (3 Xiao seeed C3 and 1 Xiao Seeed s3 sense with a camera module). Master Hub( Heltec v3) Motor controller (Wemos d1 r32) Sensor nodes ta... |
| 2026-05-25 | 19:56:16 | lets reevaluate our hardware and make some sensor calibration |
| 2026-05-27 | 19:29:56 | can you tell me what does heltec do right now |
| 2026-05-27 | 19:58:41 | You are a Principal Systems Architect and Lead DevOps Engineer. Your task is to perform an exhaustive, omniscient audit of the entire Project Soltra workspace located at `D:\\Soltra`. I need to know absolutely everything about how this system oper... |
| 2026-05-27 | 19:59:39 | Perform an exhaustive audit of ALL hardware firmware in D:\\Soltra\\hardware. For EACH of the 7 directories (soltra-camera-node, soltra-camera-node-test, soltra-master-hub, soltra-motor-controller, soltra-sensor-node, soltra-sensor-node-test, uv-t... |
| 2026-05-27 | 19:59:39 | Perform an exhaustive audit of the database layer in the Soltra project at D:\\Soltra. 1. Check if there is a D:\\Soltra\\supabase directory with migration files, seed files, or schema definitions. 2. Search the ENTIRE project for Supabase referen... |
| 2026-05-27 | 19:59:39 | Perform an exhaustive audit of ALL software modules in D:\\Soltra\\software. For EACH of the 8 directories (soltra-cv, soltra-dashboard, soltra-hud, soltra-hud-mobile, soltra-saas, soltra-tts, temp-soltra, temp-soltra2), do the following: 1. Read ... |
| 2026-05-27 | 19:59:40 | Read ALL documentation files in D:\\Soltra\\docs and the project root to understand the intended architecture vs. reality. Read these files completely: 1. D:\\Soltra\\docs\\architecture.md 2. D:\\Soltra\\docs\oadmap.md 3. D:\\Soltra\\docs\\hivemq_... |



### Legacy Argus Era (Reconstructed from File Timestamps)

| Date | Inferred Activity / Modified Files |
|---|---|
| 2026-03-19 | Worked on: argus-dashboard. Modified 1.fbx in argus-dashboard |
| 2026-04-23 | Worked on: argus-dashboard, argus-saas. Total file changes: 24. |
| 2026-04-24 | Worked on: argus-dashboard, argus-saas. Created avatar.vrm in argus-dashboard, Created idle_anim.fbx in argus-dashboard, Created set_piece.glb in argus-dashboard, Modified DigitalTwinEnv.jsx in argus-dashboard, Modified avatar.vrm in argus-saas |
| 2026-04-26 | Worked on: argus-dashboard, argus-tts. Created llmService.js in argus-dashboard, Created ttsService.js in argus-dashboard, Modified reference.wav in argus-tts |
| 2026-04-29 | Worked on: argus-dashboard, argus-saas. Total file changes: 41. |
| 2026-05-05 | Worked on: argus-dashboard, argus-saas. Modified main1.mp4 in argus-dashboard, Created P3Menu.jsx in argus-dashboard, Created PageTransition.jsx in argus-dashboard, Modified makoto.vrm in argus-saas |
| 2026-05-09 | Worked on: argus-saas. Total file changes: 17. |
| 2026-05-10 | Worked on: argus-saas. Created idle.glb in argus-saas, Modified auth-provider.tsx in argus-saas |
| 2026-05-11 | Worked on: argus-dashboard, argus-saas. Total file changes: 7. |
| 2026-05-12 | Worked on: argus-dashboard. Created .env in argus-dashboard, Modified package.json in argus-dashboard, Modified index.css in argus-dashboard, Created useArgusTelemetry.js in argus-dashboard |
| 2026-05-13 | Worked on: argus-dashboard, argus-tts. Modified package-lock.json in argus-dashboard, Created server.py in argus-tts |
| 2026-05-14 | Worked on: argus-dashboard, argus-saas, argus-tts. Total file changes: 44. |
| 2026-05-15 | Worked on: argus-saas. Total file changes: 10. |

