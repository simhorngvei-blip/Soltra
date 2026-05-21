"""
Soltra Native TTS Server — Direct Chatterbox Voice Cloning
=========================================================
Standalone FastAPI microservice that uses the chatterbox-tts engine
directly for zero-shot voice cloning and multilingual TTS.

Designed to run using the Voicebox venv which already has PyTorch +
chatterbox-tts installed, but with zero dependency on the Voicebox app.

Usage:
    d:\voicebox\backend\venv310\Scripts\python.exe server.py
"""

import asyncio
import io
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse

# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
SERVER_PORT = 8099
PROFILES_DIR = Path(__file__).parent / "profiles"
PROFILES_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Soltra-tts")

# ──────────────────────────────────────────────────────────────
# App
# ──────────────────────────────────────────────────────────────
app = FastAPI(title="Soltra TTS", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# Global Model State
# ──────────────────────────────────────────────────────────────
_model = None
_device = None
_model_lock = asyncio.Lock()
_model_loading = False

LANG_DEFAULTS = {
    "he": {"exaggeration": 0.4, "cfg_weight": 0.7, "temperature": 0.65, "repetition_penalty": 2.5},
}
GLOBAL_DEFAULTS = {"exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8, "repetition_penalty": 2.0}


def _get_device() -> str:
    """Select best available torch device."""
    import torch
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def _load_model_sync():
    """Load ChatterboxMultilingualTTS into memory (blocking)."""
    global _model, _device
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    device = _get_device()
    _device = device
    logger.info(f"Loading Chatterbox Multilingual TTS on {device}...")

    t0 = time.time()
    if device == "cpu":
        _orig = torch.load
        def _patched(*a, **kw):
            kw.setdefault("map_location", "cpu")
            return _orig(*a, **kw)
        torch.load = _patched
        try:
            model = ChatterboxMultilingualTTS.from_pretrained(device=device)
        finally:
            torch.load = _orig
    else:
        model = ChatterboxMultilingualTTS.from_pretrained(device=device)

    # Fix sdpa attention
    t3_tfmr = model.t3.tfmr
    if hasattr(t3_tfmr, "config") and hasattr(t3_tfmr.config, "_attn_implementation"):
        t3_tfmr.config._attn_implementation = "eager"
        for layer in getattr(t3_tfmr, "layers", []):
            if hasattr(layer, "self_attn"):
                layer.self_attn._attn_implementation = "eager"

    # Patch float32 precision
    try:
        from backends.base import patch_chatterbox_f32
        patch_chatterbox_f32(model)
    except ImportError:
        pass  # Running standalone — skip optional patch

    _model = model
    elapsed = time.time() - t0
    logger.info(f"Chatterbox loaded in {elapsed:.1f}s on {device}")


async def ensure_model():
    """Ensure the model is loaded, loading it if necessary."""
    global _model, _model_loading
    if _model is not None:
        return
    async with _model_lock:
        if _model is not None:
            return
        _model_loading = True
        try:
            await asyncio.to_thread(_load_model_sync)
        finally:
            _model_loading = False


# ──────────────────────────────────────────────────────────────
# Profile helpers
# ──────────────────────────────────────────────────────────────
def _get_profiles():
    """List all voice profiles from disk."""
    profiles = []
    for meta_file in PROFILES_DIR.glob("*/meta.json"):
        try:
            meta = json.loads(meta_file.read_text(encoding="utf-8"))
            profiles.append(meta)
        except Exception:
            continue
    return profiles


def _get_profile(profile_id: str):
    """Get a single profile by ID."""
    meta_path = PROFILES_DIR / profile_id / "meta.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text(encoding="utf-8"))


# ──────────────────────────────────────────────────────────────
# Startup Event — Pre-warm the model
# ──────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("   Soltra NATIVE TTS SERVER v1.0")
    logger.info("   Pre-warming Chatterbox model...")
    logger.info("=" * 60)
    await ensure_model()
    logger.info("Model pre-warmed. Server ready for requests.")


# ──────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    import torch
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else None
    vram = 0.0
    if gpu_available:
        vram = round(torch.cuda.memory_allocated(0) / 1024 / 1024, 1)

    return {
        "status": "healthy",
        "model_loaded": _model is not None,
        "model_loading": _model_loading,
        "gpu_available": gpu_available,
        "gpu_type": f"CUDA ({gpu_name})" if gpu_name else "CPU",
        "vram_used_mb": vram,
        "profiles_count": len(_get_profiles()),
    }


@app.get("/profiles")
async def list_profiles():
    return _get_profiles()


@app.get("/profiles/{profile_id}")
async def get_profile(profile_id: str):
    profile = _get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/clone")
async def clone_voice(
    name: str = Form(...),
    reference_text: str = Form(""),
    audio: UploadFile = File(...),
):
    """
    Upload a reference audio file to create a new voice clone profile.
    The Chatterbox engine uses the raw audio path at generation time.
    """
    profile_id = str(uuid.uuid4())
    profile_dir = PROFILES_DIR / profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)

    # Save the uploaded audio
    audio_bytes = await audio.read()
    ext = Path(audio.filename).suffix or ".wav"
    audio_path = profile_dir / f"reference{ext}"
    audio_path.write_bytes(audio_bytes)

    # Save metadata
    meta = {
        "id": profile_id,
        "name": name,
        "reference_text": reference_text,
        "audio_file": str(audio_path),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (profile_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    logger.info(f"Created voice profile '{name}' ({profile_id})")
    return meta


@app.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: str):
    profile_dir = PROFILES_DIR / profile_id
    if not profile_dir.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
    import shutil
    shutil.rmtree(profile_dir)
    logger.info(f"Deleted profile {profile_id}")
    return {"status": "deleted"}


@app.post("/generate")
async def generate_speech(
    text: str = Form(...),
    profile_id: str = Form(...),
    language: str = Form("en"),
):
    """
    Generate speech using a cloned voice profile.
    Returns WAV audio bytes.
    """
    import torch
    import struct

    await ensure_model()

    profile = _get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    ref_audio = profile.get("audio_file")
    if ref_audio and not Path(ref_audio).exists():
        raise HTTPException(status_code=400, detail="Reference audio file missing from disk")

    lang_defaults = LANG_DEFAULTS.get(language, GLOBAL_DEFAULTS)

    t0 = time.time()

    def _generate_sync():
        logger.info(f"Generating: text='{text[:50]}...' lang={language} profile={profile['name']}")

        wav = _model.generate(
            text,
            language_id=language,
            audio_prompt_path=ref_audio,
            exaggeration=lang_defaults["exaggeration"],
            cfg_weight=lang_defaults["cfg_weight"],
            temperature=lang_defaults["temperature"],
            repetition_penalty=lang_defaults["repetition_penalty"],
        )

        if isinstance(wav, torch.Tensor):
            audio = wav.squeeze().cpu().numpy().astype(np.float32)
        else:
            audio = np.asarray(wav, dtype=np.float32)

        sample_rate = getattr(_model, "sr", None) or getattr(_model, "sample_rate", 24000)
        return audio, sample_rate

    audio_np, sr = await asyncio.to_thread(_generate_sync)

    elapsed = time.time() - t0
    logger.info(f"Generated {len(audio_np)/sr:.1f}s audio in {elapsed:.2f}s")

    # Encode as WAV
    audio_int16 = (audio_np * 32767).clip(-32768, 32767).astype(np.int16)
    buf = io.BytesIO()
    # Write WAV header manually
    num_samples = len(audio_int16)
    data_size = num_samples * 2  # 16-bit = 2 bytes per sample
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))       # chunk size
    buf.write(struct.pack("<H", 1))        # PCM format
    buf.write(struct.pack("<H", 1))        # mono
    buf.write(struct.pack("<I", sr))       # sample rate
    buf.write(struct.pack("<I", sr * 2))   # byte rate
    buf.write(struct.pack("<H", 2))        # block align
    buf.write(struct.pack("<H", 16))       # bits per sample
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(audio_int16.tobytes())

    return Response(
        content=buf.getvalue(),
        media_type="audio/wav",
        headers={
            "X-Generation-Time": f"{elapsed:.2f}",
            "X-Audio-Duration": f"{len(audio_np)/sr:.1f}",
        },
    )


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=SERVER_PORT, log_level="info")
