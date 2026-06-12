"""
Soltra Native TTS Server — Kokoro Primary + Chatterbox Fallback
=========================================================
Stand-alone FastAPI microservice integrating kokoro-onnx as the primary TTS engine 
for massive performance and low RAM usage, with chatterbox-tts as a lazy-loaded 
fallback and voice-cloning engine.
"""

import asyncio
import io
import json
import logging
import os
import re
import struct
import time
import uuid
import gc
from pathlib import Path

import numpy as np
import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse

# ──────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────
SERVER_PORT = 8099
PROFILES_DIR = Path(__file__).parent / "profiles"
PROFILES_DIR.mkdir(parents=True, exist_ok=True)

# Kokoro files expected in root directory
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
KOKORO_MODEL_PATH = os.path.join(ROOT_DIR, "kokoro-v1.0.onnx")
KOKORO_VOICES_PATH = os.path.join(ROOT_DIR, "voices.json")

ALLOWED_ORIGINS = [
    "https://soltra.vercel.app",
    "http://localhost:3000"
]

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Soltra-tts")

# --- Structured JSON Logger ---
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
json_logger = logging.getLogger("TTS_JSON")
json_logger.setLevel(logging.INFO)
json_handler = logging.FileHandler(LOGS_DIR / "tts.log")
json_handler.setFormatter(logging.Formatter('%(message)s'))
json_logger.addHandler(json_handler)

app = FastAPI(title="Soltra TTS (Kokoro + Chatterbox)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────
# Global Model State & Concurrency
# ──────────────────────────────────────────────────────────────
_kokoro_model = None
_chatterbox_model = None

_kokoro_lock = asyncio.Lock()
_chatterbox_lock = asyncio.Lock()

MAX_CONCURRENT_REQUESTS = 1
_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

LANG_DEFAULTS = {
    "he": {"exaggeration": 0.4, "cfg_weight": 0.7, "temperature": 0.65, "repetition_penalty": 2.5},
}
GLOBAL_DEFAULTS = {"exaggeration": 0.5, "cfg_weight": 0.5, "temperature": 0.8, "repetition_penalty": 2.0}

def _get_device() -> str:
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"

# ──────────────────────────────────────────────────────────────
# Model Loaders
# ──────────────────────────────────────────────────────────────
def _load_kokoro_sync():
    """Load Kokoro ONNX model into memory."""
    global _kokoro_model
    logger.info("Loading Kokoro ONNX model...")
    try:
        from kokoro_onnx import Kokoro
        if not Path(KOKORO_MODEL_PATH).exists() or not Path(KOKORO_VOICES_PATH).exists():
            logger.warning("Kokoro model files not found! Please download kokoro-v1.0.onnx and voices.bin.")
            raise FileNotFoundError("Kokoro weights missing.")
        
        t0 = time.time()
        # Hotpatch open() to fix Windows charmap decode issue in kokoro-onnx 0.3.3
        import builtins
        _orig_open = builtins.open
        def _utf8_open(*args, **kwargs):
            if 'voices.json' in str(args[0]) and 'encoding' not in kwargs and 'b' not in kwargs.get('mode', 'r'):
                kwargs['encoding'] = 'utf-8'
            return _orig_open(*args, **kwargs)
        builtins.open = _utf8_open
        try:
            from kokoro_onnx import Kokoro
            _kokoro_model = Kokoro(KOKORO_MODEL_PATH, KOKORO_VOICES_PATH)
        finally:
            builtins.open = _orig_open
        logger.info(f"Kokoro loaded in {time.time() - t0:.2f}s")
    except ImportError:
        logger.error("kokoro-onnx is not installed.")
        raise
    except Exception as e:
        logger.error(f"Failed to load Kokoro: {e}")
        raise

def _load_chatterbox_sync():
    """Lazy-load Chatterbox TTS engine."""
    global _chatterbox_model
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    device = _get_device()
    logger.info(f"Lazy-loading Chatterbox on {device}...")

    t0 = time.time()
    if device == "cpu":
        _orig = torch.load
        def _patched(*a, **kw):
            kw.setdefault("map_location", "cpu")
            return _orig(*a, **kw)
        torch.load = _patched
        try:
            model = ChatterboxMultilingualTTS.from_pretrained(device=device)
            logger.info("Applying dynamic quantization for Chatterbox CPU...")
            model = torch.quantization.quantize_dynamic(
                model, {torch.nn.Linear}, dtype=torch.qint8
            )
        finally:
            torch.load = _orig
    else:
        model = ChatterboxMultilingualTTS.from_pretrained(device=device)

    # Fix sdpa attention
    t3_tfmr = getattr(model, "t3", None) and getattr(model.t3, "tfmr", None)
    if t3_tfmr and hasattr(t3_tfmr, "config") and hasattr(t3_tfmr.config, "_attn_implementation"):
        t3_tfmr.config._attn_implementation = "eager"
        for layer in getattr(t3_tfmr, "layers", []):
            if hasattr(layer, "self_attn"):
                layer.self_attn._attn_implementation = "eager"

    _chatterbox_model = model
    logger.info(f"Chatterbox loaded in {time.time() - t0:.1f}s on {device}")


async def ensure_kokoro_model():
    global _kokoro_model
    if _kokoro_model is not None:
        return
    async with _kokoro_lock:
        if _kokoro_model is not None:
            return
        await asyncio.to_thread(_load_kokoro_sync)

async def ensure_chatterbox_model():
    global _chatterbox_model
    if _chatterbox_model is not None:
        return
    async with _chatterbox_lock:
        if _chatterbox_model is not None:
            return
        await asyncio.to_thread(_load_chatterbox_sync)


def is_kokoro_voice(profile_id: str) -> bool:
    """Check if the requested profile ID is a standard Kokoro voice (e.g. af_bella)."""
    # UUIDs have dashes, Kokoro standard voices are short strings like 'af_bella' or 'am_adam'
    return len(profile_id) < 20 and "-" not in profile_id and "_" in profile_id

# ──────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────
def _get_profiles():
    profiles = []
    for meta_file in PROFILES_DIR.glob("*/meta.json"):
        try:
            profiles.append(json.loads(meta_file.read_text(encoding="utf-8")))
        except Exception:
            continue
    return profiles

def _get_profile(profile_id: str):
    meta_path = PROFILES_DIR / profile_id / "meta.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text(encoding="utf-8"))

def _create_wav_header(sample_rate: int) -> bytes:
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 0xFFFFFFFF)) 
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))       
    buf.write(struct.pack("<H", 1))        
    buf.write(struct.pack("<H", 1))        
    buf.write(struct.pack("<I", sample_rate)) 
    buf.write(struct.pack("<I", sample_rate * 2)) 
    buf.write(struct.pack("<H", 2))        
    buf.write(struct.pack("<H", 16))       
    buf.write(b"data")
    buf.write(struct.pack("<I", 0xFFFFFFFF))
    return buf.getvalue()

