import base64
import io
import json
import os
import wave
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

app = FastAPI()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT") or ""
LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")
MODEL = os.getenv("TASK2_VERTEX_MODEL", "gemini-2.5-flash")
VOICE = os.getenv("TASK2_VOICE_NAME", "Aoede")
SHARED_SECRET = os.getenv("TASK2_LIVE_SHARED_SECRET", "")
ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}

SYSTEM_INSTRUCTION = """
Tu es un examinateur pour le TCF Canada, épreuve d'expression orale, Tâche 2.
Ton rôle est de simuler une interaction naturelle.
Règles :
1. Ne donne pas toutes les informations d'un coup.
2. Attends que le candidat pose des questions (prix, horaires, douches, etc.).
3. Si le candidat hésite trop longtemps, relance-le gentiment.
4. Réponds toujours sur un ton professionnel mais accueillant.
5. Limite ta réponse à quelques phrases naturelles.
""".strip()

client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    global client
    if client is None:
        if not PROJECT_ID:
            raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT for Vertex client.")
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    return client


def to_b64(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return base64.b64encode(value).decode("utf-8")
    if isinstance(value, str):
        return value
    return ""


def parse_response(response: Any) -> Tuple[str, str, str]:
    text_parts: List[str] = []
    audio_b64 = ""
    audio_mime = "audio/wav"

    candidates = getattr(response, "candidates", []) or []
    if not candidates:
        return "", "", audio_mime

    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", []) or []
    for part in parts:
        part_text = getattr(part, "text", None)
        if part_text:
            text_parts.append(part_text)
        inline_data = getattr(part, "inline_data", None)
        if inline_data and not audio_b64:
            audio_b64 = to_b64(getattr(inline_data, "data", None))
            audio_mime = getattr(inline_data, "mime_type", None) or audio_mime

    if audio_b64 and "audio/pcm" in audio_mime.lower():
        try:
            pcm_bytes = base64.b64decode(audio_b64)
            wav_buffer = io.BytesIO()
            with wave.open(wav_buffer, "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)  # PCM16
                wav_file.setframerate(24000)
                wav_file.writeframes(pcm_bytes)
            audio_b64 = base64.b64encode(wav_buffer.getvalue()).decode("utf-8")
            audio_mime = "audio/wav"
        except Exception:
            # Keep original payload on conversion failure.
            pass

    return " ".join(text_parts).strip(), audio_b64, audio_mime


def build_vertex_error_payload(err: Exception) -> Dict[str, Any]:
    message = str(err)
    hint = ""
    if "FAILED_PRECONDITION" in message or "Precondition check failed" in message:
      hint = (
          "Model/region precondition failed. Verify TASK2_VERTEX_MODEL supports AUDIO in VERTEX_LOCATION "
          "(recommended: gemini-2.5-flash-preview-tts in us-central1), billing is enabled, and service account has roles/aiplatform.user."
      )
    elif "PERMISSION_DENIED" in message or "403" in message:
      hint = "Service account is missing required Vertex permissions or project access."
    elif "RESOURCE_EXHAUSTED" in message or "429" in message:
      hint = "Quota/rate limit reached. Check Vertex quotas for this project/region."

    return {
        "type": "error",
        "code": "VERTEX_REQUEST_FAILED",
        "message": message,
        "details": {
            "project": PROJECT_ID,
            "location": LOCATION,
            "model": MODEL,
            "voice": VOICE,
            "exception_type": type(err).__name__,
            "hint": hint,
        },
    }


def is_origin_allowed(origin: str) -> bool:
    if not ALLOWED_ORIGINS:
        return True
    return origin in ALLOWED_ORIGINS


def is_token_valid(ws: WebSocket) -> bool:
    if not SHARED_SECRET:
        return True
    token = ws.query_params.get("token", "")
    return token == SHARED_SECRET


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "model": MODEL, "location": LOCATION}


@app.websocket("/ws/task2-live")
async def task2_live(ws: WebSocket) -> None:
    origin = ws.headers.get("origin", "")
    if not is_origin_allowed(origin):
        await ws.close(code=1008, reason="Origin not allowed")
        return

    if not is_token_valid(ws):
        await ws.close(code=1008, reason="Invalid token")
        return

    await ws.accept()
    await ws.send_json({"type": "ready", "message": "Task 2 live socket connected"})

    history: List[Dict[str, Any]] = []

    try:
        while True:
            payload = await ws.receive_text()
            try:
                message = json.loads(payload)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON payload"})
                continue

            msg_type = message.get("type", "")
            if msg_type == "ping":
                await ws.send_json({"type": "pong"})
                continue

            if msg_type != "candidate_text":
                await ws.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
                continue

            candidate_text = (message.get("text") or "").strip()
            if not candidate_text:
                await ws.send_json({"type": "error", "message": "Missing candidate text"})
                continue

            prompt_context = (message.get("prompt") or "").strip()
            user_turn = candidate_text
            if prompt_context:
                user_turn = f"Contexte de rôle (tâche 2): {prompt_context}\n\nRéponse du candidat: {candidate_text}"

            history.append({"role": "user", "parts": [{"text": user_turn}]})
            history = history[-12:]

            try:
                cfg = types.GenerateContentConfig(
                    # TTS models only support AUDIO output.
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
                        )
                    ),
                    system_instruction=SYSTEM_INSTRUCTION,
                )
                response = get_client().models.generate_content(
                    model=MODEL,
                    contents=history,
                    config=cfg,
                )
            except Exception as err:
                await ws.send_json(build_vertex_error_payload(err))
                continue

            examiner_text, audio_b64, mime_type = parse_response(response)
            if examiner_text:
                history.append({"role": "model", "parts": [{"text": examiner_text}]})
                history = history[-12:]
                await ws.send_json({"type": "examiner_text", "text": examiner_text})

            if audio_b64:
                await ws.send_json(
                    {
                        "type": "examiner_audio",
                        "mimeType": mime_type,
                        "audioBase64": audio_b64,
                    }
                )
    except WebSocketDisconnect:
        return
