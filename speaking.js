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
const recordingIndicators = {
  2: document.getElementById("rec-indicator-2"),
  3: document.getElementById("rec-indicator-3"),
};
const micMeterFills = {
  2: document.getElementById("mic-meter-fill-2"),
  3: document.getElementById("mic-meter-fill-3"),
};
const micMeterValues = {
  2: document.getElementById("mic-meter-value-2"),
  3: document.getElementById("mic-meter-value-3"),
};

const ttsProviderSelect = document.getElementById("tts-provider");
const geminiVoiceSelect = document.getElementById("gemini-voice");
const sttLanguageSelect = document.getElementById("stt-language");
const sttProviderSelect = document.getElementById("stt-provider");
const task2ModeSelect = document.getElementById("task2-mode");
const task2LiveUrlInput = document.getElementById("task2-live-url");
const task2LiveStatus = document.getElementById("task2-live-status");
const task2QuestionMeta = document.getElementById("task2-question-meta");
const task2BankMeta = document.getElementById("task2-bank-meta");
const task3QuestionMeta = document.getElementById("task3-question-meta");
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
const recorderFlushTimers = {
  2: null,
  3: null,
};
const task2LiveUtteranceBuffer = {
  text: "",
};
const task2InterimState = {
  timer: null,
  lastRawInterim: "",
};
const task2NativeAudioState = {
  stream: null,
  audioContext: null,
  source: null,
  processor: null,
  muteGain: null,
  isActive: false,
  inputSampleRate: 16000,
};
let task2CaptionRecognizer = null;
let task2CaptionActive = false;
let task2CaptionRestartTimer = null;
let task2AwaitingResponseTimer = null;
let task2LastExaminerResponseAt = 0;
const task2ExaminerAudioBuffer = {
  chunks: [],
  mimeType: "audio/pcm;rate=24000",
  flushTimer: null,
  isPlaying: false,
};
const emptyServerSttChunks = {
  2: 0,
  3: 0,
};
const taskMaxDurationMs = {
  2: 3.5 * 60 * 1000,
  3: 4.5 * 60 * 1000,
};
const recordingTimeouts = {
  2: null,
  3: null,
};
const timedOutTask = {
  2: false,
  3: false,
};
const keepListeningTask = {
  2: false,
  3: false,
};
const vertexLoopState = {
  2: {
    sawSpeechThisCycle: false,
    reconnectAttempts: 0,
    promptedSilence: false,
  },
};
let task2SilenceTimer = null;
let task2LastVoiceActivityAt = 0;
const micMeters = {
  2: { audioContext: null, analyser: null, source: null, rafId: null, data: null },
  3: { audioContext: null, analyser: null, source: null, rafId: null, data: null },
};

function clearTask2SilenceTimer() {
  if (task2SilenceTimer) {
    clearTimeout(task2SilenceTimer);
    task2SilenceTimer = null;
  }
}

function clearRecorderFlushTimer(task) {
  if (recorderFlushTimers[task]) {
    clearInterval(recorderFlushTimers[task]);
    recorderFlushTimers[task] = null;
  }
}

function clearTask2InterimTimer() {
  if (task2InterimState.timer) {
    clearTimeout(task2InterimState.timer);
    task2InterimState.timer = null;
  }
}

function clearTask2CaptionRestart() {
  if (task2CaptionRestartTimer) {
    clearTimeout(task2CaptionRestartTimer);
    task2CaptionRestartTimer = null;
  }
}

function clearTask2AwaitingResponseTimer() {
  if (task2AwaitingResponseTimer) {
    clearTimeout(task2AwaitingResponseTimer);
    task2AwaitingResponseTimer = null;
  }
}

function armTask2AwaitingResponseTimer() {
  clearTask2AwaitingResponseTimer();
  task2AwaitingResponseTimer = setTimeout(() => {
    if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) return;
    const since = Date.now() - task2LastExaminerResponseAt;
    if (since < 5000) return;
    sendTask2LiveText("Bonjour, on peut commencer l'entretien ?");
  }, 8000);
}

function b64ToBytes(base64) {
  const binary = atob(base64 || "");
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function pcm16ToWavBlob(pcmBytes, sampleRate = 24000, channels = 1) {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBytes.length;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);
  let offset = 0;
  const writeString = (value) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    offset += value.length;
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  new Uint8Array(wav, 44).set(pcmBytes);
  return new Blob([wav], { type: "audio/wav" });
}

