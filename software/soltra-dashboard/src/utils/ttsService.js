/**
 * Soltra TTS Service — Native Chatterbox Integration
 * ==================================================
 * Connects directly to the soltra-tts server (port 8099)
 * for voice cloning and multilingual generation.
 * No dependency on the Voicebox desktop app.
 */

const SOLTRA_TTS_URL = 'http://127.0.0.1:8099';

// Cache for the active profile
let _activeProfileId = null;

/**
 * Check soltra-tts server health and connection status.
 */
export const checkVoiceboxHealth = async () => {
  try {
    const res = await fetch(`${SOLTRA_TTS_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false };

    const data = await res.json();
    return {
      online: true,
      modelLoaded: data.model_loaded,
      modelLoading: data.model_loading,
      gpu: data.gpu_type,
      gpuAvailable: data.gpu_available,
      vramUsedMb: data.vram_used_mb,
      profilesCount: data.profiles_count,
    };
  } catch {
    return { online: false };
  }
};

/**
 * List all voice clone profiles.
 */
export const listProfiles = async () => {
  try {
    const res = await fetch(`${SOLTRA_TTS_URL}/profiles`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

/**
 * Clone a voice by uploading a reference audio file and transcript.
 * @param {File} audioFile  - The .wav reference audio file
 * @param {string} name     - Name for the voice clone
 * @param {string} refText  - Transcript of the reference audio (optional)
 * @returns {Promise<object>} The created profile metadata
 */
export const cloneVoice = async (audioFile, name, refText = '') => {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('name', name);
  formData.append('reference_text', refText);

  const res = await fetch(`${SOLTRA_TTS_URL}/clone`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Clone failed');
  }

  const profile = await res.json();
  _activeProfileId = profile.id;
  return profile;
};

/**
 * Delete a voice clone profile.
 */
export const deleteProfile = async (profileId) => {
  const res = await fetch(`${SOLTRA_TTS_URL}/profiles/${profileId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  if (_activeProfileId === profileId) _activeProfileId = null;
};

/**
 * Dynamically resolves the active profile ID.
 * Falls back to the first available profile.
 */
const resolveProfileId = async () => {
  if (_activeProfileId) return _activeProfileId;

  try {
    const profiles = await listProfiles();
    if (profiles && profiles.length > 0) {
      _activeProfileId = profiles[0].id;
      return _activeProfileId;
    }
  } catch (err) {
    console.warn('[TTS] Failed to fetch profiles', err);
  }
  return null;
};

/**
 * Generate TTS audio using a cloned voice.
 * Returns an ArrayBuffer of WAV audio.
 */
export const generateVoiceboxTTS = async (text, language = 'en') => {
  const profileId = await resolveProfileId();
  if (!profileId) {
    throw new Error('No voice profiles found. Please clone a voice first.');
  }

  const formData = new FormData();
  formData.append('text', text);
  formData.append('profile_id', profileId);
  formData.append('language', language);

  const response = await fetch(`${SOLTRA_TTS_URL}/generate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`TTS Error: ${errorData.detail || response.statusText}`);
  }

  return await response.arrayBuffer();
};
