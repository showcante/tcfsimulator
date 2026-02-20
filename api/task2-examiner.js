function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function extractTextFromGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const texts = parts
    .map((part) => (typeof part?.text === "string" ? part.text.trim() : ""))
    .filter(Boolean);
  return texts.join("\n").trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
  if (!GEMINI_API_KEY) {
    sendJson(res, 500, { error: "Missing GEMINI_API_KEY in server environment." });
    return;
  }

  try {
    const parsed = req.body || {};
    const taskPrompt = (parsed.taskPrompt || "").trim();
    const userText = (parsed.userText || "").trim();
    const history = Array.isArray(parsed.history) ? parsed.history : [];

    if (!taskPrompt) {
      sendJson(res, 400, { error: "Missing taskPrompt." });
      return;
    }
    if (!userText) {
      sendJson(res, 400, { error: "Missing userText." });
      return;
    }

    const compactHistory = history
      .slice(-10)
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
      "3) Fournis des informations concretes liees a la consigne.",
      "4) Termine toujours par une courte question de relance.",
      "5) N'evalue pas le candidat et ne donne pas de score pendant l'interaction.",
    ].join("\n");

    const userPrompt = [
      "Consigne de l'examinateur:",
      taskPrompt,
      "",
      compactHistory ? "Historique recent:\n" + compactHistory : "Historique recent: (debut de dialogue)",
      "",
      "Derniere intervention du candidat:",
      userText,
      "",
      "Reponds maintenant comme examinateur.",
    ].join("\n");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.6,
          topP: 0.9,
          maxOutputTokens: 180,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      sendJson(res, 502, { error: `Gemini examiner request failed: ${JSON.stringify(data)}` });
      return;
    }

    const examinerText = extractTextFromGeminiResponse(data);
    if (!examinerText) {
      sendJson(res, 502, { error: "Gemini examiner response contained no text." });
      return;
    }

    sendJson(res, 200, { reply: examinerText });
  } catch (error) {
    sendJson(res, 500, { error: `Task 2 examiner proxy failed: ${error.message}` });
  }
};