function float32ToPcm16Base64(input) {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function downsampleFloat32(input, inputRate, outputRate = 16000) {
  if (!input || !input.length) return new Float32Array(0);
  if (!inputRate || inputRate <= 0 || inputRate === outputRate) {
    return input;
  }
  if (outputRate > inputRate) {
    return input;
  }

  const ratio = inputRate / outputRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.min(input.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i += 1) {
      accum += input[i];
      count += 1;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function concatUint8(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function uint8ToB64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function armTask2SilenceTimer() {
  clearTask2SilenceTimer();
  if (!isTask2VertexMode() || !keepListeningTask[2]) return;
  task2SilenceTimer = setTimeout(() => {
    if (vertexLoopState[2].promptedSilence) return;
    vertexLoopState[2].promptedSilence = true;
    const prompt = "Je ne t'entends pas, peux-tu répéter ?";
    transcriptFields[2].value = `${transcriptFields[2].value}\n[Examinateur] ${prompt}`.trim() + "\n";
    speakingStatus[2].textContent = prompt;
  }, 10000);
}

const promptAudioUrls = {
  2: null,
  3: null,
};
let task2ExaminerAudioUrl = null;
const task2ExaminerAudio = new Audio();

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

let task2ActiveBank = "february";
let task2QuestionIndex = 0;
const task3QuestionBank = [
  "Que pensez-vous des habitudes de consommation dans les pays riches ?",
  "Tout le monde peut agir pour produire moins de dechets. Qu'en pensez-vous ?",
  "La consommation d'objets comme les vetements et les telephones est-elle excessive ? Pourquoi ?",
  "Il faut diminuer la circulation des voitures en ville. Etes-vous d'accord ?",
  "Pour preserver la planete, les transports en commun devraient etre gratuits. Qu'en pensez-vous ?",
  "Selon vous, doit-on proteger tous les animaux en voie de disparition ? Pourquoi ?",
  "Quel est votre avis sur les actions prises dans votre pays pour diminuer la pollution ?",
  "L'education a l'environnement devrait commencer tres tot chez les enfants. Qu'en pensez-vous ?",
  "Selon vous, les prestations sociales reduisent-elles la solidarite entre les membres d'une famille ? Expliquez.",
  "Est-il pratique de continuer a vivre avec ses parents apres l'age de 25 ans ? Qu'en pensez-vous ?",
  "Selon vous, est-il preferable d'avoir une grande famille ou de vrais amis ? Expliquez.",
  "Les personnes agees offrent souvent des conseils utiles. Qu'en pensez-vous ?",
  "Selon certains, des personnes tres differentes ne peuvent pas garder une amitie durable. Etes-vous d'accord ?",
  "Selon vous, est-ce simple de creer des amities lorsqu'on arrive dans un pays etranger ? Pourquoi ?",
  "A votre avis, les enfants peuvent-ils aider a mieux s'integrer lorsqu'on arrive dans un pays etranger ? Expliquez pourquoi.",
  "Peut-on considerer les membres de la famille comme nos meilleurs amis ? Expliquez pourquoi.",
  "Aujourd'hui, beaucoup disent qu'on ne peut plus vivre sans la technologie. Quelle est votre opinion ?",
  "Quels impacts et quels risques peuvent avoir l'usage regulier des telephones, des ordinateurs et des tablettes ?",
  "Avec Internet, on recoit plus d'informations. Qu'en pensez-vous ?",
  "Est-il important d'apprendre a utiliser les nouvelles technologies (Internet, reseaux sociaux, etc.) des l'enfance ? Pourquoi ?",
  "Les parents devraient-ils permettre a leurs enfants d'etre sur les reseaux sociaux ? Etes-vous d'accord ?",
  "Grace aux reseaux sociaux, il est plus facile de se faire des connaissances et des amities. Qu'en pensez-vous ?",
  "Les outils digitaux aident a economiser du temps dans la vie de tous les jours. Partagez-vous cet avis ?",
  "Peut-on vraiment tout acheter sur Internet ? Qu'en dites-vous ?",
  "Est-il possible de se fier aux rendez-vous medicaux a distance ? Pourquoi ?",
  "Est-il possible de se passer de medicaments aujourd'hui ? Pourquoi ?",
  "Peut-on vivre sans utiliser de medicaments ? Partagez-vous cette opinion ?",
  "La plupart des gens essaient-ils de paraitre plus jeunes que leur age ? Qu'en pensez-vous ?",
  "Les jeux video constituent-ils un danger pour les joueurs ? Expliquez pourquoi.",
  "Tous les etes, les magazines publient des recommandations pour perdre du poids. A votre avis, ces informations sont-elles efficaces et credibles ? Pourquoi ?",
  "De plus en plus de gens choisissent de devenir vegetariens. Que pensez-vous de ce regime alimentaire ?",
  "La vie en ville est-elle plus facile pour les personnes agees que la vie a la campagne ? Etes-vous d'accord ?",
  "L'essentiel dans la vie est-il de trouver du bonheur au travail ? Qu'en pensez-vous ?",
  "A l'avenir, grace aux nouvelles technologies, le travail ne sera plus necessaire. Qu'en pensez-vous ?",
  "Les entreprises devraient-elles reduire le teletravail pour leurs salaries ? Pourquoi ?",
  "Pourquoi les gens s'interessent-ils aux voyages en train, en avion ou en bus (selon le contexte local) ?",
  "De quelle maniere les entreprises peuvent-elles faciliter l'integration des nouveaux employes ?",
  "Pensez-vous que le fait de resider dans plusieurs pays puisse ameliorer les perspectives professionnelles ?",
  "Le tourisme permet-il a un pays de se developper et de progresser economiquement ?",
  "Le salaire est-il le facteur principal dans un emploi ? Etes-vous d'accord ?",
  "Selon vous, est-il necessaire de suivre de longues etudes pour reussir dans la vie ?",
  "Quelle etait votre matiere preferee a l'ecole ? Pour quelle raison ?",
  "Quelles lecons ou matieres devraient avoir plus de place dans les programmes scolaires ? Pourquoi ?",
  "Pensez-vous qu'Internet joue un role benefique dans l'education des enfants ?",
  "Est-il necessaire d'avoir des diplomes pour reussir dans sa carriere professionnelle ? Justifiez votre reponse.",
  "Il est possible de se remettre aux etudes ou de commencer des etudes a tout age. Qu'en pensez-vous ?",
  "Faut-il toujours dire toute la verite aux enfants ? Donnez votre avis.",
  "Pensez-vous que les etablissements scolaires devraient valoriser davantage les activites liees a l'art (musique, theatre, arts visuels, etc.) ? Pourquoi ?",
  "Selon vous, les voyages sont-ils benefiques ? Pourquoi ?",
  "De nombreuses personnes n'apprecient pas de voyager seules. Partagez-vous cette opinion ? Pourquoi ?",
  "Quelles sont les raisons qui peuvent pousser une personne a s'engager dans une action humanitaire ?",
  "Faut-il maitriser la langue du pays ou l'on reside ? Pourquoi ?",
  "Selon vous, les livres ont-ils perdu leur utilite dans la societe actuelle ?",
  "Les metiers lies a l'art (cinema, musique, peinture, etc.) ne sont pas vus comme de vrais emplois. Qu'en pensez-vous ?",
  "Voyager a l'etranger peut transformer une personne. Qu'en pensez-vous ?",
  "Pensez-vous qu'il soit simple de preserver sa culture d'origine en vivant a l'etranger ? Expliquez pourquoi.",
];
let task3QuestionIndex = 0;
let task2LiveSocket = null;
let task2SessionStarted = false;
let task2ReconnectInProgress = false;
let task2WsPingTimer = null;

function clearTask2WsHeartbeat() {
  if (task2WsPingTimer) {
    clearInterval(task2WsPingTimer);
    task2WsPingTimer = null;
  }
}

function startTask2WsHeartbeat() {
  clearTask2WsHeartbeat();
  task2WsPingTimer = setInterval(() => {
    if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) return;
    task2LiveSocket.send(JSON.stringify({ type: "ping", t: Date.now() }));
  }, 15000);
}

function currentLang() {
  const stored = localStorage.getItem("tcf_lang");
  if (stored === "fr" || stored === "en") return stored;
  return document.documentElement.lang.startsWith("fr") ? "fr" : "en";
}

function uiText(key) {
  const lang = currentLang();
  const dict = {
    en: {
      question: "Question",
      bank: "Bank",
      february: "February",
      january: "January",
      all: "All",
      reveal: "Reveal Question Text",
      hide: "Hide Question Text",
      live_connected: "Connected",
      live_disconnected: "Disconnected",
      live_connecting: "Connecting...",
      live_sent: "Sent to examiner",
    },
    fr: {
      question: "Question",
      bank: "Banque",
      february: "Février",
      january: "Janvier",
      all: "Toutes",
      reveal: "Afficher le texte de la question",
      hide: "Masquer le texte de la question",
      live_connected: "Connecté",
      live_disconnected: "Déconnecté",
      live_connecting: "Connexion...",
      live_sent: "Envoyé à l'examinateur",
    },
  };
  return dict[lang][key] || dict.en[key] || key;
}

function isTask2VertexMode() {
  return task2ModeSelect?.value === "vertex";
}

function setTask2LiveStatusText(key) {
  if (!task2LiveStatus) return;
  task2LiveStatus.textContent = uiText(key);
}

function setRecordingIndicator(task, isActive) {
  const indicator = recordingIndicators[task];
  if (!indicator) return;
  indicator.classList.toggle("hidden", !isActive);
}

function updateMicMeter(task, levelRatio) {
  const fill = micMeterFills[task];
  const value = micMeterValues[task];
  if (!fill || !value) return;
  const clamped = Math.max(0, Math.min(1, levelRatio || 0));
  const percent = Math.round(clamped * 100);
  fill.style.width = `${percent}%`;
  value.textContent = `${percent}%`;
}

function stopMicMeter(task) {
  const meter = micMeters[task];
  if (!meter) return;
  if (meter.rafId) {
    cancelAnimationFrame(meter.rafId);
    meter.rafId = null;
  }
  if (meter.source) {
    try {
      meter.source.disconnect();
    } catch (_error) {}
    meter.source = null;
  }
  if (meter.analyser) {
    try {
      meter.analyser.disconnect();
    } catch (_error) {}
    meter.analyser = null;
  }
  if (meter.audioContext) {
    meter.audioContext.close().catch(() => {});
    meter.audioContext = null;
  }
  meter.data = null;
  updateMicMeter(task, 0);
}

function startMicMeter(task, stream) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || !stream) return;
  stopMicMeter(task);

  const meter = micMeters[task];
  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;
  const data = new Uint8Array(analyser.fftSize);

  source.connect(analyser);
  meter.audioContext = context;
  meter.source = source;
  meter.analyser = analyser;
  meter.data = data;

  const loop = () => {
    if (!meter.analyser || !meter.data) return;
    meter.analyser.getByteTimeDomainData(meter.data);
    let sumSquares = 0;
    for (let i = 0; i < meter.data.length; i += 1) {
      const normalized = (meter.data[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / meter.data.length);
    const scaled = Math.min(1, rms * 8);
    updateMicMeter(task, scaled);

    if (task === 2 && isTask2VertexMode() && keepListeningTask[2] && scaled > 0.06) {
      const now = Date.now();
      if (now - task2LastVoiceActivityAt > 1200) {
        task2LastVoiceActivityAt = now;
        vertexLoopState[2].promptedSilence = false;
        armTask2SilenceTimer();
      }
    }

    meter.rafId = requestAnimationFrame(loop);
  };

  meter.rafId = requestAnimationFrame(loop);
}

async function playTextWithGemini(task, text) {
  const cleanText = (text || "").trim();
  if (!cleanText) return;
  try {
    speakingStatus[task].textContent = "Examiner speaking...";
    const response = await fetch("/api/gemini-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: cleanText,
        voiceName: geminiVoiceSelect.value,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `TTS request failed (${response.status})`);
    }

    const audioBlob = await response.blob();
    if (task2ExaminerAudioUrl) {
      URL.revokeObjectURL(task2ExaminerAudioUrl);
    }

    task2ExaminerAudioUrl = URL.createObjectURL(audioBlob);
    task2ExaminerAudio.pause();
    task2ExaminerAudio.currentTime = 0;
    task2ExaminerAudio.src = task2ExaminerAudioUrl;
    await task2ExaminerAudio.play();

    speakingStatus[task].textContent = "Idle";
  } catch (error) {
    speakingStatus[task].textContent = "Examiner voice unavailable (text only)";
  }
}

async function playTask2LiveModelAudio(audioBase64, mimeType = "audio/pcm;rate=24000") {
  try {
    const bytes = b64ToBytes(audioBase64);
    let blob = null;
    if (String(mimeType || "").toLowerCase().includes("wav")) {
      blob = new Blob([bytes], { type: "audio/wav" });
    } else {
      const match = String(mimeType || "").match(/rate=(\d+)/i);
      const sampleRate = match ? Number(match[1]) || 24000 : 24000;
      blob = pcm16ToWavBlob(bytes, sampleRate, 1);
    }

    if (task2ExaminerAudioUrl) URL.revokeObjectURL(task2ExaminerAudioUrl);
    task2ExaminerAudioUrl = URL.createObjectURL(blob);
    task2ExaminerAudio.pause();
    task2ExaminerAudio.currentTime = 0;
    task2ExaminerAudio.src = task2ExaminerAudioUrl;
    await task2ExaminerAudio.play();
  } catch (_error) {
    speakingStatus[2].textContent = "Examiner audio unavailable";
  }
}

function startTask2CaptionRecognition() {
  if (!SpeechRecognition) return;
  if (task2CaptionActive) return;

  if (!task2CaptionRecognizer) {
    task2CaptionRecognizer = new SpeechRecognition();
    task2CaptionRecognizer.lang = getRecognitionLanguage();
    task2CaptionRecognizer.continuous = true;
    task2CaptionRecognizer.interimResults = true;

    task2CaptionRecognizer.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const t = (event.results[i][0]?.transcript || "").trim();
        if (!t) continue;
        if (event.results[i].isFinal) {
          finalText += `${t} `;
        }
      }
      if (finalText.trim()) {
        const tag = currentLang() === "fr" ? "Candidat" : "Candidate";
        const sentence = finalText.trim();
        transcriptFields[2].value = `${transcriptFields[2].value}\n[${tag}] ${sentence}`.trim() + "\n";
        sendTask2LiveText(sentence);
      }
    };

    task2CaptionRecognizer.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        task2CaptionActive = false;
      }
    };

    task2CaptionRecognizer.onend = () => {
      if (!task2CaptionActive) return;
      clearTask2CaptionRestart();
      task2CaptionRestartTimer = setTimeout(() => {
        if (!task2CaptionActive) return;
        try {
          task2CaptionRecognizer.start();
        } catch (_error) {
          // ignore duplicate-start race
        }
      }, 250);
    };
  }

  task2CaptionActive = true;
  task2CaptionRecognizer.lang = getRecognitionLanguage();
  try {
    task2CaptionRecognizer.start();
  } catch (_error) {
    // ignore duplicate-start race
  }
}

