# TCF Canada Practice Simulator (MVP)

This app simulates TCF speaking and writing practice.

## Features
- Speaking Task 2 and Task 3 with replayable oral prompt
- Task 2 includes a 20-question bank with `Previous`, `Random`, `Next`
- Prompt audio from:
  - Browser TTS (offline fallback)
  - Gemini TTS (server proxy)
- Speech transcription from:
  - Server STT (Google, recommended for Edge/Opera)
  - Browser STT (Web Speech fallback)
- Writing section with 3 tasks
- Shared exam timer (default 60:00)
- Live word counter per writing task
- Copy per-task response and copy-all export

## Run with Gemini TTS
1. Create local env file:
   ```bash
   cp /Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/.env.local.example /Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/.env.local
   ```
2. Edit `/Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/.env.local` and set:
   ```bash
   GEMINI_API_KEY="your_new_key_here"
   GOOGLE_STT_API_KEY="your_google_cloud_speech_key_here"
   ```
   Use a **Google AI Studio Gemini API key** (typically starts with `AIza`). A Vertex/service-account-bound key will fail on this endpoint.
3. Start server:
   ```bash
   node /Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/server.js
   ```
4. Open:
   [http://localhost:3000](http://localhost:3000)
5. In **Prompt Audio Settings**, select `Gemini TTS (server)`.

## Run without Gemini (browser voice only)
Open `/Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/index.html` directly in browser and keep `Browser Voice` selected.

## Notes
- Gemini key stays server-side (not exposed in browser code).
- Google STT key stays server-side and is used for `/api/transcribe`.
- `.env.local` is auto-loaded by `server.js` and ignored by git.
- If you ever accidentally track `.env.local`, run: `git rm --cached .env.local` then commit.
- For better transcription reliability across browsers, use `Transcription Engine = Server STT (Google)`.
- Data is local-only for now (no backend persistence).

## Suggested next steps
1. Add real TCF-style prompt bank and randomization.
2. Save attempt history (localStorage or Supabase).
3. Add one-click CEFR/NCLC scoring prompt templates.
4. Add strict per-task speaking timers and auto-stop behavior.
