const promptElements = {
  2: document.getElementById("prompt-speaking-2"),
  3: document.getElementById("prompt-speaking-3"),
};

const speakingPrompts = {
  2: promptElements[2].textContent.trim(),
  3: promptElements[3].textContent.trim(),
};

const transcriptFields = {
  2: document.getElementById("transcript-speaking-2"),
  3: document.getElementById("transcript-speaking-3"),
};

const promptAudioPlayers = {
  2: document.getElementById("prompt-audio-2"),
  3: document.getElementById("prompt-audio-3"),
};

const speakingStatus = {
  2: document.getElementById("status-speaking-2"),
  3: document.getElementById("status-speaking-3"),
};

const writingFields = {
  1: document.getElementById("writing-1"),
  2: document.getElementById("writing-2"),
  3: document.getElementById("writing-3"),
};

const writingWordStatus = {
  1: document.getElementById("word-writing-1"),
  2: document.getElementById("word-writing-2"),
  3: document.getElementById("word-writing-3"),
};

const timerDisplay = document.getElementById("timer-display");
const allOutputField = document.getElementById("all-output");
const ttsProviderSelect = document.getElementById("tts-provider");
const geminiVoiceSelect = document.getElementById("gemini-voice");
const sttLanguageSelect = document.getElementById("stt-language");
const sttProviderSelect = document.getElementById("stt-provider");
const task2QuestionMeta = document.getElementById("task2-question-meta");
const task2BankMeta = document.getElementById("task2-bank-meta");
const promptBlocks = {
  2: document.getElementById("prompt-block-2"),
  3: document.getElementById("prompt-block-3"),
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognizers = {};
let activeRecognitionTask = null;
const noSpeechCount = {
  2: 0,
  3: 0,
};
const interimTranscript = {
  2: "",
  3: "",
};
const mediaRecorders = {
  2: null,
  3: null,
};
const mediaChunks = {
  2: [],
  3: [],
};
const mediaStreams = {
  2: null,
  3: null,
};

let timerSeconds = 60 * 60;
let timerHandle = null;
const promptAudioUrls = {
  2: null,
  3: null,
};

const task2QuestionBanks = {
  february: [
  "Je suis un(e) voisin(e). Je prepare la fete des voisins pour le week-end prochain. Vous souhaitez y assister et vous me posez des questions sur l'organisation (lieu, horaires, nourriture a apporter, etc.).",
  "Je suis un(e) ami(e). Je vais souvent en vacances dans une station de ski au Canada. Ce type de voyage vous interesse et vous me posez des questions pour savoir si cela pourrait vous convenir (destination, hebergement, activites, etc.).",
  "Je suis un(e) voisin(e). Je me deplace au travail a velo chaque jour. Vous souhaitez adopter ce mode de transport en ville et vous me demandez des renseignements pour savoir si c'est adapte (points positifs, budget, securite, etc.).",
  "Je suis employe(e) a l'office de tourisme de Vancouver. Vous souhaitez aller dans un musee et vous me demandez des informations sur les musees de la ville (types, tarifs, heures d'ouverture, etc.).",
  "Je suis un(e) collegue. Je fais du teletravail quelques jours chaque semaine. Vous souhaitez en savoir plus et vous me posez des questions sur mon travail a domicile (planning, materiel, organisation, etc.).",
  "Je suis un(e) ami(e) et je dois m'absenter pendant le week-end. Je vous demande de veiller sur ma fille de 3 ans. Vous la connaissez un peu, mais vous n'etes pas tres proches. Je vous donne des explications pour bien s'occuper d'elle. Vous me demandez des informations sur ses habitudes (repas, jeux, sommeil, etc.).",
  "Je suis un(e) collegue et je vous suggere d'assister ensemble a un spectacle. Vous me demandez des informations sur le spectacle (type, lieu, heure) et sur les details pratiques de la sortie (transport, participants, etc.).",
  "Je suis employe(e) au service culturel de la mairie. Vous voulez vous informer sur les differentes activites culturelles de la ville (activites sportives, ateliers, musees, spectacles, etc.). Vous m'interrogez sur les details pratiques (nature des activites, frequence, tarifs, duree, etc.).",
  "Je suis employe(e) dans une agence de voyages. Vous etes client(e) et vous cherchez des idees pour un voyage au Canada. Vous m'interrogez afin d'obtenir des details (lieux a visiter, prix, logement, activites, etc.).",
  "Vous etes en deplacement en voiture au Canada et votre vehicule ne fonctionne plus. Vous appelez votre assurance afin de connaitre les services proposes (assistance, reparations, retour, etc.). Je suis l'agent d'assurance charge de vous informer.",
  "Je suis un(e) collegue et j'ai effectue un court sejour dans une region canadienne. Vous me demandez des informations sur mon experience (sites visites, type de logement, activites realisees, etc.).",
  "Je suis un(e) collegue. Vous vous etes recemment installe au Canada et vous m'interrogez sur le systeme de sante canadien (docteurs, etablissements de soins, conges maladie, medicaments, etc.).",
  "Je travaille dans un bureau de tourisme. Vous souhaitez visiter un parc de loisirs (aquarium, zoo, parc naturel). Vous me demandez des renseignements (heures d'ouverture, prix, services de restauration, etc.).",
  "Je suis employe(e) dans une agence touristique au Canada. Vous prevoyez une croisiere et vous me demandez des informations (couts, duree, animations proposees, etc.).",
  "Vous venez voir un logement en location. Je suis l'ancien locataire. Vous me demandez des informations sur l'immeuble, le voisinage, la presence d'un gardien et le secteur.",
  "Je produis des fruits et legumes biologiques. Je les vends directement aux particuliers. Vous etes interesse(e) et vous me posez des questions pour connaitre les prix, les produits, la livraison, etc.",
  "Je suis un(e) ami(e) et je m'engage dans une association qui soutient les personnes agees. Vous souhaitez en savoir plus et vous me posez des questions (type d'activites, public concerne, comment s'inscrire, etc.).",
  "Je suis un(e) collegue. J'ai passe dix ans au Canada. Vous pensez partir vivre a Ottawa. Vous me posez des questions sur mon experience d'integration (se loger, travailler, s'adapter a la culture, etc.).",
  "Je suis un(e) voisin(e). J'ai visite le zoo le week-end dernier. Vous pensez y aller en famille. Vous me posez des questions pour preparer votre sortie (jour, animaux a voir, prix, etc.).",
  "Je suis employe(e) dans une agence de voyages. Vous souhaitez partir au Canada pour profiter des sports d'hiver. Vous me posez des questions (activites, hebergements, tarifs, etc.).",
  ],
  january: [
    "Je suis un(e) ami(e) canadien(ne) que vous n'avez pas vu(e) depuis un long moment. Vous vous informez sur ma situation et vous m'interrogez sur ma vie quotidienne (emploi, proches, passe-temps, etc.).",
    "Je suis un(e) ami(e). J'ai un paquet a envoyer, mais je ne peux pas m'en occuper. Je vous sollicite pour m'aider. Vous me demandez des informations pour verifier si vous pouvez le prendre en charge (delai, taille du colis, duree de la demarche, etc.).",
    "Je suis un(e) ami(e). Je vous propose de venir celebrer l'anniversaire de ma soeur. Vous me demandez des renseignements sur elle afin de choisir un cadeau approprie (gouts, loisirs, personnalite, etc.).",
    "Je suis un(e) ami(e). Vous avez envie de commencer une serie, mais vous etes indecis(e). Vous me demandez des informations pour faire votre choix (categorie, acteurs, plateforme de streaming, etc.).",
    "Vous venez d'emmenager au Canada. Je suis un collegue. Vous voulez faire de nouvelles connaissances et vous demandez comment proceder (activites, endroits, sorties, etc.).",
    "Je suis employe(e) dans un restaurant. Vous souhaitez preparer un repas d'anniversaire pour votre meilleur(e) ami(e). Interrogez-moi sur les prestations du restaurant (menus, tarifs, horaires, disponibilites, etc.).",
    "Nous travaillons ensemble. Je propose a la vente des habits pour enfants de seconde main. Vous souhaitez en savoir plus. Interrogez-moi sur ces articles (tailles disponibles, tarifs, quantite, etc.).",
    "Je suis un(e) voisin(e). Je propose des cours de cuisine. Vous souhaitez en savoir plus. Interrogez-moi afin de savoir comment se deroulent les cours (prix, recettes, participants, etc.).",
    "Je suis un(e) ami(e). J'ai vecu une croisiere en bateau. Vous souhaitez en organiser une. Interrogez-moi pour en savoir plus (prix, activites, services proposes, etc.).",
    "Je suis un(e) ami(e). Je souhaite vendre mon logement. Vous voulez en savoir plus. Interrogez-moi afin d'obtenir des renseignements (pieces, equipements, tarif, etc.).",
    "Je suis un(e) ami(e). Vous etes recemment arrive(e) dans ma ville. Vous cherchez a organiser une sortie economique et vous me demandez des renseignements (endroits, activites, transports, etc.).",
    "Je suis un(e) voisin(e). Je dispose d'une maison de vacances en bord de mer que je propose a la location. Vous souhaitez en savoir plus et vous me demandez des precisions (amenagements, lieu, tarif, etc.).",
    "Je suis employe(e) dans une boutique de mobilier. Vous desirez recevoir un meuble et vous me demandez des informations sur la livraison (cout, delai, moyen utilise, etc.).",
    "Dans la salle d'attente, nous attendons le train qui a pris du retard et nous discutons un peu. Je vous parle de mon interet pour la montagne, et vous me demandez des details (regions, randonnees, equipement, etc.).",
    "Nous participons a une soiree et nous venons de faire connaissance. Je vous mentionne que je reviens tout juste d'un sejour, et vous me demandez des informations (periode, endroits visites, avis, etc.).",
    "Je suis charge(e) de l'accueil dans un centre d'information dedie aux associations de la ville. Vous souhaitez devenir benevole dans une association proche de chez vous. Vous me demandez des renseignements (domaines d'action, activites, personnes concernees, organisation du temps, etc.).",
    "Je suis enseignant(e) de francais. Vous etes recemment arrive(e) au Canada et vous souhaitez prendre des cours individuels. Vous me demandez des informations sur mon experience professionnelle (parcours, methodes d'enseignement, prix, etc.).",
    "Je suis un(e) ami(e) du Canada. Je rentre d'un excellent sejour a la montagne. Vous souhaitez organiser un voyage similaire et vous me demandez des informations sur mon experience (destination, logement, activites, etc.).",
    "Je suis un(e) ami(e). Je participe a des cours de theatre toutes les semaines. Vous voulez vous inscrire et vous me demandez des details (horaires, prix, fonctionnement, etc.).",
    "Vous etes recemment arrive(e) au Quebec. Je suis un(e) voisin(e) et je vous propose un aperitif de bienvenue. Lors de cette rencontre, vous me demandez des details pour decouvrir la vie du quartier (habitants, commerces, activites, etc.).",
  ],
};
task2QuestionBanks.all = [...task2QuestionBanks.february, ...task2QuestionBanks.january];

const task2BankLabels = {
  february: "February",
  january: "January",
  all: "All",
};

let task2ActiveBank = "february";
let task2QuestionIndex = 0;

function formatSeconds(totalSeconds) {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatSeconds(timerSeconds);
  timerDisplay.classList.toggle("over-time", timerSeconds <= 300);
}

function startTimer() {
  if (timerHandle) return;
  timerHandle = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds -= 1;
      updateTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  if (!timerHandle) return;
  clearInterval(timerHandle);
  timerHandle = null;
}

function resetTimer() {
  pauseTimer();
  timerSeconds = 60 * 60;
  updateTimerDisplay();
}

function wordCount(text) {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

function updateWordCount(task) {
  const count = wordCount(writingFields[task].value);
  writingWordStatus[task].textContent = `${count} words`;
}

function playPromptWithBrowserVoice(task) {
  if (!window.speechSynthesis) {
    alert("Speech playback is not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(speakingPrompts[task]);
  utterance.lang = "fr-CA";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  speakingStatus[task].textContent = "Playing (browser voice)";

  utterance.onend = () => {
    speakingStatus[task].textContent = "Idle";
  };

  window.speechSynthesis.speak(utterance);
}

async function playPromptWithGemini(task) {
  speakingStatus[task].textContent = "Generating audio...";

  try {
    const response = await fetch("/api/gemini-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: speakingPrompts[task],
        voiceName: geminiVoiceSelect.value,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `TTS request failed (${response.status})`);
    }

    const audioBlob = await response.blob();

    if (promptAudioUrls[task]) {
      URL.revokeObjectURL(promptAudioUrls[task]);
    }

    promptAudioUrls[task] = URL.createObjectURL(audioBlob);
    const player = promptAudioPlayers[task];
    player.src = promptAudioUrls[task];
    await player.play();

    speakingStatus[task].textContent = "Playing (Gemini)";
    player.onended = () => {
      speakingStatus[task].textContent = "Idle";
    };
  } catch (error) {
    speakingStatus[task].textContent = "Gemini TTS error";
    alert(`Gemini TTS failed: ${error.message}`);
  }
}

function setTask2Question(index) {
  const activeBank = task2QuestionBanks[task2ActiveBank];
  const total = activeBank.length;
  task2QuestionIndex = ((index % total) + total) % total;
  const prompt = activeBank[task2QuestionIndex];
  speakingPrompts[2] = prompt;
  promptElements[2].textContent = prompt;
  task2QuestionMeta.textContent = `Question ${task2QuestionIndex + 1}/${total}`;
  task2BankMeta.textContent = `Bank: ${task2BankLabels[task2ActiveBank]}`;
}

function nextTask2Question() {
  setTask2Question(task2QuestionIndex + 1);
}

function previousTask2Question() {
  setTask2Question(task2QuestionIndex - 1);
}

function randomTask2Question() {
  const activeBank = task2QuestionBanks[task2ActiveBank];
  if (activeBank.length < 2) return;
  let nextIndex = task2QuestionIndex;
  while (nextIndex === task2QuestionIndex) {
    nextIndex = Math.floor(Math.random() * activeBank.length);
  }
  setTask2Question(nextIndex);
}

function selectTask2Bank(bank) {
  if (!task2QuestionBanks[bank]) return;
  task2ActiveBank = bank;
  setTask2Question(0);
}

function playPrompt(task) {
  const provider = ttsProviderSelect.value;
  if (provider === "gemini") {
    playPromptWithGemini(task);
    return;
  }
  playPromptWithBrowserVoice(task);
}

function getRecognitionLanguage() {
  return sttLanguageSelect?.value || "fr-FR";
}

function isServerSttSelected() {
  return (sttProviderSelect?.value || "server") === "server";
}

function buildRecognizer(task) {
  if (!SpeechRecognition) return null;
  const recognizer = new SpeechRecognition();
  recognizer.lang = getRecognitionLanguage();
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onstart = () => {
    activeRecognitionTask = task;
    speakingStatus[task].textContent = "Listening";
  };

  recognizer.onresult = (event) => {
    let finalChunk = "";
    let gotAnyText = false;
    let latestInterim = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript;
      if (text && text.trim()) gotAnyText = true;
      if (event.results[i].isFinal) {
        finalChunk += text + " ";
      } else {
        latestInterim += text + " ";
      }
    }

    if (gotAnyText) {
      noSpeechCount[task] = 0;
      speakingStatus[task].textContent = "Listening";
    }

    if (finalChunk) {
      transcriptFields[task].value = `${transcriptFields[task].value}${finalChunk}`.trim() + " ";
      interimTranscript[task] = "";
    } else {
      interimTranscript[task] = latestInterim.trim();
    }
  };

  recognizer.onerror = (event) => {
    if (event.error === "no-speech") {
      noSpeechCount[task] += 1;
      speakingStatus[task].textContent = "No speech detected";
      return;
    }

    if (event.error === "audio-capture") {
      speakingStatus[task].textContent = "Mic not detected";
      return;
    }

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      speakingStatus[task].textContent = "Mic permission blocked";
      return;
    }

    speakingStatus[task].textContent = `Error: ${event.error}`;
  };

  recognizer.onend = () => {
    // Edge may end before converting interim text to final text.
    if (interimTranscript[task]) {
      transcriptFields[task].value = `${transcriptFields[task].value}${interimTranscript[task]} `.trim() + " ";
      interimTranscript[task] = "";
    }

    if (noSpeechCount[task] >= 3) {
      speakingStatus[task].textContent = "Stopped: no speech captured";
      noSpeechCount[task] = 0;
      if (activeRecognitionTask === task) activeRecognitionTask = null;
      return;
    }
    if (activeRecognitionTask === task) activeRecognitionTask = null;
    speakingStatus[task].textContent = "Idle";
  };

  return recognizer;
}

function startRecognition(task) {
  if (isServerSttSelected()) {
    startServerTranscription(task);
    return;
  }

  if (!SpeechRecognition) {
    alert("Speech transcription is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  noSpeechCount[task] = 0;
  interimTranscript[task] = "";
  if (activeRecognitionTask && activeRecognitionTask !== task) {
    stopRecognition(activeRecognitionTask);
  }

  if (!recognizers[task]) {
    recognizers[task] = buildRecognizer(task);
  }

  if (!recognizers[task]) return;
  recognizers[task].lang = getRecognitionLanguage();

  try {
    recognizers[task].start();
  } catch (_error) {
    // Avoid duplicate start errors when already active.
  }
}

function stopRecognition(task) {
  if (isServerSttSelected()) {
    stopServerTranscription(task);
    return;
  }

  noSpeechCount[task] = 0;
  if (interimTranscript[task]) {
    transcriptFields[task].value = `${transcriptFields[task].value}${interimTranscript[task]} `.trim() + " ";
    interimTranscript[task] = "";
  }
  const recognizer = recognizers[task];
  if (!recognizer) return;
  recognizer.stop();
}

async function transcribeBlobWithServer(task, blob) {
  speakingStatus[task].textContent = "Transcribing...";
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  const audioBase64 = btoa(binary);

  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mimeType: blob.type || "audio/webm",
      language: getRecognitionLanguage(),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `STT failed (${response.status})`);
  }

  const data = await response.json();
  const text = (data.text || "").trim();
  if (text) {
    transcriptFields[task].value = `${transcriptFields[task].value}${text} `.trim() + " ";
    speakingStatus[task].textContent = "Idle";
  } else {
    speakingStatus[task].textContent = "No speech recognized (try speaking longer, closer to mic)";
  }
}

async function startServerTranscription(task) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    speakingStatus[task].textContent = "Recording unsupported in this browser";
    alert("Audio recording is unsupported in this browser.");
    return;
  }

  if (mediaRecorders[task] && mediaRecorders[task].state === "recording") return;

  if (activeRecognitionTask && activeRecognitionTask !== task) {
    stopRecognition(activeRecognitionTask);
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreams[task] = stream;
    mediaChunks[task] = [];

    const recorderOptions = {};
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      recorderOptions.mimeType = "audio/webm;codecs=opus";
    } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
      recorderOptions.mimeType = "audio/ogg;codecs=opus";
    }

    const recorder = new MediaRecorder(stream, recorderOptions);
    mediaRecorders[task] = recorder;
    activeRecognitionTask = task;
    speakingStatus[task].textContent = "Listening";

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) mediaChunks[task].push(event.data);
    };

    recorder.onstop = async () => {
      const chunkList = mediaChunks[task];
      mediaChunks[task] = [];

      if (mediaStreams[task]) {
        mediaStreams[task].getTracks().forEach((track) => track.stop());
        mediaStreams[task] = null;
      }

      mediaRecorders[task] = null;
      if (activeRecognitionTask === task) activeRecognitionTask = null;

      if (!chunkList.length) {
        speakingStatus[task].textContent = "No audio captured";
        return;
      }

      const blob = new Blob(chunkList, { type: recorder.mimeType || "audio/webm" });

      try {
        await transcribeBlobWithServer(task, blob);
      } catch (error) {
        speakingStatus[task].textContent = "STT error";
        alert(`Transcription failed: ${error.message}`);
      }
    };

    // Emit periodic chunks to improve capture reliability in Edge/Opera.
    recorder.start(250);
  } catch (_error) {
    speakingStatus[task].textContent = "Mic permission blocked";
  }
}