function stopTask2CaptionRecognition() {
  task2CaptionActive = false;
  clearTask2CaptionRestart();
  clearTask2AwaitingResponseTimer();
  if (!task2CaptionRecognizer) return;
  try {
    task2CaptionRecognizer.stop();
  } catch (_error) {
    // ignore stop race
  }
}

function resetTask2ExaminerAudioBuffer() {
  task2ExaminerAudioBuffer.chunks = [];
  task2ExaminerAudioBuffer.mimeType = "audio/pcm;rate=24000";
  if (task2ExaminerAudioBuffer.flushTimer) {
    clearTimeout(task2ExaminerAudioBuffer.flushTimer);
    task2ExaminerAudioBuffer.flushTimer = null;
  }
}

async function flushTask2ExaminerAudioBuffer() {
  if (task2ExaminerAudioBuffer.isPlaying) return;
  if (!task2ExaminerAudioBuffer.chunks.length) return;

  task2ExaminerAudioBuffer.isPlaying = true;
  try {
    const merged = concatUint8(task2ExaminerAudioBuffer.chunks);
    const b64 = uint8ToB64(merged);
    const mime = task2ExaminerAudioBuffer.mimeType || "audio/pcm;rate=24000";
    resetTask2ExaminerAudioBuffer();
    await playTask2LiveModelAudio(b64, mime);
  } catch (_error) {
    resetTask2ExaminerAudioBuffer();
  } finally {
    task2ExaminerAudioBuffer.isPlaying = false;
  }
}

