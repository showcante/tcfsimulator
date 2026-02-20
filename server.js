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

function buildSttErrorPayload(data, context) {
  const message = String(data?.error?.message || "");
  let hint = "";
  if (message.includes("Sync input too long")) {
    hint =
      "Audio segment is too long for sync recognize. Deploy the latest frontend chunking build or use LongRunningRecognize for >60s segments.";
  } else if (message.includes("Invalid recognition 'config': Opus sample rate")) {
    hint =
      "Opus sample rate missing/invalid. Ensure client sends sampleRateHertz=48000 and backend forwards it in config.";
  } else if (message.includes("PERMISSION_DENIED")) {
    hint = "Check GOOGLE_STT_API_KEY permissions and that Speech-to-Text API is enabled.";
  }

  return {
    code: "GOOGLE_STT_FAILED",
    message: `Google STT error: ${JSON.stringify(data)}`,
    details: {
      hint,
      ...context,
    },
  };
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

async function fetchWithTimeout(url, options, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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
      const requestedVoice = (parsed.voiceName || "Kore").trim();

      if (!text) {
        sendJson(res, 400, { error: "Missing text for TTS." });
        return;
      }

      const modelsToTry = [GEMINI_MODEL, "gemini-2.5-flash-preview-tts"];
      const voicesToTry = [requestedVoice, "Aoede", "Kore"].filter(
        (voice, index, arr) => voice && arr.indexOf(voice) === index
      );
      let geminiResponse = null;
      let lastErrorText = "";

      for (const modelName of modelsToTry) {
        for (const voiceName of voicesToTry) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
          const requestPayload = {
            contents: [
              {
                parts: [
                  {
                    text: `Lis ce texte exactement, sans ajouter de mots.\nTexte:\n${text}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              temperature: 0,
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

          geminiResponse = await fetchWithTimeout(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": GEMINI_API_KEY,
            },
            body: JSON.stringify(requestPayload),
          }, 30000);

          if (geminiResponse.ok) break;
          const errText = await geminiResponse.text();
          lastErrorText = `[model=${modelName} voice=${voiceName}] ${errText}`;
        }
        if (geminiResponse?.ok) break;
      }

      if (!geminiResponse.ok) {
        sendJson(res, 502, { error: buildGeminiErrorMessage(lastErrorText) });
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
    const sampleRateHertz = Number(parsed.sampleRateHertz || 0);
    const language = (parsed.language || "fr-FR").trim();

    if (!audioBase64) {
      sendJson(res, 400, { error: "Missing audioBase64 payload." });
      return;
    }

    let encoding = "WEBM_OPUS";
    if (mimeType.includes("wav")) encoding = "LINEAR16";
    if (mimeType.includes("ogg")) encoding = "OGG_OPUS";
    const config = {
      encoding,
      languageCode: language,
      enableAutomaticPunctuation: true,
    };

    if (language === "fr-CA") {
      config.alternativeLanguageCodes = ["fr-FR"];
    } else if (language === "fr-FR") {
      config.alternativeLanguageCodes = ["fr-CA"];
    }

    if ((encoding === "WEBM_OPUS" || encoding === "OGG_OPUS") && sampleRateHertz > 0) {
      config.sampleRateHertz = sampleRateHertz;
    }

    const endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(GOOGLE_STT_API_KEY)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config,
        audio: {
          content: audioBase64,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const payload = buildSttErrorPayload(data, { mimeType, encoding, sampleRateHertz, language });
      sendJson(res, 502, { error: payload.message, code: payload.code, details: payload.details });
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

function extractTextFromGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const texts = parts
    .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
    .filter(Boolean);
  return texts.join("\n").trim();
}

function looksIncomplete(text) {
  const clean = String(text || "").trim();
  if (!clean) return true;
  if (clean.split(/\s+/).length < 8) return true;
  if (clean.length < 45) return true;
  if (!/[.!?…]["')\]]?$/.test(clean)) return true;
  if (/\b(chac|quelqu|organis|informa|partic|apport|horair|adress|transpor)$/i.test(clean)) return true;
  return false;
}

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectTopic(userText, taskPrompt) {
  const text = normalize(`${userText} ${taskPrompt}`);
  if (/(nourriture|repas|boisson|apporter|manger|plat)/.test(text)) return "nourriture";
  if (/(horaire|heure|quand|debut|fin|date)/.test(text)) return "horaire";
  if (/(lieu|adresse|endroit|ou|quartier)/.test(text)) return "lieu";
  if (/(prix|tarif|cout|gratuit|payer|budget)/.test(text)) return "prix";
  if (/(transport|bus|metro|stationnement|parking|voiture)/.test(text)) return "transport";
  return "general";
}

function isTopicGrounded(reply, topic) {
  const text = normalize(reply);
  if (topic === "nourriture") return /(nourriture|plat|boisson|apporter|manger)/.test(text);
  if (topic === "horaire") return /(heure|horaire|samedi|debut|fin|arriver)/.test(text);
  if (topic === "lieu") return /(lieu|adresse|cour|entree|endroit)/.test(text);
  if (topic === "prix") return /(prix|tarif|gratuit|payer|participation)/.test(text);
  if (topic === "transport") return /(transport|bus|metro|stationnement|voiture)/.test(text);
  return true;
}

function buildFallbackReply(topic) {
  if (topic === "nourriture") {
    return "Pour la nourriture, chacun apporte un petit plat ou une boisson a partager, et je m'occupe des assiettes, des verres et des serviettes.";
  }
  if (topic === "horaire") {
    return "La fete commence samedi vers 18h et se termine vers 22h, donc vous pouvez arriver a l'heure qui vous convient.";
  }
  if (topic === "lieu") {
    return "La fete aura lieu dans la cour commune de l'immeuble, juste a cote de l'entree principale, et c'est facile a trouver.";
  }
  if (topic === "prix") {
    return "La participation est gratuite, chacun apporte seulement un petit quelque chose a partager pour simplifier l'organisation.";
  }
  if (topic === "transport") {
    return "Le plus simple est de venir en bus, et il y a aussi quelques places de stationnement dans la rue voisine.";
  }
  return "Bien sur, je peux vous donner les details pratiques de la fete des voisins pour que vous puissiez vous organiser facilement.";
}

function normalizeExaminerReply(text) {
  let out = String(text || "").replace(/\s+/g, " ").trim();
  out = out.replace(/^\[[^\]]+\]\s*/i, "");
  if (!/[.!?…]["')\]]?$/.test(out)) {
    out = `${out}.`;
  }
  return out;
}

async function handleTask2Examiner(req, res) {
  if (!GEMINI_API_KEY) {
    sendJson(res, 500, { error: "Missing GEMINI_API_KEY in server environment." });
    return;
  }

  try {
    const parsed = await readJsonBody(req);
    const taskPrompt = (parsed.taskPrompt || "").trim();
    const userText = (parsed.userText || "").trim();
    const history = Array.isArray(parsed.history) ? parsed.history : [];
    const topic = detectTopic(userText, taskPrompt);

    if (!taskPrompt) {
      sendJson(res, 400, { error: "Missing taskPrompt." });
      return;
    }
    if (!userText) {
      sendJson(res, 400, { error: "Missing userText." });
      return;
    }

    const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    const compactHistory = history
      .slice(-20)
      .map((item) => {
        const role = item?.role === "examiner" ? "Examinateur" : "Candidat";
        const text = String(item?.text || "").trim();
        return text ? `${role}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");

    const systemInstruction = [
      "Tu es examinateur TCF Canada - expression orale - Tache 2.",
      "Tu dois simuler un dialogue naturel et utile.",
      "Regles:",
      "1) Reponds uniquement en francais.",
      "2) Donne une reponse concise (1 a 3 phrases).",
      "3) Donne des informations concretes liees a la consigne.",
      "4) Reponds directement a la question du candidat, sans poser de question en retour.",
      "5) N'evalue pas le candidat pendant l'interaction.",
    ].join("\n");

    const userPrompt = [
      "Consigne:",
      taskPrompt,
      "",
      compactHistory ? "Historique recent:\n" + compactHistory : "Historique recent: (debut)",
      "",
      "Derniere intervention du candidat:",
      userText,
      "",
      "Reponds comme examinateur.",
      "IMPORTANT: Reponse complete uniquement, pas de phrase coupee.",
      "Format strict: exactement 1 ou 2 phrases completes.",
    ].join("\n");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;
    const callGemini = async (prompt, temperature = 0.4) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            topP: 0.9,
            maxOutputTokens: 260,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Gemini examiner request failed: ${JSON.stringify(data)}`);
      }
      return extractTextFromGeminiResponse(data);
    };

    let reply = normalizeExaminerReply(await callGemini(userPrompt, 0.25));
    if (looksIncomplete(reply) || !isTopicGrounded(reply, topic)) {
      const repairPrompt = [
        userPrompt,
        "",
        `Ta reponse precedente etait incomplete: "${reply}"`,
        `Sujet attendu: ${topic}.`,
        "Reecris une reponse complete en 1 a 2 phrases, sans poser de question.",
        "Interdiction de phrase tronquee.",
      ].join("\n");
      reply = normalizeExaminerReply(await callGemini(repairPrompt, 0.1));
    }
    if (looksIncomplete(reply) || !isTopicGrounded(reply, topic)) {
      reply = buildFallbackReply(topic);
    }
    if (!reply) {
      sendJson(res, 502, { error: "Gemini examiner response contained no text." });
      return;
    }

    sendJson(res, 200, { reply });
  } catch (error) {
    sendJson(res, 500, { error: `Task 2 examiner proxy failed: ${error.message}` });
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

  if (req.method === "POST" && req.url === "/api/task2-examiner") {
    handleTask2Examiner(req, res);
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
