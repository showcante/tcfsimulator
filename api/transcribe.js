function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const GOOGLE_STT_API_KEY = process.env.GOOGLE_STT_API_KEY;
  if (!GOOGLE_STT_API_KEY) {
    sendJson(res, 500, { error: "Missing GOOGLE_STT_API_KEY in server environment." });
    return;
  }

  try {
    const parsed = req.body || {};
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
};
