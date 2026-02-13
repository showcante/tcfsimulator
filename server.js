const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

function loadDotEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Local project config should win over stale shell exports.
    process.env[key] = value;
  }
}

loadDotEnvLocal();

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const GOOGLE_STT_API_KEY = process.env.GOOGLE_STT_API_KEY;

if (GEMINI_API_KEY && !GEMINI_API_KEY.startsWith("AIza")) {
  console.warn(
    "Warning: GEMINI_API_KEY does not start with 'AIza'. This usually means it is not a Google AI Studio Gemini API key."
  );
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function buildGeminiErrorMessage(rawErrorText) {
  const normalized = String(rawErrorText || "");
  const authMismatch =
    normalized.includes("API keys are not supported by this API") ||
    normalized.includes("CREDENTIALS_MISSING");

  if (authMismatch) {
    return [
      "Gemini API auth mismatch: your current key type is not valid for this endpoint.",
      "Use a Google AI Studio Gemini API key for GEMINI_API_KEY (not a Vertex/service-account-bound key).",
    ].join(" ");
  }

  return `Gemini API error: ${normalized}`;
}

function pcm16ToWavBuffer(pcmBuffer, sampleRate = 24000, channels = 1) {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, 44);

  return wav;
}

async function handleGeminiTts(req, res) {
  if (!GEMINI_API_KEY) {
    sendJson(res, 500, { error: "Missing GEMINI_API_KEY in server environment." });
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", async () => {
    try {
      const parsed = JSON.parse(body || "{}");
      const text = (parsed.text || "").trim();
      const voiceName = (parsed.voiceName || "Kore").trim();

      if (!text) {
        sendJson(res, 400, { error: "Missing text for TTS." });
        return;
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
      const requestPayload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            languageCode: "fr-CA",
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };

      const geminiResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(requestPayload),
      });

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        sendJson(res, 502, { error: buildGeminiErrorMessage(errorText) });
        return;
      }

      const data = await geminiResponse.json();
      const inlineData = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;

      if (!inlineData?.data) {
        sendJson(res, 502, { error: "Gemini response did not include audio data." });
        return;
      }

      const rawAudio = Buffer.from(inlineData.data, "base64");
      const mimeType = inlineData.mimeType || "audio/pcm";

      if (mimeType.includes("wav")) {
        res.writeHead(200, { "Content-Type": "audio/wav" });
        res.end(rawAudio);
        return;
      }

      const wavAudio = pcm16ToWavBuffer(rawAudio, 24000, 1);
      res.writeHead(200, { "Content-Type": "audio/wav" });
      res.end(wavAudio);
    } catch (error) {
      sendJson(res, 500, { error: `Gemini TTS proxy failed: ${error.message}` });
    }
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleTranscribe(req, res) {
  if (!GOOGLE_STT_API_KEY) {
    sendJson(res, 500, { error: "Missing GOOGLE_STT_API_KEY in server environment." });
    return;
  }

  try {
    const parsed = await readJsonBody(req);
    const audioBase64 = (parsed.audioBase64 || "").trim();
    const mimeType = (parsed.mimeType || "audio/webm").trim();
    const language = (parsed.language || "fr-FR").trim();

    if (!audioBase64) {
      sendJson(res, 400, { error: "Missing audioBase64 payload." });
      return;
    }

    let encoding = "WEBM_OPUS";
    if (mimeType.includes("wav")) encoding = "LINEAR16";
    if (mimeType.includes("ogg")) encoding = "OGG_OPUS";

    const endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(GOOGLE_STT_API_KEY)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          encoding,
          languageCode: language,
          enableAutomaticPunctuation: true,
        },
        audio: {
          content: audioBase64,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, 502, { error: `Google STT error: ${JSON.stringify(data)}` });
      return;
    }

    const text = (data.results || [])
      .map((result) => result?.alternatives?.[0]?.transcript || "")
      .filter(Boolean)
      .join(" ")
      .trim();

    sendJson(res, 200, { text });
  } catch (error) {
    sendJson(res, 500, { error: `Transcription proxy failed: ${error.message}` });
  }
}

function serveStatic(req, res) {
  const targetPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.normalize(path.join(ROOT, targetPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/gemini-tts") {
    handleGeminiTts(req, res);
    return;
  }

  if (req.method === "POST" && req.url === "/api/transcribe") {
    handleTranscribe(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`TCF app server running at http://localhost:${PORT}`);
});
