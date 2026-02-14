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
const task1QuestionMeta = document.getElementById("task1-question-meta");
const task1QuestionText = document.getElementById("writing-task1-question");
const task2QuestionMeta = document.getElementById("task2-question-meta-writing");
const task2QuestionText = document.getElementById("writing-task2-question");
const task3QuestionMeta = document.getElementById("task3-question-meta-writing");
const task3QuestionText = document.getElementById("writing-task3-question");
let timerSeconds = 60 * 60;
let timerHandle = null;
let task1QuestionIndex = 0;
let task2QuestionIndex = 0;
let task3QuestionIndex = 0;

const task1Questions = [
  "« Je souhaite acheter un velo en bon etat a un prix abordable. Contactez-moi par mail : Thomas@gmail.com »\n\nVous possedez un velo a vendre. Vous redigez un courriel pour presenter votre velo et proposer votre prix. Vous fixez aussi un moment pour que l'acheteur puisse le tester.\n\n(60 mots minimum/120 mots maximum)",
  "Vous prevoyez une sortie culturelle dans votre ville. Vous envoyez un message a vos amis pour les convier et leur fournir tous les details utiles (jour, endroit, programme des activites, etc.).\n\n(60 mots minimum/120 mots maximum)",
  "Vous pratiquez un sport au sein d'un club et vous avez gagne une competition. Redigez un courriel a vos amis pour leur parler de cet evenement et leur annoncer votre succes.\n\n(60 mots minimum/120 mots maximum)",
  "Vous envoyez un message a votre ami(e) afin de l'informer des preparatifs de votre demenagement dans votre nouveau logement et de lui demander son aide (date, lieu, etapes, etc.).\n\n(60 mots minimum/120 mots maximum)",
  "Dans le cadre d'un dossier consacre aux habitants, le journal « Bienvenue » vous demande d'ecrire un article. Installe(e) recemment dans la ville, vous devez d'abord vous presenter, puis decrire vos lieux favoris.\n\n(60 mots minimum/120 mots maximum)",
  "Vous souhaitez organiser un week-end avec vos proches le mois prochain. Vous envoyez un message pour leur expliquer votre plan, en decrivant le lieu, le moyen de transport et les activites prevues.\n\n(60 mots minimum/120 mots maximum)",
  "Un de vos proches souhaite partir en voyage pour decouvrir un nouveau pays. Vous lui envoyez un message pour lui presenter votre pays et ses traditions (lieux a visiter, sites touristiques, monuments, etc.).\n\n(60 mots minimum/120 mots maximum)",
  "« Salut,\n\nJ'espere que tu vas bien.\n\nDis-moi, que penses-tu de ta nouvelle universite ? Est-ce que l'ambiance avec les etudiants est bonne ? Comment trouves-tu les professeurs ?\n\nA tres bientot.\n\nMartin »\n\nVous ecrivez un message a Martin dans lequel vous presentez votre universite (les professeurs, les etudiants, les activites, etc.).\n\n(60 mots minimum/120 mots maximum)",
];

