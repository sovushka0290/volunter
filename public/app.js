const app = () => document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const showToast = (msg) => {
  let c = document.getElementById('toasts');
  if (!c) { c = document.createElement('div'); c.id = 'toasts'; c.className = 'toasts'; document.body.appendChild(c); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};

const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
};

// --- I18N ---
let lang = localStorage.getItem('lang') || 'ru';
window.setLang = (l) => { lang = l; localStorage.setItem('lang', l); route(); };

const I18N = {
  home_title: { ru: 'Волонтёрское движение', kk: 'Еріктілер қозғалысы' },
  home_sub: { ru: 'Присоединяйтесь к нашей команде!', kk: 'Біздің командаға қосылыңыз!' },
  btn_quiz: { ru: 'Заполнить анкету', kk: 'Сауалнаманы толтыру' },
  btn_feed: { ru: 'Анонсы', kk: 'Аңдатпалар' },
  btn_next: { ru: 'ПРОДОЛЖИТЬ', kk: 'ЖАЛҒАСТЫРУ' },
  placeholder: { ru: 'Ваш ответ...', kk: 'Сіздің жауабыңыз...' },
  err_empty: { ru: 'Введите ответ', kk: 'Жауапты енгізіңіз' },
  err_choice: { ru: 'Выберите вариант', kk: 'Нұсқаны таңдаңыз' },
  sending: { ru: 'Отправляем...', kk: 'Жіберілуде...' },
  done_title: { ru: 'Готово!', kk: 'Дайын!' },
  done_text: { ru: 'Анкета отправлена. Мы свяжемся с вами в Telegram.', kk: 'Сауалнама жіберілді. Telegram арқылы хабарласамыз.' },
  btn_home: { ru: 'На главную', kk: 'Басты бетке' },
  err_send: { ru: 'Ошибка', kk: 'Қате' },
  btn_retry: { ru: 'Повторить', kk: 'Қайталау' },
  feed_empty: { ru: 'Анонсов пока нет', kk: 'Аңдатпалар жоқ' },
  loc_none: { ru: 'Не указано', kk: 'Көрсетілмеген' }
};
const t = (k) => I18N[k]?.[lang] || k;

// --- QUESTIONS ---
const QUESTIONS = [
  { id: 'q1', type: 'text', text: { ru: 'Как к вам обращаться?', kk: 'Сізге қалай жүгінейік?' } },
  { id: 'q2', type: 'text', text: { ru: 'Сколько вам лет?', kk: 'Жасыңыз нешеде?' } },
  { id: 'q_city', type: 'text', text: { ru: 'Из какого вы города?', kk: 'Қай қаладансыз?' } },
  { id: 'q_exp', type: 'choice', text: { ru: 'Был ли у вас опыт волонтёрства?', kk: 'Бұрын ерікті болдыңыз ба?' }, options: { ru: ['Да', 'Нет'], kk: ['Иә', 'Жоқ'] } },
  { id: 'q_exp_desc', condition: (a) => a.q_exp === 'Да' || a.q_exp === 'Иә', type: 'text', text: { ru: 'Расскажите кратко о вашем опыте', kk: 'Тәжірибеңіз туралы қысқаша айтыңыз' } },
  { id: 'q_freq', type: 'choice', text: { ru: 'Как часто вы можете помогать?', kk: 'Қаншалықты жиі көмектесе аласыз?' }, options: { ru: ['Каждую неделю', 'Раз в месяц', 'По возможности'], kk: ['Апта сайын', 'Айына бір рет', 'Мүмкіндігінше'] } },
  { id: 'q_dir', type: 'choice', text: { ru: 'Какое направление вам ближе?', kk: 'Қай бағыт сізге жақын?' }, options: { ru: ['Медиа (фото, видео, соцсети)', 'Организация ивентов', 'Физическая помощь'], kk: ['Медиа (фото, видео, СЖ)', 'Іс-шараларды ұйымдастыру', 'Физикалық көмек'] } },
  { id: 'q_media', condition: (a) => (a.q_dir||'').includes('Медиа'), type: 'choice', text: { ru: 'Умеете монтировать видео?', kk: 'Видео монтаждай аласыз ба?' }, options: { ru: ['Да', 'Нет'], kk: ['Иә', 'Жоқ'] } },
  { id: 'q_org', condition: (a) => (a.q_dir||'').includes('Организация') || (a.q_dir||'').includes('ұйымдастыру'), type: 'choice', text: { ru: 'Легко находите язык с незнакомцами?', kk: 'Бейтаныстармен тез тіл табысасыз ба?' }, options: { ru: ['Да', 'Зависит от ситуации', 'Нет'], kk: ['Иә', 'Жағдайға байланысты', 'Жоқ'] } },
  { id: 'q_phys', condition: (a) => (a.q_dir||'').includes('Физическая') || (a.q_dir||'').includes('Физикалық'), type: 'choice', text: { ru: 'Готовы переносить тяжести?', kk: 'Ауыр заттарды тасуға дайынсыз ба?' }, options: { ru: ['Да', 'Нет'], kk: ['Иә', 'Жоқ'] } },
  { id: 'q_wa', type: 'text', text: { ru: 'Ваш номер WhatsApp', kk: 'WhatsApp нөміріңіз' } }
];