# ──────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("Server startup: Pre-warming Kokoro ONLY to save RAM.")
    try:
        await ensure_kokoro_model()
    except Exception as e:
        logger.error(f"Kokoro failed to load on startup. Will fallback to Chatterbox on first request. {e}")

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "kokoro_loaded": _kokoro_model is not None,
        "chatterbox_loaded": _chatterbox_model is not None
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
    profile_id = str(uuid.uuid4())
    profile_dir = PROFILES_DIR / profile_id
    profile_dir.mkdir(parents=True, exist_ok=True)

    audio_bytes = await audio.read()
    ext = Path(audio.filename).suffix or ".wav"
    audio_path = profile_dir / f"reference{ext}"
    audio_path.write_bytes(audio_bytes)

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
    return {"status": "deleted"}

@app.post("/generate")
async def generate_speech(
    text: str = Form(...),
    profile_id: str = Form(...),
    language: str = Form("en-us"),
):
    start_time = time.time()
    if _semaphore.locked():
        raise HTTPException(status_code=429, detail="Too Many Requests. The server is currently processing audio.")

    # Determine Engine Strategy
    use_kokoro = is_kokoro_voice(profile_id)
    
    # Validation if using Chatterbox
    ref_audio = None
    if not use_kokoro:
        profile = _get_profile(profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found for Chatterbox cloning.")
        ref_audio = profile.get("audio_file")
        if ref_audio and not Path(ref_audio).exists():
            raise HTTPException(status_code=400, detail="Reference audio missing")

    lang_defaults = LANG_DEFAULTS.get(language, GLOBAL_DEFAULTS)
    chunks = [c.strip() for c in re.split(r'(?<=[.!?])\s+', text) if c.strip()]
    if not chunks:
        chunks = [text]

    async def audio_stream():
        async with _semaphore:
            engine_used = "chatterbox"
            fallback_triggered = False
            total_audio_bytes = 0
            try:
                # 1. Try Kokoro First if requested
                if use_kokoro:
                    try:
                        await ensure_kokoro_model()
                        engine_used = "kokoro"
                        yield _create_wav_header(24000) # Kokoro native 24kHz
                        for chunk in chunks:
                            def _generate_kokoro():
                                kokoro_lang = "en-us" if language == "en" else language
                                samples, _ = _kokoro_model.create(chunk, voice=profile_id, speed=1.0, lang=kokoro_lang)
                                return np.asarray(samples, dtype=np.float32)
                            
                            audio_np = await asyncio.to_thread(_generate_kokoro)
                            audio_int16 = (audio_np * 32767).clip(-32768, 32767).astype(np.int16)
                            chunk_bytes = audio_int16.tobytes()
                            total_audio_bytes += len(chunk_bytes)
                            yield chunk_bytes
                            
                    except Exception as e:
                        logger.error(f"Kokoro engine failed: {e}. Auto-falling back to Chatterbox.")
                        fallback_triggered = True

                # 2. Use Chatterbox if explicit clone requested OR Kokoro failed
                if not use_kokoro or fallback_triggered:
                    engine_used = "chatterbox"
                    await ensure_chatterbox_model()
                    
                    # If auto-fallback triggered, use default Chatterbox profile
                    fallback_ref = ref_audio
                    if not fallback_ref:
                        available_profiles = _get_profiles()
                        if available_profiles:
                            fallback_ref = available_profiles[0].get("audio_file")
                    
                    import torch
                    sample_rate = getattr(_chatterbox_model, "sr", None) or getattr(_chatterbox_model, "sample_rate", 24000)
                    # Yield header matching active model's sample rate
                    yield _create_wav_header(sample_rate)

                    for chunk in chunks:
                        def _generate_chatterbox():
                            wav = _chatterbox_model.generate(
                                chunk,
                                language_id=language[:2], # Chatterbox expects 'en', Kokoro expects 'en-us'
                                audio_prompt_path=fallback_ref,
                                **lang_defaults
                            )
                            if isinstance(wav, torch.Tensor):
                                return wav.squeeze().cpu().numpy().astype(np.float32)
                            return np.asarray(wav, dtype=np.float32)

                        audio_np = await asyncio.to_thread(_generate_chatterbox)
                        audio_int16 = (audio_np * 32767).clip(-32768, 32767).astype(np.int16)
                        chunk_bytes = audio_int16.tobytes()
                        total_audio_bytes += len(chunk_bytes)
                        yield chunk_bytes

            except Exception as e:
                # Log failure
                gen_time = time.time() - start_time
                log_data = {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "engine": engine_used,
                    "text_length": len(text),
                    "audio_duration_sec": 0,
                    "generation_time_sec": round(gen_time, 2),
                    "status": "failure",
                    "error_type": type(e).__name__,
                    "profile_id": profile_id
                }
                json_logger.info(json.dumps(log_data))
                logger.error(f"Generation failed: {json.dumps(log_data)}")
                raise
            finally:
                # 3. Cleanup to prevent RAM overflow
                gc.collect()
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                
                # Log success
                gen_time = time.time() - start_time
                audio_duration = total_audio_bytes / (24000 * 2) # approx 16-bit 24kHz
                if total_audio_bytes > 0:
                    log_data = {
                        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "engine": engine_used,
                        "text_length": len(text),
                        "audio_duration_sec": round(audio_duration, 2),
                        "generation_time_sec": round(gen_time, 2),
                        "status": "success",
                        "profile_id": profile_id
                    }
                    json_logger.info(json.dumps(log_data))
                    logger.info(f"Structured Log: {json.dumps(log_data)}")

    return StreamingResponse(
        audio_stream(), 
        media_type="audio/wav",
        headers={"X-TTS-Engine": "kokoro" if use_kokoro else "chatterbox-fallback" if is_kokoro_voice(profile_id) else "chatterbox"}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=SERVER_PORT, log_level="info")