const task2Questions = [
  "Vous redigez un message a vos amis pour partager votre experience d'emploi saisonnier realise pendant les vacances d'ete.\n\n(120 mots minimum/150 mots maximum)",
  "Vous avez pris part a une soiree dediee a l'ecologie a l'universite pour la protection de la planete. Vous redigez un article sur votre blog pour partager votre experience et dire pourquoi cette soiree vous a interesse(e).\n\n(120 mots minimum/150 mots maximum)",
  "Le site « colocation.com » recherche des recits de personnes ayant vecu en colocation. Vous avez deja habite avec des amis en colocation. Vous partagez votre vecu et exprimez votre opinion sur cette maniere de se loger.\n\n(120 mots minimum/150 mots maximum)",
  "Vous avez pris part a un concours qui offre la possibilite de gagner un sejour de deux semaines dans votre ville favorite. Le theme du concours est « Mon artiste prefere ». Vous redigez un article sur votre blog pour presenter l'artiste que vous aimez le plus.\n\n(120 mots minimum/150 mots maximum)",
  "Apres avoir participe au concert de votre chanteur prefere, vous redigez un article sur votre blog afin de raconter ce moment et de donner envie a vos proches et aux lecteurs de venir a son prochain concert.\n\n(120 mots minimum/150 mots maximum)",
  "COURRIER DES LECTEURS\n\nPartir un an a l'etranger et tout quitter : est-ce une bonne ou une mauvaise idee ?\n\nExprimez votre opinion sur le site voyage.internaute.fr avec des exemples tires de votre experience personnelle.\n\n(120 mots minimum/150 mots maximum)",
  "Vous avez commence un nouvel emploi. Vous envoyez un courriel a vos proches pour leur raconter votre premiere semaine (entreprise, poste, missions, etc.).\n\n(120 mots minimum/150 mots maximum)",
  "Vous avez choisi d'arreter d'utiliser votre reseau social favori (Facebook, Instagram, etc.). Vous adressez un message a vos amis pour leur expliquer cette experience et les raisons de votre choix.\n\n(120 mots minimum/150 mots maximum)",
];

