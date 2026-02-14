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
- `.mp4` files are ignored by git via `.gitignore`.

## API Notes
- `GEMINI_API_KEY` is used for TTS prompt generation.
- `GOOGLE_STT_API_KEY` is used for server-side speech transcription.
- Keep `.env.local` private; it is ignored by git.