function queueTask2ExaminerAudioChunk(audioBase64, mimeType) {
  const bytes = b64ToBytes(audioBase64);
  if (!bytes.length) return;
  task2ExaminerAudioBuffer.chunks.push(bytes);
  if (mimeType) task2ExaminerAudioBuffer.mimeType = mimeType;

  if (task2ExaminerAudioBuffer.flushTimer) {
    clearTimeout(task2ExaminerAudioBuffer.flushTimer);
  }
  task2ExaminerAudioBuffer.flushTimer = setTimeout(() => {
    flushTask2ExaminerAudioBuffer();
  }, 500);
}

function connectTask2Live() {
  const wsUrl = (task2LiveUrlInput?.value || "").trim();
  if (!wsUrl) {
    alert("Add your Cloud Run WebSocket URL first.");
    return;
  }
  localStorage.setItem("task2_live_ws_url", wsUrl);

  if (task2LiveSocket && task2LiveSocket.readyState === WebSocket.OPEN) {
    task2LiveSocket.close(1000, "Reconnect");
  }

  setTask2LiveStatusText("live_connecting");
  task2LiveSocket = new WebSocket(wsUrl);

  task2LiveSocket.onopen = () => {
    resetTask2ExaminerAudioBuffer();
    task2ReconnectInProgress = false;
    task2LastExaminerResponseAt = Date.now();
    startTask2WsHeartbeat();
    setTask2LiveStatusText("live_connected");
    task2SessionStarted = false;
  };

  task2LiveSocket.onmessage = async (event) => {
    let data = null;
    try {
      data = JSON.parse(event.data);
    } catch (_error) {
      return;
    }

    if (data.type === "ready") {
      setTask2LiveStatusText("live_connected");
      speakingStatus[2].textContent = "Waiting examiner greeting...";
      return;
    }

    if (data.type === "examiner_text" && data.text) {
      task2LastExaminerResponseAt = Date.now();
      clearTask2AwaitingResponseTimer();
      const tag = currentLang() === "fr" ? "Examinateur" : "Examiner";
      transcriptFields[2].value = `${transcriptFields[2].value}\n[${tag}] ${data.text}`.trim() + "\n";
      speakingStatus[2].textContent = data.text;
      return;
    }

    if (data.type === "candidate_text_live" && data.text) {
      const tag = currentLang() === "fr" ? "Candidat" : "Candidate";
      transcriptFields[2].value = `${transcriptFields[2].value}\n[${tag}] ${data.text}`.trim() + "\n";
      return;
    }

    if (data.type === "examiner_audio" && data.audioBase64) {
      task2LastExaminerResponseAt = Date.now();
      clearTask2AwaitingResponseTimer();
      speakingStatus[2].textContent = "Examiner speaking...";
      queueTask2ExaminerAudioChunk(data.audioBase64, data.mimeType);
      return;
    }

    if (data.type === "examiner_audio_end") {
      await flushTask2ExaminerAudioBuffer();
      return;
    }

    if (data.type === "error") {
      speakingStatus[2].textContent = "Live error";
      const details = data.details ? `\nDetails: ${JSON.stringify(data.details)}` : "";
      const raw = `${data.message || ""} ${details}`;
      if (raw.includes("keepalive ping timeout") && !task2ReconnectInProgress) {
        task2ReconnectInProgress = true;
        setTask2LiveStatusText("live_connecting");
        speakingStatus[2].textContent = "Reconnecting live session...";
        setTimeout(() => {
          disconnectTask2Live();
          connectTask2Live();
        }, 900);
        return;
      }
      alert(`Task 2 live error: ${data.message || "Unknown error"}${details}`);
    }
  };

  task2LiveSocket.onerror = () => {
    clearTask2WsHeartbeat();
    setTask2LiveStatusText("live_disconnected");
    speakingStatus[2].textContent = "Live socket error";
  };

  task2LiveSocket.onclose = () => {
    clearTask2WsHeartbeat();
    setTask2LiveStatusText("live_disconnected");
  };
}