const task3Questions = [
  "Transports en commun : benefices et contraintes\n\nDocument 1:\nLa gratuite des transports en commun est une initiative tres positive. Elle permet de reduire le trafic automobile et de limiter les bouchons. Elle contribue aussi a diminuer la pollution et les risques pour la sante lies a l'air. Dans ma ville, ou les transports sont gratuits, on constate une hausse de leur utilisation. Cette mesure a egalement favorise le commerce local, car les habitants se rendent plus facilement au centre-ville pour leurs achats.\n\nDocument 2:\nA mon avis, cette mesure n'est pas appropriee. D'abord, la gratuite des transports represente un cout eleve pour les villes, et certaines, comme Toulouse, ont d'autres priorites, par exemple l'amenagement des espaces verts. Ensuite, il vaudrait mieux ameliorer la desserte des transports publics plutot que de les rendre gratuits, car certains quartiers en sont mal equipes. Enfin, garder les transports payants encourage les usagers a mieux respecter les installations, puisqu'ils financent leur fonctionnement.",
  "Devoirs a domicile : bienfaits et critiques\n\nDocument 1:\nD'apres certaines associations de parents d'eleves, les devoirs a domicile sont benefiques car ils permettent aux eleves de gerer leur temps seuls. Pour les parents, les devoirs representent une occasion de se rapprocher de l'ecole chaque jour. Meme si ce n'est pas toujours facile apres une journee de travail, ils aiment ce temps passe avec leurs enfants, qui se sentent valorises par l'interet que leurs parents leur montrent.\n\nDocument 2:\nNous nous opposons depuis longtemps aux devoirs a la maison pour differentes raisons. Leur efficacite pour ameliorer les resultats scolaires n'a jamais ete prouvee de maniere certaine. De nombreux parents n'ont pas le temps ou ne savent pas comment aider leurs enfants. De plus, les eleves qui ont compris le cours perdent du temps a refaire des exercices, tandis que ceux qui ne sont pas aides restent en difficulte. C'est pour cela que nous estimons qu'il faudrait abolir les devoirs a domicile.",
  "Villes et environnement : impacts et realites\n\nDocument 1:\nDe nos jours, les villes s'agrandissent sans cesse. Ce phenomene affecte malheureusement l'environnement. Plus une ville se developpe, plus ses effets sur la nature et sur l'homme sont nefastes. L'un des exemples les plus visibles est la deforestation. Les arbres et les espaces verts retiennent le carbone. Quand ils sont abattus pour construire des immeubles ou des routes, on detruit des zones importantes pour le stockage du carbone.\n\nDocument 2:\nPlus de la moitie des habitants de la planete vivent dans des villes, et dans les pays riches, huit habitants sur dix sont citadins. La vie urbaine constitue donc un enjeu ecologique majeur. On affirme souvent que les villes actuelles ne respectent pas l'environnement et que leur developpement augmente la pollution. Cependant, il faut relativiser : les villes ne sont pas toujours aussi polluantes qu'on l'imagine. Par exemple, un habitant de la ville consomme souvent moins d'energie qu'une personne a la campagne.",
  "Objets connectes : progres ou danger ?\n\nDocument 1:\nLes objets connectes rendent le quotidien plus pratique. Il s'agit d'appareils que vous controlez a distance a l'aide d'un telephone ou d'Internet, par exemple le chauffage ou l'ouverture des portes. Les montres et bracelets connectes permettent egalement d'observer vos activites. Un programme peut mesurer vos pas afin de vous motiver a faire plus d'exercice. Leur role est particulierement utile dans le secteur de la sante, car certains objets rappellent les consultations medicales ou la prise de medicaments.\n\nDocument 2:\nOn pense qu'il existe environ 50 milliards d'objets connectes a travers le monde : alarmes, televisions, cameras de securite, volets ou detecteurs de fumee. Toutefois, ce developpement entraine des risques lies a la securite. Un hacker peut controler un objet connecte en peu de temps. Par exemple, un cambrioleur pourrait verifier, a l'aide de cameras connectees, si une maison est vide. Il est egalement possible de pirater le systeme d'un vehicule connecte et de le diriger a distance.",
  "Les jeux video : entre risques et bienfaits\n\nDocument 1:\nDe l'enfance jusqu'a l'adolescence, les enfants jouent souvent aux jeux video et, avec le temps, cela peut provoquer des idees negatives et des comportements violents. Une etude recente realisee aupres de jeunes de 9 a 18 ans qui jouent regulierement montre que les jeux video violents augmentent fortement l'agressivite. D'apres Diego Gentil, ce phenomene serait inevitable, meme avec un controle parental.\n\nDocument 2:\nOn parle souvent des aspects negatifs des jeux video, pourtant ils peuvent aussi avoir des effets positifs sur le cerveau et la sante en general. Par exemple, ils permettent de developper certaines capacites mentales comme l'attention, l'imagination et l'analyse. Cela s'explique par le fait que, lorsque vous jouez, vous devez reflechir en permanence et resoudre des problemes.",
  "Le travail dans notre vie : necessite ou surcharge ?\n\nDocument 1:\nLe travail occupe une place importante dans notre vie : des l'enfance, on nous demande : « Que veux-tu devenir plus tard ? ». Meme s'il peut apporter de la satisfaction, il est souvent source de fatigue et peut donner l'impression d'etre coince dans une routine. Aujourd'hui, beaucoup de personnes constatent un desequilibre entre leur vie professionnelle et leur vie personnelle. Il devient necessaire de reflechir a la place du travail dans notre societe. Certains pensent qu'en travaillant moins, on pourrait profiter de davantage de temps libre, etre plus heureux et mieux vivre.\n\nDocument 2:\nLe travail fait partie de notre identite sociale. Lorsqu'on rencontre quelqu'un pour la premiere fois, on demande souvent : « Que faites-vous dans la vie ? », ce qui montre l'importance du travail dans la perception de soi. Selon le specialiste Jean-Daniel Remond, la vie professionnelle contribue a se construire : elle permet de rencontrer des gens, de creer des reseaux personnels et professionnels, de se sentir utile et meme de se faire des amis. Meme si certains decident de quitter leur emploi, pour la plupart, travailler est essentiel pour exister. Le travail reste donc crucial pour l'equilibre personnel et collectif.",
  "Femmes et hommes au travail\n\nDocument 1:\nDans certaines regions, comme le Quebec, l'egalite entre les femmes et les hommes est une realite. Beaucoup de femmes occupent desormais des postes a responsabilite et travaillent dans des domaines traditionnellement masculins, tels que le batiment ou la gestion d'entreprise. Avec les lois sur l'egalite et le changement des mentalites, les femmes ont aujourd'hui acces aux memes metiers que les hommes, sans subir de discrimination.\n\nDocument 2:\nMeme si des efforts sont faits pour atteindre la parite, des inegalites demeurent. Par exemple, certains metiers sont encore tres feminises, comme celui de sage-femme ou d'assistante maternelle. De plus, certaines personnes estiment que les femmes doivent rester a la maison pour s'occuper des enfants plutot que travailler dans des metiers exigeants ou a responsabilite. Il reste donc beaucoup a faire pour changer les mentalites et garantir les memes chances aux femmes et aux hommes.",
  "Faut-il mettre une photo sur son CV ?\n\nDocument 1:\nDe nos jours, certains candidats choisissent de mettre une photo sur leur CV, alors que d'autres preferent ne pas en mettre. Il faudrait interdire cette pratique pour eviter toute forme de discrimination ou d'injustice. Selon une etude menee par des specialistes du recrutement, la photo n'a pas de reelle utilite. Les resultats indiquent que les employeurs accordent plus d'attention a l'experience professionnelle (32 %) et aux diplomes (15 %) qu'a un physique. Seuls 2 % des recruteurs commencent par regarder la photo. Cette donnee est surprenante, compte tenu de l'importance donnee a l'apparence par certaines personnes.\n\nDocument 2:\nL'utilisation d'une photo sur le CV est un sujet qui divise les recruteurs. Certains estiment que la photo aide a se faire une idee du candidat avant la rencontre. Elle peut egalement faciliter la memorisation d'un candidat quand beaucoup de CV sont recus. D'autres pensent que tout depend du metier : pour les postes lies a l'accueil, par exemple, la photo peut etre appropriee. Cependant, elle doit toujours etre professionnelle pour creer une impression positive.",
];

