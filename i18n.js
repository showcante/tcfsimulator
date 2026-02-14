const I18N = {
  en: {
    nav_brand: 'TCF Simulator',
    nav_home: 'Home',
    nav_practice: 'Practice Exam',
    nav_listening: 'Listening',
    nav_reading: 'Reading',
    nav_writing: 'Writing',
    nav_speaking: 'Speaking',
    lang_button: 'English 🇨🇦',
    lang_option_en: 'English 🇨🇦',
    lang_option_fr: 'Français (Québec)',

    home_eyebrow: 'TCF Canada Preparation',
    home_title: 'Prepare for the TCF Canada Exam',
    home_lead:
      'Train speaking, writing, reading, and listening in one place with a full simulation approach that mirrors real exam pressure. Switch between monthly question banks, replay oral prompts, and capture your spoken answers with transcription tools to review pronunciation, fluency, and structure. Build better habits with timed writing tasks, copy-ready evaluation prompts, and targeted external resources so each practice session gives you clear progress toward a stronger CEFR and NCLC performance.',
    home_what_title: 'What Is TCF Canada?',
    home_what_body:
      'TCF Canada is a French-language proficiency test recognized by Canadian authorities for economic immigration and citizenship applications. It evaluates your level from A1 to C2 based on the CEFR framework.',
    home_exam_title: 'Exam Structure (Click To Expand)',
    home_docs_title: 'Documents For Consultation',
    home_docs_manual: "TCF Candidate's Manual (Download)",
    home_docs_sheet: 'TCF Canada Presentation Sheet (Download)',
    home_key_title: 'Key Facts',
    home_key_1: 'Total duration is approximately 2 hours 47 minutes.',
    home_key_2: 'All 4 modules are mandatory for TCF Canada.',
    home_key_3: 'Results are generally issued to test centers within 15 working days.',
    home_key_4: 'Certificates are valid for 2 years.',
    home_key_hint: 'This summary follows the official TCF Canada structure published by France Education International.',

    acc_listening_title: 'Listening comprehension',
    acc_reading_title: 'Reading comprehension',
    acc_speaking_title: 'Speaking skills',
    acc_writing_title: 'Writing skills',

    listen_page_title: 'Listening Practice Resources',
    listen_page_lead: 'Use these external resources to train for the TCF Canada listening module.',
    read_page_title: 'Reading Practice Resources',
    read_page_lead: 'Train reading comprehension strategies and speed for TCF Canada.',
    writing_page_title: 'Writing Practice',
    writing_page_lead: 'Simulate the 3 writing tasks with timer and word counter.',
    speaking_page_title: 'Speaking Practice',
    speaking_page_lead: 'Task 2 and Task 3 oral prompt practice with Gemini TTS and Google STT.',
  },
  fr: {
    nav_brand: 'Simulateur TCF',
    nav_home: 'Accueil',
    nav_practice: "Examen d'entraînement",
    nav_listening: 'Compréhension orale',
    nav_reading: 'Compréhension écrite',
    nav_writing: 'Expression écrite',
    nav_speaking: 'Expression orale',
    lang_button: 'Français (Québec)',
    lang_option_en: 'English 🇨🇦',
    lang_option_fr: 'Français (Québec)',

    home_eyebrow: 'Préparation TCF Canada',
    home_title: "Préparez-vous pour l'examen TCF Canada",
    home_lead:
      'Entraînez-vous en expression orale, expression écrite, compréhension écrite et compréhension orale au même endroit avec une approche de simulation complète qui reproduit la pression réelle de l’examen. Alternez entre des banques de questions mensuelles, rejouez les consignes orales et transcrivez vos réponses parlées pour analyser la prononciation, la fluidité et la structure. Renforcez vos automatismes grâce aux tâches écrites chronométrées, aux prompts d’évaluation prêts à copier et aux ressources ciblées, afin que chaque séance vous rapproche d’un meilleur rendement CECR et NCLC.',
    home_what_title: 'Qu’est-ce que le TCF Canada ?',
    home_what_body:
      'Le TCF Canada est un test de français reconnu par les autorités canadiennes pour les demandes d’immigration économique et de citoyenneté. Il évalue votre niveau de A1 à C2 selon le CECR.',
    home_exam_title: 'Structure de l’examen (cliquez pour développer)',
    home_docs_title: 'Documents à consulter',
    home_docs_manual: 'Manuel du candidat TCF (téléchargement)',
    home_docs_sheet: 'Fiche de présentation TCF Canada (téléchargement)',
    home_key_title: 'Informations clés',
    home_key_1: 'Durée totale approximative : 2 h 47.',
    home_key_2: 'Les 4 modules sont obligatoires pour le TCF Canada.',
    home_key_3: 'Les résultats sont généralement transmis aux centres sous 15 jours ouvrables.',
    home_key_4: 'L’attestation est valide 2 ans.',
    home_key_hint: 'Ce résumé suit la structure officielle du TCF Canada publiée par France Éducation international.',

    acc_listening_title: 'Compréhension orale',
    acc_reading_title: 'Compréhension écrite',
    acc_speaking_title: 'Expression orale',
    acc_writing_title: 'Expression écrite',

    listen_page_title: 'Ressources de compréhension orale',
    listen_page_lead: 'Utilisez ces ressources externes pour vous entraîner au module de compréhension orale du TCF Canada.',
    read_page_title: 'Ressources de compréhension écrite',
    read_page_lead: 'Travaillez vos stratégies de lecture et votre vitesse pour le TCF Canada.',
    writing_page_title: 'Pratique de l’expression écrite',
    writing_page_lead: 'Simulez les 3 tâches d’écriture avec minuterie et compteur de mots.',
    speaking_page_title: 'Pratique de l’expression orale',
    speaking_page_lead: 'Entraînement des tâches 2 et 3 avec Gemini TTS et Google STT.',
  },
};

window.applyTranslations = function applyTranslations(lang) {
  const dict = I18N[lang] || I18N.en;
  document.documentElement.lang = lang === 'fr' ? 'fr-CA' : 'en';
  document.body.classList.toggle('lang-fr', lang === 'fr');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
    }
  });

  const langButton = document.querySelector('.lang-toggle .lang-label');
  if (langButton) {
    langButton.textContent = dict.lang_button;
  }
};
