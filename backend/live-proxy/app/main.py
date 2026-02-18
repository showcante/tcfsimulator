import json
import os
import base64
import asyncio
from typing import Any, Dict, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

app = FastAPI()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT") or ""
LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")
MODEL = os.getenv("TASK2_VERTEX_MODEL", "gemini-live-2.5-flash-native-audio")
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
5. Reste strictement dans le scénario donné par la consigne.
6. Réponds avec 1 à 3 phrases utiles, puis termine par une question de relance.
7. Si le candidat dit seulement bonjour ou une phrase incomplète, réponds quand même et guide la conversation.
""".strip()

client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    global client
    if client is None:
        if not PROJECT_ID:
            raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT for Vertex client.")
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    return client


def build_vertex_error_payload(err: Exception) -> Dict[str, Any]:
    message = str(err)
    hint = ""
    model_lower = MODEL.lower()
    if "tts" in model_lower:
      hint = (
          "TASK2_VERTEX_MODEL is set to a TTS model. For Task 2 live interaction use a text model, "
          "for example gemini-2.5-flash."
      )
    if "FAILED_PRECONDITION" in message or "Precondition check failed" in message:
      hint = (
          "Model/region precondition failed. Verify TASK2_VERTEX_MODEL exists in VERTEX_LOCATION "
          "(recommended: gemini-2.5-flash in us-central1 or northamerica-northeast2), billing is enabled, and service account has roles/aiplatform.user."
      )
    elif "PERMISSION_DENIED" in message or "403" in message:
      hint = "Service account is missing required Vertex permissions or project access."
    elif "RESOURCE_EXHAUSTED" in message or "429" in message:
      hint = "Quota/rate limit reached. Check Vertex quotas for this project/region."
    elif "keepalive ping timeout" in message or "ConnectionClosedError" in message:
      hint = "Vertex live session dropped (timeout). Reconnect Task 2 live and start recording again."

    return {
        "type": "error",
        "code": "VERTEX_REQUEST_FAILED",
        "message": message,
        "details": {
            "project": PROJECT_ID,
            "location": LOCATION,
            "model": MODEL,
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


async def stream_vertex_to_browser(session: Any, ws: WebSocket) -> None:
    async for message in session.receive():
        try:
            input_tx = getattr(message, "input_transcription", None)
            if input_tx:
                tx_text = getattr(input_tx, "text", None) or ""
                if tx_text.strip():
                    await ws.send_json({"type": "candidate_text_live", "text": tx_text.strip()})

            output_tx = getattr(message, "output_transcription", None)
            if output_tx:
                tx_text = getattr(output_tx, "text", None) or ""
                if tx_text.strip():
                    await ws.send_json({"type": "examiner_text", "text": tx_text.strip()})

            server_content = getattr(message, "server_content", None)
            if not server_content:
                continue

            model_turn = getattr(server_content, "model_turn", None)
            if not model_turn:
                continue

            parts = getattr(model_turn, "parts", None) or []
            for part in parts:
                inline_data = getattr(part, "inline_data", None)
                if not inline_data:
                    continue
                data = getattr(inline_data, "data", None)
                mime_type = getattr(inline_data, "mime_type", None) or "audio/pcm;rate=24000"
                if not data:
                    continue
                if isinstance(data, bytes):
                    audio_b64 = base64.b64encode(data).decode("utf-8")
                else:
                    audio_b64 = str(data)
                await ws.send_json(
                    {
                        "type": "examiner_audio",
                        "mimeType": mime_type,
                        "audioBase64": audio_b64,
                    }
                )

            if getattr(server_content, "turn_complete", False):
                await ws.send_json({"type": "examiner_audio_end"})
        except Exception:
            continue


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

    live_cfg = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)
            )
        ),
        system_instruction=SYSTEM_INSTRUCTION,
    )

    try:
        async with get_client().aio.live.connect(model=MODEL, config=live_cfg) as session:
            reader_task = asyncio.create_task(stream_vertex_to_browser(session, ws))
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

                    if msg_type == "start_session":
                        prompt_context = (message.get("prompt") or "").strip()
                        seed = (
                            "Commence l'interaction maintenant. "
                            "Salue le candidat, donne un premier détail concret lié à la consigne, "
                            "puis pose une question courte pour faire parler le candidat:\n"
                            f"{prompt_context or '(aucune consigne)'}"
                        )
                        await session.send_client_content(
                            turns=[types.Content(role="user", parts=[types.Part(text=seed)])],
                            turn_complete=True,
                        )
                        continue

                    if msg_type == "audio_chunk":
                        audio_b64 = (message.get("audioBase64") or "").strip()
                        if not audio_b64:
                            continue
                        audio_bytes = base64.b64decode(audio_b64)
                        await session.send_realtime_input(
                            audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                        )
                        continue

                    if msg_type == "audio_stream_end":
                        await session.send_realtime_input(audio_stream_end=True)
                        continue

                    if msg_type == "candidate_text":
                        # Backward compatibility with previous text mode.
                        candidate_text = (message.get("text") or "").strip()
                        if not candidate_text:
                            continue
                        await session.send_client_content(
                            turns=[types.Content(role="user", parts=[types.Part(text=candidate_text)])],
                            turn_complete=True,
                        )
                        continue

                    await ws.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
            finally:
                reader_task.cancel()
    except WebSocketDisconnect:
        return
    except Exception as err:
        await ws.send_json(build_vertex_error_payload(err))
        await ws.close(code=1000, reason="Vertex live failure")