function disconnectTask2Live() {
  clearTask2WsHeartbeat();
  clearTask2AwaitingResponseTimer();
  resetTask2ExaminerAudioBuffer();
  stopTask2CaptionRecognition();
  stopTask2NativeAudioCapture(true);
  task2SessionStarted = false;
  if (task2LiveSocket) {
    task2LiveSocket.close(1000, "Client disconnect");
    task2LiveSocket = null;
  }
  setTask2LiveStatusText("live_disconnected");
}

function sendTask2LiveText(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;
  if (!isTask2VertexMode()) return false;
  if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) return false;

  task2LiveSocket.send(
    JSON.stringify({
      type: "candidate_text",
      text: trimmed,
      prompt: speakingPrompts[2],
      language: getRecognitionLanguage(),
    })
  );
  speakingStatus[2].textContent = uiText("live_sent");
  return true;
}

async function startTask2NativeAudioCapture() {
  if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) {
    alert("Connect Task 2 live first.");
    return;
  }
  if (task2NativeAudioState.isActive) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      alert("Web Audio API is not supported in this browser.");
      return;
    }

    const context = new AudioCtx({ sampleRate: 16000 });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(1024, 1, 1);
    const muteGain = context.createGain();
    muteGain.gain.value = 0;

    task2NativeAudioState.inputSampleRate = context.sampleRate || 16000;

    processor.onaudioprocess = (event) => {
      if (!task2NativeAudioState.isActive) return;
      if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcmInput = downsampleFloat32(
        input,
        task2NativeAudioState.inputSampleRate || 16000,
        16000
      );
      task2LiveSocket.send(
        JSON.stringify({
          type: "audio_chunk",
          audioBase64: float32ToPcm16Base64(pcmInput),
          mimeType: "audio/pcm;rate=16000",
        })
      );
    };

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(context.destination);

    task2NativeAudioState.stream = stream;
    task2NativeAudioState.audioContext = context;
    task2NativeAudioState.source = source;
    task2NativeAudioState.processor = processor;
    task2NativeAudioState.muteGain = muteGain;
    task2NativeAudioState.isActive = true;

    mediaStreams[2] = stream;
    startMicMeter(2, stream);
    setRecordingIndicator(2, true);
    speakingStatus[2].textContent = "Listening (live audio)";
    armRecordingTimeout(2);
    activeRecognitionTask = 2;
  } catch (_error) {
    keepListeningTask[2] = false;
    speakingStatus[2].textContent = "Mic permission blocked";
  }
}

function stopTask2NativeAudioCapture(fromTimeout = false) {
  if (!task2NativeAudioState.isActive && !task2NativeAudioState.stream) return;

  task2NativeAudioState.isActive = false;
  task2NativeAudioState.inputSampleRate = 16000;
  clearRecordingTimeout(2);
  setRecordingIndicator(2, false);
  stopMicMeter(2);

  if (task2LiveSocket && task2LiveSocket.readyState === WebSocket.OPEN) {
    task2LiveSocket.send(JSON.stringify({ type: "audio_stream_end" }));
  }

  if (task2NativeAudioState.source) {
    try { task2NativeAudioState.source.disconnect(); } catch (_error) {}
    task2NativeAudioState.source = null;
  }
  if (task2NativeAudioState.processor) {
    try { task2NativeAudioState.processor.disconnect(); } catch (_error) {}
    task2NativeAudioState.processor = null;
  }
  if (task2NativeAudioState.muteGain) {
    try { task2NativeAudioState.muteGain.disconnect(); } catch (_error) {}
    task2NativeAudioState.muteGain = null;
  }
  if (task2NativeAudioState.audioContext) {
    task2NativeAudioState.audioContext.close().catch(() => {});
    task2NativeAudioState.audioContext = null;
  }
  if (task2NativeAudioState.stream) {
    task2NativeAudioState.stream.getTracks().forEach((track) => track.stop());
    task2NativeAudioState.stream = null;
  }
  mediaStreams[2] = null;
  if (activeRecognitionTask === 2) activeRecognitionTask = null;

  if (timedOutTask[2] || fromTimeout) {
    showTimeUp(2);
  } else {
    speakingStatus[2].textContent = "Idle";
  }
}

function flushTask2LiveUtterance() {
  const buffered = task2LiveUtteranceBuffer.text.trim();
  if (!buffered) return;
  task2LiveUtteranceBuffer.text = "";
  sendTask2LiveText(buffered);
  armTask2SilenceTimer();
}

