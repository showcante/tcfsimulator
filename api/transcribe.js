function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
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
};
