document.querySelectorAll('.practice-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    const menu = document.getElementById(button.dataset.target);
    if (menu) menu.classList.toggle('open', !expanded);
  });
});

document.querySelectorAll('.lang-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    const menu = document.getElementById(button.dataset.target);
    if (menu) menu.classList.toggle('open', !expanded);
  });
});

document.addEventListener('click', (event) => {
  document.querySelectorAll('.practice-toggle').forEach((button) => {
    const menu = document.getElementById(button.dataset.target);
    if (!menu) return;
    const clickedInside = button.contains(event.target) || menu.contains(event.target);
    if (!clickedInside) {
      button.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    }
  });

  document.querySelectorAll('.lang-toggle').forEach((button) => {
    const menu = document.getElementById(button.dataset.target);
    if (!menu) return;
    const clickedInside = button.contains(event.target) || menu.contains(event.target);
    if (!clickedInside) {
      button.setAttribute('aria-expanded', 'false');
      menu.classList.remove('open');
    }
  });
});

const storedLang = localStorage.getItem('tcf_lang') || 'en';
if (window.applyTranslations) {
  window.applyTranslations(storedLang);
}
document.dispatchEvent(new CustomEvent('tcf:langchange', { detail: { lang: storedLang } }));

document.querySelectorAll('[data-lang-option]').forEach((option) => {
  option.addEventListener('click', () => {
    const lang = option.dataset.langOption;
    localStorage.setItem('tcf_lang', lang);
    if (window.applyTranslations) {
      window.applyTranslations(lang);
    }
    document.dispatchEvent(new CustomEvent('tcf:langchange', { detail: { lang } }));
    document.querySelectorAll('.lang-toggle').forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
    });
    document.querySelectorAll('.lang-menu').forEach((menu) => menu.classList.remove('open'));
  });
});
