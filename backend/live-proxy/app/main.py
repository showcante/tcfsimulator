import json
import os
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

app = FastAPI()

PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT") or ""
LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")
MODEL = os.getenv("TASK2_VERTEX_MODEL", "gemini-2.5-flash")
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
""".strip()

client: Optional[genai.Client] = None


def get_client() -> genai.Client:
    global client
    if client is None:
        if not PROJECT_ID:
            raise RuntimeError("Missing GOOGLE_CLOUD_PROJECT for Vertex client.")
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    return client


def parse_response_text(response: Any) -> str:
    response_text = getattr(response, "text", None)
    if response_text and response_text.strip():
        return response_text.strip()

    text_parts: List[str] = []
    candidates = getattr(response, "candidates", []) or []
    if not candidates:
        return ""

    content = getattr(candidates[0], "content", None)
    parts = getattr(content, "parts", []) or []
    for part in parts:
        part_text = getattr(part, "text", None)
        if part_text:
            text_parts.append(part_text.strip())

    return "\n".join([item for item in text_parts if item]).strip()


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

    history_turns: List[Dict[str, str]] = []

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
                await ws.send_json(
                    {
                        "type": "examiner_text",
                        "text": "Bonjour. Nous commencons la tache 2. Je vous ecoute, quelles informations souhaitez-vous ?",
                    }
                )
                continue

            if msg_type != "candidate_text":
                await ws.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
                continue

            candidate_text = (message.get("text") or "").strip()
            if not candidate_text:
                await ws.send_json({"type": "error", "message": "Missing candidate text"})
                continue

            prompt_context = (message.get("prompt") or "").strip()
            history_turns.append({"role": "CANDIDAT", "text": candidate_text})
            history_turns = history_turns[-12:]
            conversation_excerpt = "\n".join(
                [f"{turn['role']}: {turn['text']}" for turn in history_turns]
            )
            request_text = (
                f"{SYSTEM_INSTRUCTION}\n\n"
                f"Contexte de la tâche 2:\n{prompt_context or '(aucun)'}\n\n"
                f"Conversation en cours:\n{conversation_excerpt}\n\n"
                "Réponds maintenant comme examinateur TCF.\n"
                "N'invente pas un nouveau scénario.\n"
                "Reste cohérent avec la dernière question du candidat."
            )

            try:
                cfg = types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    temperature=0.6,
                    max_output_tokens=180,
                )
                response = get_client().models.generate_content(
                    model=MODEL,
                    contents=request_text,
                    config=cfg,
                )
            except Exception as err:
                await ws.send_json(build_vertex_error_payload(err))
                continue

            examiner_text = parse_response_text(response)
            if not examiner_text:
                examiner_text = "Pouvez-vous reformuler votre question, s'il vous plait ?"
            if examiner_text:
                history_turns.append({"role": "EXAMINATEUR", "text": examiner_text})
                history_turns = history_turns[-12:]
                await ws.send_json({"type": "examiner_text", "text": examiner_text})
    except WebSocketDisconnect:
        return
