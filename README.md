# TCF Canada Simulator

Multi-page web app for TCF Canada practice.

## Pages
- `/index.html`: Home page with TCF overview, expandable exam sections, and document download links
- `/speaking.html`: Speaking simulator (Task 2/3, Gemini TTS, Google STT, question banks)
- `/writing.html`: Writing simulator (3 tasks, timer, word counters)
- `/listening.html`: Curated external listening practice links
- `/reading.html`: Curated external reading practice links

## Run
1. Create local env file:
   ```bash
   cp /Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/.env.local.example /Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/.env.local
   ```
2. Edit `/Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/.env.local` and set:
   ```bash
   GEMINI_API_KEY="your_google_ai_studio_key"
   GOOGLE_STT_API_KEY="your_google_cloud_speech_key"
   ```
3. Start server:
   ```bash
   node /Users/user/Library/CloudStorage/OneDrive-Personnel/Study/TCF_app/server.js
   ```
4. Open:
   [http://localhost:3000](http://localhost:3000)

## UI Notes
- Top-right language switcher:
  - English 🇨🇦
  - Français (Québec) ⚜️
- Home hero uses `Assets/bear_tcf.mp4` without visible player controls.
- Global site background uses `Assets/bear.png`.

## API Notes
- `GEMINI_API_KEY` is used for TTS prompt generation.
- `GOOGLE_STT_API_KEY` is used for server-side speech transcription.
- Keep `.env.local` private; it is ignored by git.

## Deploy (Important)
This app is not fully static. `speaking.html` calls backend endpoints:
- `POST /api/gemini-tts`
- `POST /api/transcribe`

If these routes are missing in your deployment, you will get:
- `Gemini TTS failed: TTS request failed (404)`

### Vercel
This repo includes Vercel serverless functions in:
- `api/gemini-tts.js`
- `api/transcribe.js`

Required environment variables in Vercel project settings:
- `GEMINI_API_KEY`
- `GOOGLE_STT_API_KEY`
- optional: `GEMINI_TTS_MODEL` (default: `gemini-2.5-flash-preview-tts`)

Set env vars for the environment you use (`Preview` and/or `Production`), then redeploy.

### Other Platforms
Yes, it works on other platforms if they provide:
1. Static hosting for HTML/CSS/JS pages.
2. Backend runtime for the two API routes above (Node.js server or serverless functions).
3. Environment variable support for API keys.
4. HTTPS (required for browser microphone features in most browsers).

If the platform cannot run backend endpoints, speaking TTS/STT features will not work.

## Known Constraints
- Google Speech-to-Text in this code uses synchronous recognition (`speech:recognize`) and may reject long audio with:
  - `Sync input too long... use LongRunningRecognize`
- For long recordings, update backend to use long-running recognition workflow.