function currentLang() {
  const stored = localStorage.getItem("tcf_lang");
  if (stored === "fr" || stored === "en") return stored;
  return document.documentElement.lang.startsWith("fr") ? "fr" : "en";
}

function uiText(key) {
  const lang = currentLang();
  const dict = {
    en: { question: "Question", words: "words" },
    fr: { question: "Question", words: "mots" },
  };
  return dict[lang][key] || dict.en[key] || key;
}

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
  writingWordStatus[task].textContent = `${count} ${uiText("words")}`;
}

function setTask1Question(index) {
  const total = task1Questions.length;
  task1QuestionIndex = ((index % total) + total) % total;
  task1QuestionText.textContent = task1Questions[task1QuestionIndex];
  task1QuestionMeta.textContent = `${uiText("question")} ${task1QuestionIndex + 1}/${total}`;
}

function nextTask1Question() {
  setTask1Question(task1QuestionIndex + 1);
}

function previousTask1Question() {
  setTask1Question(task1QuestionIndex - 1);
}

function randomTask1Question() {
  if (task1Questions.length < 2) return;
  let nextIndex = task1QuestionIndex;
  while (nextIndex === task1QuestionIndex) {
    nextIndex = Math.floor(Math.random() * task1Questions.length);
  }
  setTask1Question(nextIndex);
}

function setTask2Question(index) {
  const total = task2Questions.length;
  task2QuestionIndex = ((index % total) + total) % total;
  task2QuestionText.textContent = task2Questions[task2QuestionIndex];
  task2QuestionMeta.textContent = `${uiText("question")} ${task2QuestionIndex + 1}/${total}`;
}

function nextTask2Question() {
  setTask2Question(task2QuestionIndex + 1);
}

function previousTask2Question() {
  setTask2Question(task2QuestionIndex - 1);
}

function randomTask2Question() {
  if (task2Questions.length < 2) return;
  let nextIndex = task2QuestionIndex;
  while (nextIndex === task2QuestionIndex) {
    nextIndex = Math.floor(Math.random() * task2Questions.length);
  }
  setTask2Question(nextIndex);
}