function stopServerTranscription(task) {
  const recorder = mediaRecorders[task];
  if (!recorder || recorder.state !== "recording") return;
  speakingStatus[task].textContent = "Stopping...";
  recorder.stop();
}

async function copyText(value, label) {
  if (!value.trim()) {
    alert(`No text available for ${label}.`);
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    alert(`${label} copied to clipboard.`);
  } catch (_err) {
    alert("Clipboard copy failed. Please copy manually.");
  }
}

function compileAll() {
  const compiled = [
    "TCF PRACTICE EXPORT",
    "",
    "SPEAKING TASK 2:",
    transcriptFields[2].value.trim() || "(empty)",
    "",
    "SPEAKING TASK 3:",
    transcriptFields[3].value.trim() || "(empty)",
    "",
    "WRITING TASK 1:",
    writingFields[1].value.trim() || "(empty)",
    "",
    "WRITING TASK 2:",
    writingFields[2].value.trim() || "(empty)",
    "",
    "WRITING TASK 3:",
    writingFields[3].value.trim() || "(empty)",
  ].join("\n");

  allOutputField.value = compiled;
}

function buildTask2EvaluationText() {
  const instruction =
    "you are a TCF examiner, please evaluate this Speaking Task 2 question and answer, provide a score in the CEFR and NCLC framework and also provide improvement tips";
  const question = speakingPrompts[2] || "";
  const answer = transcriptFields[2].value.trim();

  return [
    `"${instruction}"`,
    "",
    "Speaking Task 2 Question:",
    question || "(empty)",
    "",
    "Speaking Task 2 Answer:",
    answer || "(empty)",
  ].join("\n");
}

