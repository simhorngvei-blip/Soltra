import os
import json
import logging
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import ollama
import google.generativeai as genai
from huggingface_hub import InferenceClient

load_dotenv(dotenv_path="../soltra-dashboard/.env")

# ──────────────────────────────────────────────────────────────
# Config & Setup
# ──────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "")

# Hugging Face key
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
hf_client = InferenceClient(token=HUGGINGFACE_API_KEY) if HUGGINGFACE_API_KEY else None

# We expect a Gemini key if HF fails
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="Mini-Overseer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
logger = logging.getLogger("MiniOverseer")
logging.basicConfig(level=logging.INFO)

# ──────────────────────────────────────────────────────────────
# Memory State (Short-Term Memory)
# ──────────────────────────────────────────────────────────────
# Simple sliding window for STM (keeping last 10 messages)
MAX_STM_SIZE = 10
stm_buffer: List[Dict[str, str]] = []

def add_to_stm(role: str, content: str):
    stm_buffer.append({"role": role, "content": content})
    if len(stm_buffer) > MAX_STM_SIZE:
        stm_buffer.pop(0)

# ──────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    telemetry: Optional[Dict] = {}

class MemoryEvent(BaseModel):
    event_type: str
    content: str
    metadata: Optional[Dict] = {}

# ──────────────────────────────────────────────────────────────
# LLM Providers (Hugging Face Primary, Gemini Fallback)
# ──────────────────────────────────────────────────────────────
def get_embedding(text: str) -> List[float]:
    """Generates an embedding vector using Hugging Face API. Fallbacks to Gemini."""
    try:
        if not hf_client:
            raise Exception("HUGGINGFACE_API_KEY not configured.")
        # Using feature-extraction pipeline via HF Inference API
        embedding = hf_client.feature_extraction(text, model="sentence-transformers/all-MiniLM-L6-v2")
        
        # Hugging face feature extraction can return nested lists or numpy arrays
        # For a single string, it's typically a list of lists or a flat list.
        # We ensure it's a flat list for Supabase.
        emb_list = embedding.tolist() if hasattr(embedding, 'tolist') else embedding
        # If it's nested (e.g. [1, seq_len, hidden_size] or just [hidden_size]), flatten it safely:
        while len(emb_list) > 0 and isinstance(emb_list[0], list):
            emb_list = emb_list[0]
            
        return emb_list
    except Exception as e:
        logger.warning(f"Hugging Face embedding failed, falling back to Gemini: {e}")
        if not GEMINI_API_KEY:
            raise Exception("Gemini API key not configured for fallback.")
        
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document",
            title="Mini Overseer Memory"
        )
        return result['embedding']

def generate_response(system_prompt: str, messages: List[Dict[str, str]]) -> str:
    """Generates a text response using Hugging Face API. Fallbacks to Gemini."""
    prompt_msgs = [{"role": "system", "content": system_prompt}] + messages
    try:
        if not hf_client:
            raise Exception("HUGGINGFACE_API_KEY not configured.")
        response = hf_client.chat_completion(
            model="meta-llama/Meta-Llama-3-8B-Instruct",
            messages=prompt_msgs,
            max_tokens=500
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"Hugging Face generation failed, falling back to Gemini: {e}")
        if not GEMINI_API_KEY:
            raise Exception("Gemini API key not configured for fallback.")
        
        model = genai.GenerativeModel('gemini-1.5-flash')
        gemini_history = []
        for msg in messages[:-1]:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})
            
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(system_prompt + "\n\nUser: " + messages[-1]["content"])
        return response.text

# ──────────────────────────────────────────────────────────────
# Long-Term Memory Functions
# ──────────────────────────────────────────────────────────────
def retrieve_ltm(query: str, limit: int = 3) -> str:
    try:
        emb = get_embedding(query)
        res = supabase.rpc("match_memory_events", {
            "query_embedding": emb,
            "match_threshold": 0.5,
            "match_count": limit
        }).execute()
        
        if res.data:
            context_strings = [f"- {item['content']} (Date: {item['created_at']})" for item in res.data]
            return "\n".join(context_strings)
        return "No relevant historical context found."
    except Exception as e:
        logger.error(f"LTM Retrieval error: {e}")
        return "Failed to retrieve historical context."

def store_ltm(event: MemoryEvent):
    try:
        emb = get_embedding(event.content)
        data = {
            "event_type": event.event_type,
            "content": event.content,
            "metadata": event.metadata,
            "embedding": emb
        }
        supabase.table("long_term_memory").insert(data).execute()
    except Exception as e:
        logger.error(f"LTM Storage error: {e}")

# ──────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────
@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    user_message = req.message
    live_telemetry = req.telemetry or {}

    # 1. Retrieve LTM Context
    ltm_context = retrieve_ltm(user_message)
    
    # 2. Build System Prompt
    system_prompt = f"""You are the Soltra Mini-Overseer, an AI assistant built into the dashboard.
Keep your answers concise and suitable for text-to-speech reading.
Be highly context-aware.

[LIVE TELEMETRY]
{json.dumps(live_telemetry, indent=2)}

[LONG-TERM MEMORY RECALL]
{ltm_context}
"""

    # 3. Add to STM & format prompt
    add_to_stm("user", user_message)
    
    # 4. Generate Response
    try:
        ai_response = generate_response(system_prompt, stm_buffer)
    except Exception as e:
        ai_response = f"System Error: {str(e)}"
    
    # 5. Add AI response to STM
    add_to_stm("assistant", ai_response)
    
    # 6. Store user message in LTM
    store_ltm(MemoryEvent(
        event_type="conversation",
        content=f"User said: {user_message} | AI replied: {ai_response}",
        metadata={"telemetry_snapshot": live_telemetry}
    ))

    return {"response": ai_response}

if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 and dynamically assign PORT for deployment (e.g. Render/Railway/Heroku)
    port = int(os.environ.get("PORT", 8100))
    # In production, reload should be False
    is_dev = os.environ.get("ENV", "development") == "development"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=is_dev)
