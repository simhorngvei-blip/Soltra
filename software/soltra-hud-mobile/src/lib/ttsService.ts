/**
 * Soltra TTS Service — Native Chatterbox Integration
 * ==================================================
 * Connects directly to the soltra-tts server (port 8099)
 * for voice cloning and multilingual generation.
 * No dependency on the Voicebox desktop app.
 */

const SOLTRA_TTS_URL = 'http://10.0.2.2:8099';

// Cache for the active profile
let _activeProfileId: string | null = null;

export const listProfiles = async () => {
  try {
    const res = await fetch(`${SOLTRA_TTS_URL}/profiles`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

export const cloneVoice = async (audioFile: File, name: string, refText: string = '') => {
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

export const deleteProfile = async (profileId: string) => {
  const res = await fetch(`${SOLTRA_TTS_URL}/profiles/${profileId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  if (_activeProfileId === profileId) _activeProfileId = null;
};

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

export const generateVoiceboxTTS = async (text: string, language: string = 'en', profileId?: string) => {
  const resolvedProfileId = profileId || await resolveProfileId();
  if (!resolvedProfileId) {
    throw new Error('No voice profiles found. Please clone a voice first.');
  }

  const formData = new FormData();
  formData.append('text', text);
  formData.append('profile_id', resolvedProfileId);
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