function bindButtons() {
  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const task = button.dataset.task ? Number(button.dataset.task) : null;

      if (action === "task2-prev") previousTask2Question();
      if (action === "task2-random") randomTask2Question();
      if (action === "task2-next") nextTask2Question();
      if (action === "task2-bank" && button.dataset.bank) selectTask2Bank(button.dataset.bank);
      if (action === "toggle-prompt" && task) {
        const block = promptBlocks[task];
        if (!block) return;
        const nowHidden = block.classList.toggle("hidden");
        button.textContent = nowHidden ? "Reveal Question Text" : "Hide Question Text";
      }
      if (action === "play-prompt" && task) playPrompt(task);
      if (action === "start-rec" && task) startRecognition(task);
      if (action === "stop-rec" && task) stopRecognition(task);
      if (action === "copy-speaking" && task) copyText(transcriptFields[task].value, `Speaking Task ${task}`);
      if (action === "copy-task2-eval") copyText(buildTask2EvaluationText(), "Task 2 evaluation prompt");
      if (action === "copy-writing" && task) copyText(writingFields[task].value, `Writing Task ${task}`);
    });
  });

  document.getElementById("start-timer").addEventListener("click", startTimer);
  document.getElementById("pause-timer").addEventListener("click", pauseTimer);
  document.getElementById("reset-timer").addEventListener("click", resetTimer);

  document.getElementById("compile-all").addEventListener("click", compileAll);
  document.getElementById("copy-all").addEventListener("click", () => {
    compileAll();
    copyText(allOutputField.value, "All tasks export");
  });
}

function bindWritingCounters() {
  Object.keys(writingFields).forEach((taskKey) => {
    const task = Number(taskKey);
    writingFields[task].addEventListener("input", () => updateWordCount(task));
    updateWordCount(task);
  });
}

function init() {
  ttsProviderSelect.value = "gemini";
  sttProviderSelect.value = "server";
  setTask2Question(0);
  bindButtons();
  bindWritingCounters();
  updateTimerDisplay();

  if (!SpeechRecognition && !window.MediaRecorder) {
    speakingStatus[2].textContent = "Transcription unsupported in this browser";
    speakingStatus[3].textContent = "Transcription unsupported in this browser";
    document.querySelectorAll('button[data-action="start-rec"], button[data-action="stop-rec"]').forEach((button) => {
      button.disabled = true;
      button.title = "Speech transcription is unsupported in this browser.";
    });
  }
}

init();
