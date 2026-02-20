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

function normalize(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isGreetingOnly(userText) {
  const text = normalize(userText).replace(/[.!?]/g, " ").trim();
  return /^(bonjour|salut|bonsoir|coucou|allo|allo)\b/.test(text) && text.split(/\s+/).length <= 3;
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

    if (isGreetingOnly(userText)) {
      sendJson(res, 200, { reply: "Bonjour, je vous écoute." });
      return;
    }

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
      "Le candidat te pose des questions pour obtenir des informations basees sur la consigne.",
      "REGLES DE CONDUITE :",
      "1) Tu es passif et tu reponds directement a la question posee.",
      "2) Tu ne poses jamais de question au candidat.",
      "3) Tu fais des phrases completes, naturelles et grammaticalement correctes.",
      "4) OBLIGATION: Termine toujours ton intervention par un point final (.).",
    ].join("\n");

    const userPrompt = [
      "Consigne :",
      taskPrompt,
      "",
      compactHistory ? "Historique recent :\n" + compactHistory : "Historique recent : (debut)",
      "",
      "Candidat : " + userText,
      "",
      "Ta reponse (formule une phrase complete, termine par un point final, ne pose aucune question) :",
    ].join("\n");

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;
    const callGemini = async (prompt, temperature = 0.6) => {
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
            maxOutputTokens: 500,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Gemini examiner request failed: ${JSON.stringify(data)}`);
      }
      return extractTextFromGeminiResponse(data);
    };

    let examinerText = String(await callGemini(userPrompt, 0.6) || "").trim();
    examinerText = examinerText.replace(/^\[?Examinateur\]?\s*:\s*/i, "");

    if (!examinerText) {
      sendJson(res, 502, { error: "Gemini examiner response contained no text." });
      return;
    }

    sendJson(res, 200, { reply: examinerText });
  } catch (error) {
    sendJson(res, 500, { error: `Task 2 examiner proxy failed: ${error.message}` });
  }
};