let quizState = { step: 0, answers: {} };

function getNextStep(cur) {
  let n = cur + 1;
  while (n < QUESTIONS.length) {
    const q = QUESTIONS[n];
    if (!q.condition || q.condition(quizState.answers)) return n;
    n++;
  }
  return n;
}

// --- ROUTING ---
window.adminTab = 'dashboard';
window.viewingQuestionnaire = null;

window.addEventListener('hashchange', route);
function route() {
  const h = window.location.hash || '#home';
  if (h === '#home') renderHome();
  else if (h === '#feed') renderFeed();
  else if (h === '#quiz') { if (quizState.step === 0) quizState = { step: 0, answers: {} }; renderQuiz(); }
  else if (h === '#admin') window.renderAdmin();
}

// --- HOME ---
function renderHome() {
  app().innerHTML = `
    <div class="home-container">
      <button class="admin-circle" id="btn-admin" title="Admin">⚙</button>
      <div style="position:absolute;top:20px;right:20px">
        <button class="btn-outline btn-small" onclick="setLang(lang==='ru'?'kk':'ru')">${lang==='ru'?'ҚАЗ':'РУС'}</button>
      </div>
      <div class="home-logo">✨</div>
      <h1>${t('home_title')}</h1>
      <p style="margin-bottom:36px;color:var(--text-muted)">${t('home_sub')}</p>
      <a href="#quiz" class="btn">${t('btn_quiz')}</a>
      <a href="#feed" class="btn btn-secondary">${t('btn_feed')}</a>
    </div>`;
  document.getElementById('btn-admin').onclick = async () => {
    const pwd = prompt('Пароль:');
    if (!pwd) return;
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ contact: 'admin', password: pwd }) });
      localStorage.setItem('token', r.token);
      adminTab = 'dashboard'; viewingQuestionnaire = null;
      window.location.hash = '#admin';
    } catch { alert('Неверный пароль'); }
  };
}

// --- QUIZ ---
function renderQuiz() {
  const q = QUESTIONS[quizState.step];
  if (!q) return renderQuizDone();
  const pct = (quizState.step / QUESTIONS.length) * 100;
  const val = quizState.answers[q.id] || '';
  const qText = q.text[lang];
  let inp = '';
  if (q.type === 'choice') {
    inp = `<div class="quiz-options">${q.options[lang].map(o => `<button class="quiz-option ${val===o?'selected':''}" data-val="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
  } else {
    inp = `<input type="text" id="q-input" class="quiz-input" placeholder="${t('placeholder')}" value="${esc(val)}" />`;
  }
  app().innerHTML = `
    <div class="layout">
      <div class="progress-container">
        <button class="btn-close" onclick="window.location.hash='#home'">✕</button>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="quiz-content"><div class="quiz-question">${esc(qText)}</div>${inp}</div>
      <div class="quiz-footer"><button class="btn" id="btn-next">${t('btn_next')}</button></div>
    </div>`;
  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-option').forEach(b => { b.onclick = () => { quizState.answers[q.id] = b.getAttribute('data-val'); renderQuiz(); }; });
  }
  document.getElementById('btn-next').onclick = () => {
    if (q.type !== 'choice') { const i = document.getElementById('q-input'); if (!i.value.trim()) return showToast(t('err_empty')); quizState.answers[q.id] = i.value.trim(); }
    else { if (!quizState.answers[q.id]) return showToast(t('err_choice')); }
    quizState.step = getNextStep(quizState.step);
    renderQuiz();
  };
}