function setTask3Question(index) {
  const total = task3Questions.length;
  task3QuestionIndex = ((index % total) + total) % total;
  task3QuestionText.textContent = task3Questions[task3QuestionIndex];
  task3QuestionMeta.textContent = `${uiText("question")} ${task3QuestionIndex + 1}/${total}`;
}

function nextTask3Question() {
  setTask3Question(task3QuestionIndex + 1);
}

function previousTask3Question() {
  setTask3Question(task3QuestionIndex - 1);
}

function randomTask3Question() {
  if (task3Questions.length < 2) return;
  let nextIndex = task3QuestionIndex;
  while (nextIndex === task3QuestionIndex) {
    nextIndex = Math.floor(Math.random() * task3Questions.length);
  }
  setTask3Question(nextIndex);
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

function getWritingQuestion(task) {
  if (task === 1) return task1Questions[task1QuestionIndex] || "";
  if (task === 2) return task2Questions[task2QuestionIndex] || "";
  if (task === 3) return task3Questions[task3QuestionIndex] || "";
  return "";
}

function buildWritingEvaluationText(task) {
  const instruction = `you are a TCF examiner, please evaluate this writing Task ${task} question and answer, provide a score in the CEFR and NCLC framework and also provide improvement tips`;
  const question = getWritingQuestion(task);
  const answer = writingFields[task]?.value?.trim() || "";

  return [
    instruction,
    "",
    `Writing Task ${task} Question:`,
    question || "(empty)",
    "",
    `Writing Task ${task} Answer:`,
    answer || "(empty)",
  ].join("\n");
}

function bindButtons() {
  document.querySelectorAll("button[data-action='task1-prev']").forEach((button) => {
    button.addEventListener("click", previousTask1Question);
  });
  document.querySelectorAll("button[data-action='task1-random']").forEach((button) => {
    button.addEventListener("click", randomTask1Question);
  });
  document.querySelectorAll("button[data-action='task1-next']").forEach((button) => {
    button.addEventListener("click", nextTask1Question);
  });
  document.querySelectorAll("button[data-action='task2-prev-writing']").forEach((button) => {
    button.addEventListener("click", previousTask2Question);
  });
  document.querySelectorAll("button[data-action='task2-random-writing']").forEach((button) => {
    button.addEventListener("click", randomTask2Question);
  });
  document.querySelectorAll("button[data-action='task2-next-writing']").forEach((button) => {
    button.addEventListener("click", nextTask2Question);
  });
  document.querySelectorAll("button[data-action='task3-prev-writing']").forEach((button) => {
    button.addEventListener("click", previousTask3Question);
  });
  document.querySelectorAll("button[data-action='task3-random-writing']").forEach((button) => {
    button.addEventListener("click", randomTask3Question);
  });
  document.querySelectorAll("button[data-action='task3-next-writing']").forEach((button) => {
    button.addEventListener("click", nextTask3Question);
  });

  document.querySelectorAll("button[data-action='copy-writing']").forEach((button) => {
    button.addEventListener("click", () => {
      const task = Number(button.dataset.task);
      copyText(buildWritingEvaluationText(task), `Writing Task ${task} evaluation prompt`);
    });
  });

  document.getElementById("start-timer").addEventListener("click", startTimer);
  document.getElementById("pause-timer").addEventListener("click", pauseTimer);
  document.getElementById("reset-timer").addEventListener("click", resetTimer);
}

function bindWritingCounters() {
  Object.keys(writingFields).forEach((taskKey) => {
    const task = Number(taskKey);
    writingFields[task].addEventListener("input", () => updateWordCount(task));
    updateWordCount(task);
  });
}

function init() {
  bindButtons();
  bindWritingCounters();
  setTask1Question(0);
  setTask2Question(0);
  setTask3Question(0);
  updateTimerDisplay();
  document.addEventListener("tcf:langchange", () => {
    updateWordCount(1);
    updateWordCount(2);
    updateWordCount(3);
    setTask1Question(task1QuestionIndex);
    setTask2Question(task2QuestionIndex);
    setTask3Question(task3QuestionIndex);
  });
}

init();
