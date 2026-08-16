const root = document.documentElement;
const form = document.getElementById('brief-form');
const output = document.getElementById('result');
const sendActions = document.getElementById('send-actions');
const toast = document.getElementById('toast');
const STORAGE_KEY = 'brief-draft';

document.querySelector('.theme-toggle').addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
});

document.getElementById('year').textContent = new Date().getFullYear();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-shown');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-shown'), 2400);
}

/* --- сбор ответов --- */

function readField(field) {
  const type = field.dataset.type;

  if (type === 'text') {
    const el = field.querySelector('input[type=text], textarea');
    return el ? el.value.trim() : '';
  }
  if (type === 'radio') {
    const checked = field.querySelector('input[type=radio]:checked');
    return checked ? checked.value : '';
  }
  if (type === 'checkbox') {
    return [...field.querySelectorAll('input[type=checkbox]:checked')]
      .map(el => el.value)
      .join(', ');
  }
  return '';
}

function buildBrief() {
  const blocks = [];

  form.querySelectorAll('.brief-section').forEach(section => {
    const lines = [];

    section.querySelectorAll('.field').forEach(field => {
      const value = readField(field);
      if (value) lines.push(`${field.dataset.label}: ${value}`);
    });

    if (lines.length) {
      const title = section.querySelector('h2').textContent.toUpperCase();
      blocks.push(`— ${title} —\n${lines.join('\n')}`);
    }
  });

  if (!blocks.length) return '';

  const date = new Date().toLocaleDateString('ru-RU');
  return `БРИФ НА ПРОЕКТ\nЗаполнен: ${date}\n\n${blocks.join('\n\n')}`;
}

/* --- прогресс --- */

const allFields = [...form.querySelectorAll('.field')];
const progressFill = document.getElementById('progress-fill');

function updateProgress() {
  const filled = allFields.filter(field => readField(field)).length;
  progressFill.style.width = Math.round((filled / allFields.length) * 100) + '%';
}

/* --- черновик в localStorage --- */

function saveDraft() {
  const draft = { text: {}, choice: [] };

  form.querySelectorAll('input[type=text], textarea').forEach(el => {
    if (el.value.trim()) draft.text[el.id] = el.value;
  });
  form.querySelectorAll('input[type=radio]:checked, input[type=checkbox]:checked').forEach(el => {
    draft.choice.push([el.name || '', el.value]);
  });

  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch (e) {}
}

function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return; }
  if (!draft) return;

  Object.entries(draft.text || {}).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });

  (draft.choice || []).forEach(([name, value]) => {
    const selector = name
      ? `input[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
      : `input[type=checkbox][value="${CSS.escape(value)}"]`;
    const el = form.querySelector(selector);
    if (el) el.checked = true;
  });
}

restoreDraft();
updateProgress();

form.addEventListener('input', () => { saveDraft(); updateProgress(); });
form.addEventListener('change', () => { saveDraft(); updateProgress(); });

/* --- кнопки --- */

document.getElementById('build-btn').addEventListener('click', () => {
  const text = buildBrief();

  if (!text) {
    output.value = '';
    sendActions.hidden = true;
    showToast('Заполните хотя бы одно поле');
    return;
  }

  output.value = text;
  sendActions.hidden = false;
  output.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function copyText() {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(output.value);
  }
  output.removeAttribute('readonly');
  output.select();
  const ok = document.execCommand('copy');
  output.setAttribute('readonly', '');
  window.getSelection().removeAllRanges();
  return ok ? Promise.resolve() : Promise.reject();
}

document.getElementById('copy-btn').addEventListener('click', () => {
  copyText()
    .then(() => showToast('Бриф скопирован'))
    .catch(() => showToast('Не вышло скопировать — выделите текст вручную'));
});

document.getElementById('send-btn').addEventListener('click', () => {
  copyText()
    .then(() => showToast('Бриф скопирован — вставьте его в чат'))
    .catch(() => showToast('Скопируйте текст вручную и вставьте в чат'));
});

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!confirm('Очистить все ответы? Заполненное будет потеряно.')) return;

  form.reset();
  output.value = '';
  sendActions.hidden = true;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
