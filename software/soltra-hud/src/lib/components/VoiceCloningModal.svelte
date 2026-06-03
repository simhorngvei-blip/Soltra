<script lang="ts">
  import { onMount } from 'svelte';
  import { scale, fade } from 'svelte/transition';
  import { cloneVoice, listProfiles, deleteProfile, generateVoiceboxTTS } from '$lib/ttsService';

  let { onClose } = $props();

  let profiles: any[] = $state([]);
  let loading = $state(true);
  let cloning = $state(false);
  let testing: string | null = $state(null);
  let errorMsg: string | null = $state(null);
  let successMsg: string | null = $state(null);

  let showForm = $state(false);
  let voiceName = $state('');
  let refText = $state('');
  let audioFile: File | null = $state(null);
  
  let fileInput: HTMLInputElement;

  async function loadProfiles() {
    loading = true;
    profiles = await listProfiles();
    loading = false;
  }

  onMount(() => {
    loadProfiles();
  });

  async function handleClone() {
    if (!audioFile || !voiceName.trim()) {
      errorMsg = 'Name and audio file are required.';
      return;
    }

    cloning = true;
    errorMsg = null;
    try {
      await cloneVoice(audioFile, voiceName.trim(), refText.trim());
      successMsg = `Voice "${voiceName}" cloned successfully!`;
      showForm = false;
      voiceName = '';
      refText = '';
      audioFile = null;
      await loadProfiles();
      setTimeout(() => successMsg = null, 3000);
    } catch (err: any) {
      errorMsg = err.message;
    } finally {
      cloning = false;
    }
  }

  async function handleDelete(id: string, name: string) {
    try {
      await deleteProfile(id);
      successMsg = `Deleted "${name}"`;
      await loadProfiles();
      setTimeout(() => successMsg = null, 2000);
    } catch {
      errorMsg = 'Failed to delete profile';
    }
  }

  async function handleTest(profile: any) {
    testing = profile.id;
    try {
      const audioBuffer = await generateVoiceboxTTS('Hello, this is a test of the cloned voice.', 'en');
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(audioBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(audioCtx.destination);
      source.onended = () => testing = null;
      source.start(0);
    } catch (err: any) {
      errorMsg = `Test failed: ${err.message}`;
      testing = null;
    }
  }

  function handleFileChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      audioFile = target.files[0];
    }
  }
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md" transition:fade={{ duration: 200 }}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0" onclick={onClose}></div>
  
  <div class="relative bg-bg/95 border border-primary/30 border-t-4 border-t-[#ff2a2a] p-8 w-[520px] max-h-[80vh] overflow-y-auto z-10" transition:scale={{ start: 0.9, duration: 250 }}>
    
    <!-- Header -->
    <div class="flex justify-between items-center mb-6 border-b-2 border-primary pb-3">
      <div class="flex items-center gap-2">
        <iconify-icon icon="lucide:mic" class="text-[#ff2a2a] text-2xl"></iconify-icon>
        <span class="text-white text-2xl italic font-anton tracking-widest">VOICE CLONING</span>
      </div>
      <button type="button" onclick={onClose} class="text-[#ff2a2a] hover:text-white transition-colors">
        <iconify-icon icon="lucide:x" class="text-2xl"></iconify-icon>
      </button>
    </div>

    <!-- Status Messages -->
    {#if errorMsg}
      <div class="bg-[#ff2a2a]/15 border border-[#ff2a2a] p-3 mb-4 text-[#ff2a2a] text-xs font-mono flex justify-between items-center" transition:scale>
        <span>[ERR] {errorMsg}</span>
        <button onclick={() => errorMsg = null}><iconify-icon icon="lucide:x"></iconify-icon></button>
      </div>
    {/if}
    {#if successMsg}
      <div class="bg-[#00ff41]/10 border border-[#00ff41] p-3 mb-4 text-[#00ff41] text-xs font-mono flex items-center gap-2" transition:scale>
        <iconify-icon icon="lucide:check"></iconify-icon>
        <span>{successMsg}</span>
      </div>
    {/if}

    <!-- Profiles List -->
    <div class="mb-5">
      <div class="text-sm text-primary tracking-widest mb-3">ACTIVE PROFILES ({profiles.length})</div>

      {#if loading}
        <div class="text-gray-400 text-xs font-mono">Loading...</div>
      {:else if profiles.length === 0}
        <div class="text-gray-400 text-xs font-mono py-5 text-center">No voice profiles. Clone your first voice below.</div>
      {:else}
        <div class="flex flex-col gap-2">
          {#each profiles as p (p.id)}
            <div class="flex items-center justify-between bg-[#001428]/60 border border-primary/20 border-l-4 border-l-primary p-3" transition:scale>
              <div>
                <div class="text-white text-sm tracking-wide">{p.name}</div>
                <div class="text-gray-500 text-[10px] font-mono mt-1">
                  {p.id.substring(0, 8)}... &middot; {p.created_at?.split('T')[0] || ''}
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  onclick={() => handleTest(p)}
                  disabled={testing === p.id}
                  class="bg-transparent border border-primary/40 text-primary px-3 py-1.5 hover:bg-primary/20 transition-colors disabled:opacity-50 flex items-center justify-center min-w-8"
                >
                  {#if testing === p.id}
                    <iconify-icon icon="lucide:loader" class="animate-spin"></iconify-icon>
                  {:else}
                    <iconify-icon icon="lucide:play"></iconify-icon>
                  {/if}
                </button>
                <button
                  type="button"
                  onclick={() => handleDelete(p.id, p.name)}
                  class="bg-transparent border border-[#ff2a2a]/40 text-[#ff2a2a] px-3 py-1.5 hover:bg-[#ff2a2a]/20 transition-colors"
                >
                  <iconify-icon icon="lucide:trash-2"></iconify-icon>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Clone Form -->
    {#if !showForm}
      <button type="button" onclick={() => showForm = true} class="bg-[#ff2a2a] text-white border-none py-2.5 px-6 font-anton text-sm tracking-widest flex items-center gap-2 hover:bg-white hover:text-[#ff2a2a] transition-colors w-full justify-center">
        <iconify-icon icon="lucide:upload"></iconify-icon> NEW VOICE CLONE
      </button>
    {:else}
      <div class="border-t border-primary/20 pt-5" transition:fade>
        <div class="text-sm text-[#ff2a2a] tracking-widest mb-4">NEW CLONE</div>

        <div class="mb-3">
          <label class="text-[11px] text-primary block mb-1">VOICE NAME</label>
          <input
            type="text"
            bind:value={voiceName}
            placeholder="e.g. My Voice"
            class="w-full bg-[#001428]/80 border border-primary/30 text-white p-2.5 font-mono text-[13px] outline-none focus:border-primary transition-colors"
          />
        </div>

        <div class="mb-3">
          <label class="text-[11px] text-primary block mb-1">REFERENCE TRANSCRIPT (OPTIONAL)</label>
          <textarea
            bind:value={refText}
            placeholder="Transcript of what is said in the audio..."
            rows="3"
            class="w-full bg-[#001428]/80 border border-primary/30 text-white p-2.5 font-mono text-[13px] outline-none focus:border-primary transition-colors resize-y"
          ></textarea>
        </div>

        <div class="mb-5">
          <label class="text-[11px] text-primary block mb-1">REFERENCE AUDIO (.wav)</label>
          <input
            bind:this={fileInput}
            type="file"
            accept="audio/*"
            onchange={handleFileChange}
            class="hidden"
          />
          <button
            type="button"
            onclick={() => fileInput.click()}
            class="w-full bg-transparent border border-primary/40 text-primary py-2 font-anton text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
          >
            <iconify-icon icon="lucide:upload"></iconify-icon>
            {audioFile ? audioFile.name : 'SELECT AUDIO FILE'}
          </button>
        </div>

        <div class="flex gap-3">
          <button
            type="button"
            onclick={handleClone}
            disabled={cloning}
            class="flex-1 bg-[#ff2a2a] text-white border-none py-2.5 font-anton text-sm tracking-widest flex items-center justify-center gap-2 hover:bg-white hover:text-[#ff2a2a] transition-colors disabled:opacity-60"
          >
            {#if cloning}
              <iconify-icon icon="lucide:loader" class="animate-spin"></iconify-icon> CLONING...
            {:else}
              <iconify-icon icon="lucide:mic"></iconify-icon> CLONE VOICE
            {/if}
          </button>
          <button
            type="button"
            onclick={() => { showForm = false; errorMsg = null; }}
            class="bg-transparent border border-primary/40 text-primary py-2.5 px-6 font-anton text-xs tracking-widest hover:bg-primary/20 transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    {/if}

  </div>
</div>