async function renderQuizDone() {
  app().innerHTML = `<div class="home-container"><div class="home-logo">⏳</div><h1>${t('sending')}</h1></div>`;
  try {
    await api('/public/questionnaires', { method: 'POST', body: JSON.stringify({ tg_username: quizState.answers.q_wa || '?', answers: quizState.answers }) });
    app().innerHTML = `<div class="home-container"><div class="home-logo">🎉</div><h1>${t('done_title')}</h1><p style="margin-bottom:32px;color:var(--text-muted)">${t('done_text')}</p><a href="#home" class="btn">${t('btn_home')}</a></div>`;
    quizState = { step: 0, answers: {} };
  } catch (e) {
    app().innerHTML = `<div class="home-container"><h1>${t('err_send')}</h1><p>${esc(e.message)}</p><button class="btn" onclick="renderQuizDone()">${t('btn_retry')}</button><a href="#home" class="btn btn-outline" style="margin-top:8px">${t('btn_home')}</a></div>`;
  }
}

// --- FEED ---
async function renderFeed() {
  app().innerHTML = `<div class="layout"><div class="top-nav"><a href="#home">← Назад</a></div><h2>${lang==='ru'?'Анонсы':'Аңдатпалар'}</h2><div id="fc">Загрузка...</div></div>`;
  try {
    const { items } = await api('/public/events');
    const c = document.getElementById('fc');
    if (!items.length) { c.innerHTML = `<div class="card">${t('feed_empty')}</div>`; return; }
    c.innerHTML = items.map(e => {
      const theme = window.EVENT_THEMES[e.theme_id || 0] || window.EVENT_THEMES[0];
      const iconId = e.emoji || 'party';
      const iconObj = window.EVENT_ICONS.find(x => x.id === iconId);
      const renderEmoji = iconObj 
        ? `<div style="width:48px;height:48px;margin:0 auto 8px">${iconObj.svg}</div>`
        : `<div style="font-size:48px;margin-bottom:8px">${esc(iconId)}</div>`; // fallback for old text emojis
        
      return `
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="background:${theme.bg};color:${theme.text};padding:24px;text-align:center;">
            ${renderEmoji}
            <div style="font-size:24px;font-weight:800">${esc(e.title)}</div>
          </div>
          <div style="padding:20px;">
            <div class="meta" style="margin-bottom:12px">📍 ${esc(e.location||t('loc_none'))} · 🕒 ${new Date(e.starts_at).toLocaleDateString(lang==='ru'?'ru':'kk')} ${new Date(e.starts_at).toLocaleTimeString(lang==='ru'?'ru':'kk', {hour: '2-digit', minute:'2-digit'})}</div>
            <p style="color:var(--text);margin:0">${esc(e.description||'')}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) { document.getElementById('fc').innerHTML = `Ошибка: ${esc(e.message)}`; }
}

// --- ADMIN ---
window.renderAdmin = async function renderAdmin() {
  if (!localStorage.getItem('token')) return window.location.hash = '#home';

  // If viewing a single questionnaire
  if (window.viewingQuestionnaire !== null) return renderQuestionnaireDetail(window.viewingQuestionnaire);

  app().innerHTML = `
    <div class="layout">
      <div class="top-nav">
        <a href="#" onclick="localStorage.removeItem('token');window.location.hash='#home';return false">← Выйти</a>
        <span style="font-weight:700;color:var(--accent)">Админ</span>
      </div>
      <div class="tabs">
        <button class="tab ${window.adminTab==='dashboard'?'active':''}" onclick="window.adminTab='dashboard';window.renderAdmin()">📊 Дашборд</button>
        <button class="tab ${window.adminTab==='list'?'active':''}" onclick="window.adminTab='list';window.renderAdmin()">📋 Анкеты</button>
        <button class="tab ${window.adminTab==='events'?'active':''}" onclick="window.adminTab='events';window.renderAdmin()">📢 Анонсы</button>
      </div>
      <div id="admin-content">Загрузка...</div>
    </div>`;

  try {
    const { items } = await api('/admin/questionnaires');
    const container = document.getElementById('admin-content');

    if (window.adminTab === 'dashboard') renderDashboard(container, items);
    else if (window.adminTab === 'list') renderQList(container, items);
    else renderEventsTab(container);
  } catch (e) {
    document.getElementById('admin-content').innerHTML = `<div class="card"><p>Ошибка: ${esc(e.message)}</p></div>`;
  }
}

function renderDashboard(el, items) {
  const total = items.length;
  const today = items.filter(q => { const d = new Date(q.created_at); const now = new Date(); return d.toDateString() === now.toDateString(); }).length;
  
  // Count directions
  const dirs = {};
  const freqs = {};
  const cities = {};
  items.forEach(q => {
    const a = q.answers || {};
    if (a.q_dir) dirs[a.q_dir] = (dirs[a.q_dir]||0)+1;
    if (a.q_freq) freqs[a.q_freq] = (freqs[a.q_freq]||0)+1;
    if (a.q_city) { const c = a.q_city.trim(); cities[c] = (cities[c]||0)+1; }
  });

  const maxDir = Math.max(...Object.values(dirs), 1);
  const maxFreq = Math.max(...Object.values(freqs), 1);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Всего анкет</div></div>
      <div class="stat-card"><div class="stat-number">${today}</div><div class="stat-label">Сегодня</div></div>
      <div class="stat-card"><div class="stat-number">${Object.keys(cities).length}</div><div class="stat-label">Городов</div></div>
      <div class="stat-card"><div class="stat-number">${items.filter(q=>(q.answers||{}).q_exp==='Да'||(q.answers||{}).q_exp==='Иә').length}</div><div class="stat-label">С опытом</div></div>
    </div>

    ${Object.keys(dirs).length ? `
    <div class="card">
      <h3 style="margin-bottom:16px">Направления</h3>
      ${Object.entries(dirs).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
        <div class="chart-bar-row">
          <div class="chart-label">${esc(k.replace(/\(.*\)/,'').trim())}</div>
          <div class="chart-track"><div class="chart-fill" style="width:${(v/maxDir*100)}%"></div></div>
          <div class="chart-value">${v}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${Object.keys(freqs).length ? `
    <div class="card">
      <h3 style="margin-bottom:16px">Частота участия</h3>
      ${Object.entries(freqs).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
        <div class="chart-bar-row">
          <div class="chart-label">${esc(k)}</div>
          <div class="chart-track"><div class="chart-fill" style="width:${(v/maxFreq*100)}%"></div></div>
          <div class="chart-value">${v}</div>
        </div>
      `).join('')}
    </div>` : ''}

    ${Object.keys(cities).length ? `
    <div class="card">
      <h3 style="margin-bottom:12px">Города</h3>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${Object.entries(cities).sort((a,b)=>b[1]-a[1]).map(([c,n]) => `<span style="background:var(--bg);padding:6px 12px;border-radius:20px;font-size:13px;font-weight:600">${esc(c)} <span style="color:var(--accent)">${n}</span></span>`).join('')}
      </div>
    </div>` : ''}
  `;
}

function renderQList(el, items) {
  if (!items.length) { el.innerHTML = '<div class="card"><p>Анкет пока нет.</p></div>'; return; }
  el.innerHTML = items.map((q, i) => `
    <div class="card card-clickable" onclick="window.viewingQuestionnaire=${i};window.renderAdmin()" style="animation-delay:${i*0.05}s">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:800;font-size:17px">@${esc(q.tg_username)}</div>
          <div class="meta">${new Date(q.created_at).toLocaleString('ru')}${(q.answers||{}).q_city ? ' · '+esc(q.answers.q_city) : ''}</div>
        </div>
        <div style="color:var(--accent);font-size:20px">→</div>
      </div>
    </div>
  `).join('');
  
  // Store items globally for detail view
  window._adminItems = items;
}

function renderQuestionnaireDetail(idx) {
  const items = window._adminItems;
  if (!items || !items[idx]) { window.viewingQuestionnaire = null; window.renderAdmin(); return; }
  const q = items[idx];
  const a = q.answers || {};

  app().innerHTML = `
    <div class="layout">
      <div class="top-nav">
        <a href="#" onclick="window.viewingQuestionnaire=null;window.renderAdmin();return false">← Назад к списку</a>
      </div>
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:48px;height:48px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px">${esc((q.tg_username||'?')[0].toUpperCase())}</div>
          <div>
            <div style="font-weight:800;font-size:18px">@${esc(q.tg_username)}</div>
            <div class="meta">${new Date(q.created_at).toLocaleString('ru')}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <h3 style="margin-bottom:8px">Ответы</h3>
        ${Object.entries(a).map(([key, val]) => {
          const qObj = QUESTIONS.find(x => x.id === key);
          const label = qObj ? (qObj.text.ru || key) : key;
          return `<div class="answer-row"><div class="answer-question">${esc(label)}</div><div class="answer-value">${esc(val)}</div></div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${idx > 0 ? `<button class="btn btn-outline btn-small" onclick="window.viewingQuestionnaire=${idx-1};window.renderAdmin()">← Пред.</button>` : ''}
        ${idx < items.length - 1 ? `<button class="btn btn-small" onclick="window.viewingQuestionnaire=${idx+1};window.renderAdmin()">След. →</button>` : ''}
      </div>
    </div>`;
}

// --- Event card themes ---
window.EVENT_THEMES = [
  { id: 'purple', bg: 'linear-gradient(135deg, #667eea, #764ba2)', text: '#fff' },
  { id: 'ocean', bg: 'linear-gradient(135deg, #43e97b, #38f9d7)', text: '#1a3a2a' },
  { id: 'sunset', bg: 'linear-gradient(135deg, #f093fb, #f5576c)', text: '#fff' },
  { id: 'sky', bg: 'linear-gradient(135deg, #4facfe, #00f2fe)', text: '#fff' },
  { id: 'warm', bg: 'linear-gradient(135deg, #fa709a, #fee140)', text: '#4a2020' },
  { id: 'dark', bg: 'linear-gradient(135deg, #2d3436, #636e72)', text: '#fff' },
  { id: 'mint', bg: 'linear-gradient(135deg, #a8edea, #fed6e3)', text: '#3d4f5f' },
  { id: 'fire', bg: 'linear-gradient(135deg, #f7971e, #ffd200)', text: '#5a3800' }
];

window.EVENT_ICONS = [
  { id: 'party', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.39-1.87.15-2.15 1.07v0a1.96 1.96 0 0 1-2.52 1.36l-1.3-.54c-.86-.35-1.8.2-1.92 1.15l-.05.45"/><path d="m11 2-.33.82c-.39.86.15 1.87 1.07 2.15v0c.93.28 1.48 1.25 1.25 2.18l-.45 1.83c-.24.96.48 1.88 1.46 1.96l.52.05"/><path d="M11.46 8.54 5.27 14.73a2.86 2.86 0 0 0 0 4l2 2a2.86 2.86 0 0 0 4 0l6.19-6.19"/></svg>' },
  { id: 'star', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { id: 'heart', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
  { id: 'zap', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { id: 'flame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>' },
  { id: 'target', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>' },
  { id: 'users', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'trophy', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>' }
];

window._evTheme = 0;
window._evEmoji = 'party';

window.pickTheme = (i) => { window._evTheme = i; updateEventPreview(); };
window.pickEmoji = (e) => { window._evEmoji = e; updateEventPreview(); };

function updateEventPreview() {
  const title = document.getElementById('ev-title')?.value || 'Название';
  const desc = document.getElementById('ev-desc')?.value || '';
  const loc = document.getElementById('ev-loc')?.value || '';
  const theme = window.EVENT_THEMES[window._evTheme];
  const preview = document.getElementById('ev-preview');
  if (!preview) return;
  const iconObj = window.EVENT_ICONS.find(x => x.id === window._evEmoji) || window.EVENT_ICONS[0];
  preview.innerHTML = `
    <div style="background:${theme.bg};color:${theme.text};border-radius:var(--radius);padding:28px 24px;text-align:center;transition:all 0.3s">
      <div style="width:48px;height:48px;margin:0 auto 12px">${iconObj.svg}</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:8px">${esc(title)}</div>
      ${desc ? `<div style="font-size:14px;opacity:0.85;margin-bottom:8px">${esc(desc)}</div>` : ''}
      ${loc ? `<div style="font-size:13px;opacity:0.7">📍 ${esc(loc)}</div>` : ''}
    </div>`;
}

async function renderEventsTab(el) {
  const theme = window.EVENT_THEMES[window._evTheme];
  const iconObj = window.EVENT_ICONS.find(x => x.id === window._evEmoji) || window.EVENT_ICONS[0];
  el.innerHTML = `
    <div class="card">
      <h3>Создать анонс</h3>

      <div id="ev-preview" style="margin-bottom:16px">
        <div style="background:${theme.bg};color:${theme.text};border-radius:var(--radius);padding:28px 24px;text-align:center">
          <div style="width:48px;height:48px;margin:0 auto 12px">${iconObj.svg}</div>
          <div style="font-size:22px;font-weight:800">Так будет выглядеть</div>
        </div>
      </div>

      <label class="meta">Векторная иконка</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        ${window.EVENT_ICONS.map(i => `<button onclick="pickEmoji('${i.id}')" style="width:48px;height:48px;padding:10px;border-radius:10px;border:2px solid ${window._evEmoji===i.id?'var(--accent)':'var(--border)'};background:${window._evEmoji===i.id?'#ede9fe':'var(--bg-card)'};color:var(--text);cursor:pointer;transition:all 0.2s">${i.svg}</button>`).join('')}
      </div>

      <label class="meta">Цвет фона</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        ${window.EVENT_THEMES.map((t, i) => `<button onclick="pickTheme(${i})" style="width:36px;height:36px;border-radius:50%;background:${t.bg};border:3px solid ${window._evTheme===i?'var(--accent)':'transparent'};cursor:pointer;transition:all 0.2s;box-shadow:${window._evTheme===i?'0 0 0 2px var(--accent)':'none'}"></button>`).join('')}
      </div>

      <input type="text" id="ev-title" class="quiz-input" style="margin-bottom:10px" placeholder="Название ивента" oninput="updateEventPreview()" />
      <textarea id="ev-desc" class="quiz-input quiz-textarea" style="margin-bottom:10px;min-height:80px" placeholder="Описание" oninput="updateEventPreview()"></textarea>
      <input type="text" id="ev-loc" class="quiz-input" style="margin-bottom:10px" placeholder="📍 Место проведения" oninput="updateEventPreview()" />
      <input type="datetime-local" class="quiz-input" style="margin-bottom:14px" id="ev-date" />
      <button class="btn" id="btn-create">Опубликовать 🚀</button>
    </div>`;

  // Expose updateEventPreview to window
  window.updateEventPreview = updateEventPreview;

  document.getElementById('btn-create').onclick = async () => {
    const title = document.getElementById('ev-title').value;
    if (!title) return showToast('Введите название');
    try {
      await api('/admin/events', { method: 'POST', body: JSON.stringify({
        title,
        description: document.getElementById('ev-desc').value,
        location: document.getElementById('ev-loc').value,
        starts_at: document.getElementById('ev-date').value || new Date().toISOString(),
        emoji: window._evEmoji,
        theme_id: window._evTheme
      }) });
      showToast('Опубликовано! 🎉');
      window._evTheme = 0; window._evEmoji = 'party';
      window.renderAdmin();
    } catch (e) { showToast(e.message); }
  };
}

route();

