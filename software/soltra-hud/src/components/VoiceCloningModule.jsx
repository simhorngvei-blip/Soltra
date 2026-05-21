/**
 * VoiceCloningModule — Native Voice Cloning UI for SOLTRA Dashboard
 * ================================================================
 * Allows uploading reference audio, naming the clone, and managing
 * voice profiles directly from the dashboard without the Voicebox app.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Upload, Trash2, Play, X, Check, Loader } from 'lucide-react';
import { cloneVoice, listProfiles, deleteProfile, generateVoiceboxTTS } from '../utils/ttsService';

export default function VoiceCloningModule({ onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [testing, setTesting] = useState(null);  // profile id being tested
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [voiceName, setVoiceName] = useState('');
  const [refText, setRefText] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const fileInputRef = useRef(null);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    const data = await listProfiles();
    setProfiles(data);
    setLoading(false);
  };

  const handleClone = async () => {
    if (!audioFile || !voiceName.trim()) {
      setError('Name and audio file are required.');
      return;
    }

    setCloning(true);
    setError(null);
    try {
      await cloneVoice(audioFile, voiceName.trim(), refText.trim());
      setSuccess(`Voice "${voiceName}" cloned successfully!`);
      setShowForm(false);
      setVoiceName('');
      setRefText('');
      setAudioFile(null);
      await loadProfiles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setCloning(false);
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await deleteProfile(id);
      setSuccess(`Deleted "${name}"`);
      await loadProfiles();
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      setError('Failed to delete profile');
    }
  };

  const handleTest = async (profile) => {
    setTesting(profile.id);
    try {
      const audioBuffer = await generateVoiceboxTTS('Hello, this is a test of the cloned voice.', 'en');
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await audioCtx.decodeAudioData(audioBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(audioCtx.destination);
      source.onended = () => setTesting(null);
      source.start(0);
    } catch (err) {
      setError(`Test failed: ${err.message}`);
      setTesting(null);
    }
  };

  const panelStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(12px)',
    fontFamily: "'Anton', sans-serif",
    letterSpacing: '2px',
  };

  const cardStyle = {
    background: 'rgba(0, 10, 20, 0.95)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    borderTop: '4px solid #ff2a2a',
    padding: '32px',
    width: '520px',
    maxHeight: '80vh',
    overflowY: 'auto',
    position: 'relative',
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(0, 20, 40, 0.8)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    color: '#fff',
    padding: '10px 14px',
    fontFamily: 'monospace',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimary = {
    background: '#ff2a2a',
    color: '#fff',
    border: 'none',
    padding: '10px 24px',
    fontFamily: "'Anton', sans-serif",
    fontSize: '14px',
    letterSpacing: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const btnGhost = {
    background: 'transparent',
    border: '1px solid rgba(0, 217, 255, 0.4)',
    color: '#00d9ff',
    padding: '8px 16px',
    fontFamily: "'Anton', sans-serif",
    fontSize: '12px',
    letterSpacing: '2px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  };

  return (
    <motion.div
      style={panelStyle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        style={cardStyle}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #00d9ff', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Mic size={20} color="#ff2a2a" />
            <span style={{ color: '#fff', fontSize: '22px', fontStyle: 'italic' }}>VOICE CLONING</span>
          </div>
          <button type="button" onClick={onClose} style={{ ...btnGhost, border: 'none', padding: '4px' }}>
            <X size={20} color="#ff2a2a" />
          </button>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ background: 'rgba(255,42,42,0.15)', border: '1px solid #ff2a2a', padding: '10px 14px', marginBottom: '16px', color: '#ff2a2a', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0px' }}
            >
              [ERR] {error}
              <button type="button" onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#ff2a2a', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ background: 'rgba(0,255,65,0.1)', border: '1px solid #00ff41', padding: '10px 14px', marginBottom: '16px', color: '#00ff41', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0px' }}
            >
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profiles List */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: '#00d9ff', marginBottom: '12px' }}>
            ACTIVE PROFILES ({profiles.length})
          </div>

          {loading ? (
            <div style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace' }}>Loading...</div>
          ) : profiles.length === 0 ? (
            <div style={{ color: '#555', fontSize: '12px', fontFamily: 'monospace', padding: '20px 0', textAlign: 'center', letterSpacing: '0px' }}>
              No voice profiles. Clone your first voice below.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profiles.map((p) => (
                <motion.div
                  key={p.id}
                  layout
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0, 20, 40, 0.6)',
                    border: '1px solid rgba(0, 217, 255, 0.2)',
                    borderLeft: '3px solid #00d9ff',
                    padding: '10px 14px',
                  }}
                >
                  <div>
                    <div style={{ color: '#fff', fontSize: '14px' }}>{p.name}</div>
                    <div style={{ color: '#555', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0px', marginTop: '2px' }}>
                      {p.id.substring(0, 8)}... · {p.created_at?.split('T')[0] || ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleTest(p)}
                      disabled={testing === p.id}
                      style={{ ...btnGhost, padding: '6px 10px', opacity: testing === p.id ? 0.5 : 1 }}
                    >
                      {testing === p.id ? <Loader size={14} className="spin" /> : <Play size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.name)}
                      style={{ ...btnGhost, padding: '6px 10px', borderColor: 'rgba(255,42,42,0.4)', color: '#ff2a2a' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Clone Form */}
        {!showForm ? (
          <button type="button" onClick={() => setShowForm(true)} style={btnPrimary}>
            <Upload size={16} /> NEW VOICE CLONE
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ borderTop: '1px solid rgba(0, 217, 255, 0.2)', paddingTop: '20px' }}
          >
            <div style={{ fontSize: '14px', color: '#ff2a2a', marginBottom: '16px' }}>NEW CLONE</div>

            {/* Name */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: '#00d9ff', display: 'block', marginBottom: '4px' }}>VOICE NAME</label>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="e.g. My Voice"
                style={inputStyle}
              />
            </div>

            {/* Reference Text */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: '#00d9ff', display: 'block', marginBottom: '4px' }}>REFERENCE TRANSCRIPT (OPTIONAL)</label>
              <textarea
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
                placeholder="Transcript of what is said in the audio..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Audio Upload */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', color: '#00d9ff', display: 'block', marginBottom: '4px' }}>REFERENCE AUDIO (.wav)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => setAudioFile(e.target.files[0])}
                style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ ...btnGhost, width: '100%', justifyContent: 'center' }}
              >
                <Upload size={14} />
                {audioFile ? audioFile.name : 'SELECT AUDIO FILE'}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleClone}
                disabled={cloning}
                style={{ ...btnPrimary, flex: 1, justifyContent: 'center', opacity: cloning ? 0.6 : 1 }}
              >
                {cloning ? (
                  <><Loader size={16} /> CLONING...</>
                ) : (
                  <><Mic size={16} /> CLONE VOICE</>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                style={btnGhost}
              >
                CANCEL
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
