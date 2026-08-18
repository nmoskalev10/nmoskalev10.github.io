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
  const price = estimate();
  const priceBlock = price
    ? `\n\n— ПРЕДВАРИТЕЛЬНАЯ ОЦЕНКА —\n${money(price.min)} – ${money(price.max)} ₽\n(посчитано калькулятором на сайте, не окончательная цена)`
    : '';

  return `БРИФ НА ПРОЕКТ\nЗаполнен: ${date}\n\n${blocks.join('\n\n')}${priceBlock}`;
}

/* --- примерная стоимость --- */

const ROUND_TO = 1000;

function money(value) {
  return value.toLocaleString('ru-RU');
}

function parsePrice(raw) {
  const [min, max] = raw.split('-').map(Number);
  return { min, max };
}

function estimate() {
  const base = form.querySelector('input[name="ptype"]:checked');
  if (!base || !base.dataset.price) return null;

  const rows = [];
  let min = 0;
  let max = 0;

  const basePrice = parsePrice(base.dataset.price);
  min += basePrice.min;
  max += basePrice.max;
  rows.push(['Базовая разработка', basePrice]);

  const features = [...form.querySelectorAll('#sec-features input:checked[data-price]')]
    .map(el => parsePrice(el.dataset.price))
    .filter(p => p.max > 0);

  if (features.length) {
    const sum = features.reduce(
      (acc, p) => ({ min: acc.min + p.min, max: acc.max + p.max }),
      { min: 0, max: 0 }
    );
    min += sum.min;
    max += sum.max;
    rows.push([`Функции (${features.length})`, sum]);
  }

  const sectionsField = form.querySelector('[data-price-per-extra]');
  if (sectionsField) {
    const checked = sectionsField.querySelectorAll('input:checked').length;
    const free = Number(sectionsField.dataset.priceFree || 0);
    const extra = Math.max(0, checked - free);

    if (extra > 0) {
      const per = parsePrice(sectionsField.dataset.pricePerExtra);
      const sum = { min: per.min * extra, max: per.max * extra };
      min += sum.min;
      max += sum.max;
      rows.push([`Разделы сверх ${free} (${extra})`, sum]);
    }
  }

  const contentPrices = ['texts', 'media', 'brand', 'hosting']
    .map(name => form.querySelector(`input[name="${name}"]:checked[data-price]`))
    .filter(Boolean)
    .map(el => parsePrice(el.dataset.price));

  if (contentPrices.length) {
    const sum = contentPrices.reduce(
      (acc, p) => ({ min: acc.min + p.min, max: acc.max + p.max }),
      { min: 0, max: 0 }
    );
    min += sum.min;
    max += sum.max;
    rows.push(['Контент, дизайн, настройка', sum]);
  }

  const rush = form.querySelector('input[data-multiplier]:checked');
  let multiplier = 1;

  if (rush) {
    multiplier = Number(rush.dataset.multiplier);
    const add = { min: min * (multiplier - 1), max: max * (multiplier - 1) };
    min += add.min;
    max += add.max;
    rows.push([`Срочность (+${Math.round((multiplier - 1) * 100)}%)`, add]);
  }

  const round = value => Math.round(value / ROUND_TO) * ROUND_TO;
  const budget = form.querySelector('input[name="budget"]:checked');

  return {
    min: round(min),
    max: round(max),
    rows: rows.map(([label, p]) => [label, round(p.min), round(p.max)]),
    budgetMax: budget && budget.dataset.budgetMax ? Number(budget.dataset.budgetMax) : null
  };
}

function renderEstimate() {
  const box = document.getElementById('estimate');
  const price = estimate();

  if (!price) {
    box.hidden = true;
    return;
  }

  document.getElementById('estimate-sum').textContent =
    `${money(price.min)} – ${money(price.max)} ₽`;

  document.getElementById('estimate-rows').innerHTML = price.rows
    .map(([label, min, max]) => {
      const value = min === max ? `${money(min)} ₽` : `${money(min)} – ${money(max)} ₽`;
      return `<li><span>${label}</span><span>${value}</span></li>`;
    })
    .join('');

  let note = 'Это прикидка по средним ценам, а не счёт: точную сумму назову после разговора — часть задач может оказаться проще и дешевле.';

  if (price.budgetMax !== null && price.budgetMax < price.min) {
    note += ` <b>Оценка выше вашего бюджета — напишите всё равно:</b> обычно удаётся собрать урезанную первую версию под нужную сумму и достроить остальное позже.`;
  }

  document.getElementById('estimate-note').innerHTML = note;
  box.hidden = false;
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
    document.getElementById('estimate').hidden = true;
    showToast('Заполните хотя бы одно поле');
    return;
  }

  output.value = text;
  sendActions.hidden = false;
  renderEstimate();

  const estimateBox = document.getElementById('estimate');
  const target = estimateBox.hidden ? output : estimateBox;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
  document.getElementById('estimate').hidden = true;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