function handleTask2LiveTranscriptChunk(text, forceFlush = false) {
  const chunk = (text || "").trim();
  if (!chunk) return;
  task2LiveUtteranceBuffer.text = `${task2LiveUtteranceBuffer.text} ${chunk}`.trim();

  const words = task2LiveUtteranceBuffer.text.split(/\s+/).filter(Boolean).length;
  const hasSentenceEnd = /[.!?]\s*$/.test(task2LiveUtteranceBuffer.text);
  if (forceFlush || hasSentenceEnd || words >= 10) {
    flushTask2LiveUtterance();
  }
}

function scheduleTask2InterimSend(interimText) {
  if (!isTask2VertexMode() || !keepListeningTask[2]) return;
  const clean = (interimText || "").trim();
  if (!clean) return;

  clearTask2InterimTimer();
  task2InterimState.timer = setTimeout(() => {
    let delta = clean;
    const prev = task2InterimState.lastRawInterim;
    if (prev && clean.startsWith(prev)) {
      delta = clean.slice(prev.length).trim();
    }
    task2InterimState.lastRawInterim = clean;
    if (!delta) return;
    handleTask2LiveTranscriptChunk(delta);
  }, 900);
}

function sendTask2TranscriptToLive() {
  if (!isTask2VertexMode()) {
    alert("Set Task 2 Engine to Advanced Vertex first.");
    return;
  }
  if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) {
    alert("Connect Task 2 live first.");
    return;
  }

  const text = transcriptFields[2].value.trim();
  if (!text) {
    alert("Record and transcribe your answer first.");
    return;
  }

  sendTask2LiveText(text);
}

function getRecognitionLanguage() {
  return sttLanguageSelect?.value || "fr-FR";
}

function isServerSttSelected() {
  return (sttProviderSelect?.value || "server") === "server";
}

function shouldUseBrowserSttForTask(task) {
  return task === 2 && isTask2VertexMode() && !!SpeechRecognition;
}

function showTimeUp(task) {
  speakingStatus[task].textContent = "Your time is up";
  speakingStatus[task].classList.add("status-timeup");
}

function clearTimeUp(task) {
  speakingStatus[task].classList.remove("status-timeup");
}

function clearRecordingTimeout(task) {
  if (recordingTimeouts[task]) {
    clearTimeout(recordingTimeouts[task]);
    recordingTimeouts[task] = null;
  }
}

function armRecordingTimeout(task) {
  clearRecordingTimeout(task);
  timedOutTask[task] = false;
  recordingTimeouts[task] = setTimeout(() => {
    timedOutTask[task] = true;
    stopRecognition(task, true);
    showTimeUp(task);
  }, taskMaxDurationMs[task]);
}

function setTask2Question(index) {
  const activeBank = task2QuestionBanks[task2ActiveBank];
  const total = activeBank.length;
  task2QuestionIndex = ((index % total) + total) % total;
  const prompt = activeBank[task2QuestionIndex];
  speakingPrompts[2] = prompt;
  promptElements[2].textContent = prompt;
  task2QuestionMeta.textContent = `${uiText("question")} ${task2QuestionIndex + 1}/${total}`;
  task2BankMeta.textContent = `${uiText("bank")}: ${uiText(task2ActiveBank)}`;
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

function setTask3Question(index) {
  const total = task3QuestionBank.length;
  task3QuestionIndex = ((index % total) + total) % total;
  const prompt = task3QuestionBank[task3QuestionIndex];
  speakingPrompts[3] = prompt;
  promptElements[3].textContent = prompt;
  task3QuestionMeta.textContent = `${uiText("question")} ${task3QuestionIndex + 1}/${total}`;
}

function nextTask3Question() {
  setTask3Question(task3QuestionIndex + 1);
}

function previousTask3Question() {
  setTask3Question(task3QuestionIndex - 1);
}

function randomTask3Question() {
  if (task3QuestionBank.length < 2) return;
  let nextIndex = task3QuestionIndex;
  while (nextIndex === task3QuestionIndex) {
    nextIndex = Math.floor(Math.random() * task3QuestionBank.length);
  }
  setTask3Question(nextIndex);
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

function playPrompt(task) {
  const provider = ttsProviderSelect.value;
  if (provider === "gemini") {
    playPromptWithGemini(task);
    return;
  }
  playPromptWithBrowserVoice(task);
}

function buildRecognizer(task) {
  if (!SpeechRecognition) return null;
  const recognizer = new SpeechRecognition();
  recognizer.lang = getRecognitionLanguage();
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onstart = () => {
    activeRecognitionTask = task;
    clearTimeUp(task);
    setRecordingIndicator(task, true);
    if (task === 2 && isTask2VertexMode()) {
      vertexLoopState[2].sawSpeechThisCycle = false;
    }
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
      if (task === 2 && isTask2VertexMode()) {
        vertexLoopState[2].sawSpeechThisCycle = true;
        vertexLoopState[2].reconnectAttempts = 0;
        vertexLoopState[2].promptedSilence = false;
        armTask2SilenceTimer();
      }
      speakingStatus[task].textContent = "Listening";
    }

    if (finalChunk) {
      transcriptFields[task].value = `${transcriptFields[task].value}${finalChunk}`.trim() + " ";
      if (task === 2 && isTask2VertexMode()) {
        clearTask2InterimTimer();
        task2InterimState.lastRawInterim = "";
        sendTask2LiveText(finalChunk);
        armTask2SilenceTimer();
      }
      interimTranscript[task] = "";
    } else {
      interimTranscript[task] = latestInterim.trim();
      if (task === 2 && isTask2VertexMode() && latestInterim.trim()) {
        scheduleTask2InterimSend(latestInterim.trim());
      }
    }
  };

  recognizer.onerror = (event) => {
    if (event.error === "no-speech") {
      noSpeechCount[task] += 1;
      speakingStatus[task].textContent = "No speech detected";
      return;
    }

    if (event.error === "audio-capture") {
      setRecordingIndicator(task, false);
      if (task === 2 && isTask2VertexMode()) keepListeningTask[2] = false;
      if (task === 2) clearTask2SilenceTimer();
      speakingStatus[task].textContent = "Mic not detected";
      return;
    }

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setRecordingIndicator(task, false);
      if (task === 2 && isTask2VertexMode()) keepListeningTask[2] = false;
      if (task === 2) clearTask2SilenceTimer();
      speakingStatus[task].textContent = "Mic permission blocked";
      return;
    }

    speakingStatus[task].textContent = `Error: ${event.error}`;
  };

  recognizer.onend = () => {
    clearRecordingTimeout(task);
    if (interimTranscript[task]) {
      transcriptFields[task].value = `${transcriptFields[task].value}${interimTranscript[task]} `.trim() + " ";
      interimTranscript[task] = "";
    }

    if (noSpeechCount[task] >= 3 && !(task === 2 && isTask2VertexMode() && keepListeningTask[2])) {
      setRecordingIndicator(task, false);
      speakingStatus[task].textContent = "Stopped: no speech captured";
      noSpeechCount[task] = 0;
      if (activeRecognitionTask === task) activeRecognitionTask = null;
      return;
    }

    if (activeRecognitionTask === task) activeRecognitionTask = null;
    if (timedOutTask[task]) {
      showTimeUp(task);
      return;
    }

    if (task === 2 && isTask2VertexMode() && keepListeningTask[2]) {
      vertexLoopState[2].reconnectAttempts += 1;
      if (vertexLoopState[2].reconnectAttempts > 12) {
        setRecordingIndicator(task, false);
        keepListeningTask[2] = false;
        clearTask2SilenceTimer();
        speakingStatus[2].textContent = "Recording stopped. Click Start again and speak immediately.";
        return;
      }

      speakingStatus[2].textContent = "Listening (reconnecting...)";
      setTimeout(() => {
        if (!keepListeningTask[2]) return;
        try {
          recognizer.start();
        } catch (_error) {
          // Duplicate start races can happen; next end will retry.
        }
      }, 500);
      return;
    }

    setRecordingIndicator(task, false);
    speakingStatus[task].textContent = "Idle";
  };

  return recognizer;
}

