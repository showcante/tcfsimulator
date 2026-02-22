function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
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

function chunkTextForTts(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const pieces = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const chunks = [];
  let current = "";
  for (const partRaw of pieces) {
    const part = partRaw.trim();
    if (!part) continue;
    if (!current) {
      current = part;
      continue;
    }
    if ((current + " " + part).length <= 120) {
      current += " " + part;
    } else {
      chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function isAbortMessage(message) {
  return /aborted|AbortError|operation was aborted/i.test(String(message || ""));
}

async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";

  if (!GEMINI_API_KEY) {
    sendJson(res, 500, { error: "Missing GEMINI_API_KEY in server environment." });
    return;
  }

  try {
    const parsed = req.body || {};
    const text = (parsed.text || "").trim();
    const requestedVoice = (parsed.voiceName || "Kore").trim();

    if (!text) {
      sendJson(res, 400, { error: "Missing text for TTS." });
      return;
    }

    const modelsToTry = [...new Set([GEMINI_MODEL, "gemini-2.5-flash-preview-tts"])].filter(Boolean);
    const voicesToTry = [requestedVoice, "Aoede", "Kore"].filter(
      (voice, index, arr) => voice && arr.indexOf(voice) === index
    );
    const textChunks = chunkTextForTts(text);
    let combinedPcm = Buffer.alloc(0);
    let lastErrorText = "";

    for (let idx = 0; idx < textChunks.length; idx += 1) {
      const chunk = textChunks[idx];
      let chunkAudio = null;

      for (const modelName of modelsToTry) {
        for (const voiceName of voicesToTry) {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
          const requestPayload = {
            contents: [
              {
                parts: [
                  {
                    text: `Lis ce texte exactement, sans ajouter de mots.\nTexte:\n${chunk}`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              temperature: 0,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName,
                  },
                },
              },
            },
          };

          for (let attempt = 0; attempt < 2; attempt += 1) {
            let geminiResponse;
            try {
              geminiResponse = await fetchWithTimeout(endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-goog-api-key": GEMINI_API_KEY,
                },
                body: JSON.stringify(requestPayload),
              }, 25000);
            } catch (error) {
              lastErrorText = `[chunk=${idx + 1}/${textChunks.length} model=${modelName} voice=${voiceName}] ${error.message}`;
              if (attempt === 0 && isAbortMessage(error?.message)) continue;
              break;
            }

            if (!geminiResponse.ok) {
              const errText = await geminiResponse.text().catch(() => "");
              lastErrorText = `[chunk=${idx + 1}/${textChunks.length} model=${modelName} voice=${voiceName}] HTTP ${geminiResponse.status} ${errText}`;
              break;
            }

            const data = await geminiResponse.json();
            const inlineData = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
            if (!inlineData?.data) {
              lastErrorText = `[chunk=${idx + 1}/${textChunks.length} model=${modelName} voice=${voiceName}] Gemini response did not include audio data.`;
              break;
            }

            let rawAudio = Buffer.from(inlineData.data, "base64");
            const mimeType = inlineData.mimeType || "audio/pcm";
            if (mimeType.includes("wav") && rawAudio.length > 44) {
              rawAudio = rawAudio.slice(44);
            }
            if (!rawAudio.length) {
              lastErrorText = `[chunk=${idx + 1}/${textChunks.length} model=${modelName} voice=${voiceName}] Empty audio buffer returned.`;
              break;
            }

            chunkAudio = rawAudio;
            break;
          }
          if (chunkAudio) break;
        }
        if (chunkAudio) break;
      }

      if (!chunkAudio) {
        sendJson(res, 502, { error: buildGeminiErrorMessage(lastErrorText) });
        return;
      }

      combinedPcm = Buffer.concat([combinedPcm, chunkAudio]);
    }

    const wavAudio = pcm16ToWavBuffer(combinedPcm, 24000, 1);
    res.setHeader("Content-Type", "audio/wav");
    res.status(200).send(wavAudio);
  } catch (error) {
    sendJson(res, 500, { error: `Gemini TTS proxy failed: ${error.message}` });
  }
};
