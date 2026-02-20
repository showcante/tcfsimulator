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

function seemsCutOff(text) {
  const clean = String(text || "").trim();
  if (!clean) return true;
  if (!/[.!?…]["')\]]?$/.test(clean)) return true;
  if (/\b(a|au|aux|de|des|du|la|le|les|un|une|et|ou|pour|avec|sans|vers|chez|a)\s*$/i.test(clean)) return true;
  if (/\b\d+\s*$/i.test(clean)) return true;
  return false;
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

function detectTopic(userText) {
  const text = normalize(userText);
  if (/(nourriture|repas|boisson|apporter|manger|plat)/.test(text)) return "nourriture";
  if (/(horaire|heure|quand|debut|fin|date)/.test(text)) return "horaire";
  if (/(lieu|adresse|endroit|ou|quartier)/.test(text)) return "lieu";
  if (/(prix|tarif|cout|gratuit|payer|budget)/.test(text)) return "prix";
  if (/(transport|bus|metro|stationnement|parking|voiture)/.test(text)) return "transport";
  return "general";
}

function isGreetingOnly(userText) {
  const text = normalize(userText).replace(/[.!?]/g, " ").trim();
  return /^(bonjour|salut|bonsoir|coucou|allo|allo)\b/.test(text) && text.split(/\s+/).length <= 3;
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

function isTopicGrounded(reply, topic) {
  const text = normalize(reply);
  if (topic === "nourriture") return /(nourriture|plat|boisson|apporter|manger)/.test(text);
  if (topic === "horaire") return /(heure|horaire|samedi|debut|fin|arriver)/.test(text);
  if (topic === "lieu") return /(lieu|adresse|cour|entree|endroit)/.test(text);
  if (topic === "prix") return /(prix|tarif|gratuit|payer|participation)/.test(text);
  if (topic === "transport") return /(transport|bus|metro|stationnement|voiture)/.test(text);
  return true;
}

function normalizeExaminerReply(text) {
  let out = String(text || "").replace(/\s+/g, " ").trim();
  out = out.replace(/^\[[^\]]+\]\s*/i, "");
  if (!/[.!?…]["')\]]?$/.test(out)) {
    out = `${out}.`;
  }
  return out;
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
      sendJson(res, 200, { reply: "Bonjour, je vous ecoute." });
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
      "Le candidat doit te poser des questions pour obtenir des informations basees sur la consigne.",
      "REGLES ABSOLUES ET STRICTES:",
      "1) Tu ne dois jamais poser de question au candidat.",
      "2) Tu ne dois jamais dire 'Comment puis-je vous aider ?' ou equivalent.",
      "3) Si le candidat dit seulement 'Bonjour', reponds uniquement 'Bonjour, je vous ecoute.'.",
      "4) Reponds de maniere concise (1 ou 2 phrases) uniquement a la question posee.",
      "5) Ne donne pas toutes les informations de la consigne d'un coup.",
      "6) Reste passif et laisse le candidat diriger la conversation.",
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
      "RAPPEL CRITIQUE: Ne pose aucune question dans ta reponse.",
      "Contente-toi de repondre de maniere complete et naturelle en 1 ou 2 phrases.",
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
            maxOutputTokens: 320,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`Gemini examiner request failed: ${JSON.stringify(data)}`);
      }
      return extractTextFromGeminiResponse(data);
    };

    let examinerText = String(await callGemini(userPrompt, 0.35) || "").trim();
    if (seemsCutOff(examinerText)) {
      const completionPrompt = [
        "Question du candidat:",
        userText,
        "",
        `Reponse inachevee a corriger: "${examinerText}"`,
        "",
        "Reecris une reponse complete en 1 ou 2 phrases, meme sens, sans poser de question.",
      ].join("\n");
      examinerText = String(await callGemini(completionPrompt, 0.2) || "").trim();
    }

    if (!examinerText) {
      sendJson(res, 502, { error: "Gemini examiner response contained no text." });
      return;
    }

    sendJson(res, 200, { reply: examinerText });
  } catch (error) {
    sendJson(res, 500, { error: `Task 2 examiner proxy failed: ${error.message}` });
  }
};