async function transcribeBlobWithServer(task, blob) {
  speakingStatus[task].textContent = "Transcribing...";
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  const audioBase64 = btoa(binary);

  const mimeType = blob.type || "audio/webm";
  const isOpus = mimeType.includes("webm") || mimeType.includes("ogg");
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      mimeType,
      sampleRateHertz: isOpus ? 48000 : undefined,
      language: getRecognitionLanguage(),
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const details = body.details ? `\nDetails: ${JSON.stringify(body.details)}` : "";
    const code = body.code ? `${body.code}: ` : "";
    throw new Error(`${code}${body.error || `STT failed (${response.status})`}${details}`);
  }

  const data = await response.json();
  const text = (data.text || "").trim();
  if (text) {
    emptyServerSttChunks[task] = 0;
    transcriptFields[task].value = `${transcriptFields[task].value}${text} `.trim() + " ";
    if (task === 2 && isTask2VertexMode()) {
      handleTask2LiveTranscriptChunk(text);
      armTask2SilenceTimer();
    }
    if (timedOutTask[task]) {
      showTimeUp(task);
    } else {
      speakingStatus[task].textContent = "Idle";
    }
  } else {
    emptyServerSttChunks[task] += 1;
    if (timedOutTask[task]) {
      showTimeUp(task);
    } else {
      const audioLooksPresent = (blob?.size || 0) > 5000;
      if (emptyServerSttChunks[task] >= 6) {
        speakingStatus[task].textContent = audioLooksPresent
          ? "Audio captured, but words were not recognized. Try slower speech and set language to French (Canada)."
          : "No speech recognized (check mic input device and speak closer)";
      } else {
        speakingStatus[task].textContent = "Listening";
      }
    }
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 48000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStreams[task] = stream;
    startMicMeter(task, stream);
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
    clearTimeUp(task);
    speakingStatus[task].textContent = "Listening";

    const isTask2VertexLiveMode = task === 2 && isTask2VertexMode();

    recorder.ondataavailable = async (event) => {
      if (!event.data || event.data.size === 0) return;

      if (isTask2VertexLiveMode) {
        try {
          await transcribeBlobWithServer(task, event.data);
        } catch (error) {
          speakingStatus[task].textContent = "STT error";
          alert(`Transcription failed: ${error.message}`);
        }
        return;
      }

      mediaChunks[task].push(event.data);
    };

    recorder.onstop = async () => {
      setRecordingIndicator(task, false);
      stopMicMeter(task);
      clearRecordingTimeout(task);
      const chunkList = mediaChunks[task];
      mediaChunks[task] = [];

      if (mediaStreams[task]) {
        mediaStreams[task].getTracks().forEach((track) => track.stop());
        mediaStreams[task] = null;
      }

      mediaRecorders[task] = null;
      if (activeRecognitionTask === task) activeRecognitionTask = null;

      if (isTask2VertexLiveMode) {
        clearRecorderFlushTimer(task);
        flushTask2LiveUtterance();
        if (timedOutTask[task]) {
          showTimeUp(task);
        } else {
          speakingStatus[task].textContent = "Idle";
        }
        return;
      }

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

    recorder.start(isTask2VertexLiveMode ? 2000 : 250);
    if (isTask2VertexLiveMode) {
      clearRecorderFlushTimer(task);
      recorderFlushTimers[task] = setInterval(() => {
        if (recorder.state === "recording") {
          try {
            recorder.requestData();
          } catch (_error) {
            // ignore requestData race
          }
        }
      }, 2200);
    }
    setRecordingIndicator(task, true);
    armRecordingTimeout(task);
  } catch (_error) {
    setRecordingIndicator(task, false);
    stopMicMeter(task);
    speakingStatus[task].textContent = "Mic permission blocked";
  }
}

function stopServerTranscription(task, fromTimeout = false) {
  const recorder = mediaRecorders[task];
  if (!recorder || recorder.state !== "recording") return;
  clearRecorderFlushTimer(task);
  if (task === 2 && isTask2VertexMode()) {
    flushTask2LiveUtterance();
  }
  setRecordingIndicator(task, false);
  stopMicMeter(task);
  clearRecordingTimeout(task);
  if (!fromTimeout) speakingStatus[task].textContent = "Stopping...";
  recorder.stop();
}

function startRecognition(task) {
  keepListeningTask[task] = true;
  if (task === 2 && isTask2VertexMode()) {
    clearTask2InterimTimer();
    task2InterimState.lastRawInterim = "";
    vertexLoopState[2].sawSpeechThisCycle = false;
    vertexLoopState[2].reconnectAttempts = 0;
    vertexLoopState[2].promptedSilence = false;
    armTask2SilenceTimer();
    if (task2LiveSocket && task2LiveSocket.readyState === WebSocket.OPEN && !task2SessionStarted) {
      task2SessionStarted = true;
      task2LiveSocket.send(
        JSON.stringify({
          type: "start_session",
          prompt: speakingPrompts[2],
          language: getRecognitionLanguage(),
        })
      );
      armTask2AwaitingResponseTimer();
    }
    startTask2NativeAudioCapture().then(() => {
      if (task2NativeAudioState.isActive) {
        startTask2CaptionRecognition();
      }
    });
    return;
  }

  const useBrowserForLiveTask2 = shouldUseBrowserSttForTask(task);
  if (useBrowserForLiveTask2) {
    sttProviderSelect.value = "browser";
  }

  if (isServerSttSelected() && !useBrowserForLiveTask2) {
    startServerTranscription(task);
    return;
  }

  if (!SpeechRecognition) {
    alert("Speech transcription is not supported in this browser. Use Chrome or Edge.");
    return;
  }

  noSpeechCount[task] = 0;
  interimTranscript[task] = "";
  clearTimeUp(task);
  armRecordingTimeout(task);

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
    // Avoid duplicate-start errors.
  }
}

function stopRecognition(task, fromTimeout = false) {
  clearRecorderFlushTimer(task);
  if (task === 2 && isTask2VertexMode()) {
    stopTask2CaptionRecognition();
    stopTask2NativeAudioCapture(fromTimeout);
    clearTask2InterimTimer();
    task2InterimState.lastRawInterim = "";
    flushTask2LiveUtterance();
    keepListeningTask[2] = false;
    clearTask2SilenceTimer();
    return;
  }
  setRecordingIndicator(task, false);
  stopMicMeter(task);
  keepListeningTask[task] = false;
  if (task === 2) {
    vertexLoopState[2].sawSpeechThisCycle = false;
    vertexLoopState[2].reconnectAttempts = 0;
    vertexLoopState[2].promptedSilence = false;
    clearTask2SilenceTimer();
  }

  if (isServerSttSelected()) {
    stopServerTranscription(task, fromTimeout);
    return;
  }

  clearRecordingTimeout(task);
  noSpeechCount[task] = 0;
  if (interimTranscript[task]) {
    transcriptFields[task].value = `${transcriptFields[task].value}${interimTranscript[task]} `.trim() + " ";
    interimTranscript[task] = "";
  }

  const recognizer = recognizers[task];
  if (!recognizer) return;
  recognizer.stop();
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

function buildTask2EvaluationText() {
  const instruction =
    "you are a TCF examiner, please evaluate this Speaking Task 2 question and answer, provide a score in the CEFR and NCLC framework and also provide improvement tips";
  const question = speakingPrompts[2] || "";
  const answer = transcriptFields[2].value.trim();

  return [
    `\"${instruction}\"`,
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
      if (action === "task2-live-connect") connectTask2Live();
      if (action === "task2-live-disconnect") disconnectTask2Live();
      if (action === "task2-send-live") sendTask2TranscriptToLive();
      if (action === "task3-prev") previousTask3Question();
      if (action === "task3-random") randomTask3Question();
      if (action === "task3-next") nextTask3Question();
      if (action === "toggle-prompt" && task) {
        const block = promptBlocks[task];
        if (!block) return;
        const nowHidden = block.classList.toggle("hidden");
        button.textContent = nowHidden ? uiText("reveal") : uiText("hide");
      }
      if (action === "play-prompt" && task) playPrompt(task);
      if (action === "start-rec" && task) startRecognition(task);
      if (action === "stop-rec" && task) stopRecognition(task);
      if (action === "copy-speaking" && task) copyText(transcriptFields[task].value, `Speaking Task ${task}`);
      if (action === "copy-task2-eval") copyText(buildTask2EvaluationText(), "Task 2 evaluation prompt");
    });
  });
}

function init() {
  setRecordingIndicator(2, false);
  setRecordingIndicator(3, false);
  updateMicMeter(2, 0);
  updateMicMeter(3, 0);
  ttsProviderSelect.value = "gemini";
  sttProviderSelect.value = "server";
  setTask2Question(0);
  setTask3Question(0);
  bindButtons();
  if (task2LiveUrlInput) {
    task2LiveUrlInput.value = localStorage.getItem("task2_live_ws_url") || "";
  }
  setTask2LiveStatusText("live_disconnected");
  document.addEventListener("tcf:langchange", () => {
    setTask2Question(task2QuestionIndex);
    setTask3Question(task3QuestionIndex);
    document.querySelectorAll("button[data-action='toggle-prompt']").forEach((button) => {
      const task = Number(button.dataset.task);
      const block = promptBlocks[task];
      const isHidden = block ? block.classList.contains("hidden") : true;
      button.textContent = isHidden ? uiText("reveal") : uiText("hide");
    });
    if (!task2LiveSocket || task2LiveSocket.readyState !== WebSocket.OPEN) {
      setTask2LiveStatusText("live_disconnected");
    } else {
      setTask2LiveStatusText("live_connected");
    }
  });

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
