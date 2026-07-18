const app = () => document.getElementById('app');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const showToast = (msg) => {
  let container = document.getElementById('toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toasts'; container.className = 'toasts';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

const api = async (path, opts = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;
  
  const res = await fetch(`/api${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса / Сұрау қатесі');
  return data;
};

// --- I18N ---
let lang = localStorage.getItem('lang') || 'ru';

const setLang = (l) => {
  lang = l;
  localStorage.setItem('lang', l);
  route();
};

const I18N = {
  home_title: { ru: 'Волонтерское движение', kk: 'Еріктілер қозғалысы' },
  home_subtitle: { ru: 'Присоединяйтесь к нашей команде и следите за анонсами.', kk: 'Біздің командаға қосылыңыз және аңдатпаларды оқыңыз.' },
  btn_quiz: { ru: 'Заполнить анкету', kk: 'Сауалнаманы толтыру' },
  btn_feed: { ru: 'Анонсы мероприятий', kk: 'Іс-шаралар аңдатпасы' },
  btn_next: { ru: 'ПРОДОЛЖИТЬ', kk: 'ЖАЛҒАСТЫРУ' },
  placeholder: { ru: 'Ваш ответ...', kk: 'Сіздің жауабыңыз...' },
  err_empty: { ru: 'Пожалуйста, введите ответ', kk: 'Жауапты енгізіңіз' },
  err_choice: { ru: 'Выберите один из вариантов', kk: 'Нұсқалардың бірін таңдаңыз' },
  sending: { ru: 'Отправка анкеты...', kk: 'Сауалнама жіберілуде...' },
  success_title: { ru: 'Поздравляем!', kk: 'Құттықтаймыз!' },
  success_text: { ru: 'Ваша анкета успешно отправлена. Мы скоро свяжемся с вами в Telegram.', kk: 'Сауалнама сәтті жіберілді. Біз сізбен Telegram арқылы хабарласамыз.' },
  btn_home: { ru: 'На главную', kk: 'Басты бетке' },
  err_send: { ru: 'Ошибка отправки', kk: 'Жіберу қатесі' },
  btn_retry: { ru: 'Попробовать снова', kk: 'Қайта көру' },
  feed_back: { ru: '← Назад', kk: '← Артқа' },
  feed_title: { ru: 'Анонсы', kk: 'Аңдатпалар' },
  feed_header: { ru: 'Ближайшие мероприятия', kk: 'Алдағы іс-шаралар' },
  feed_empty: { ru: 'Пока нет доступных анонсов.', kk: 'Әзірге қолжетімді аңдатпалар жоқ.' },
  location: { ru: 'Не указано', kk: 'Көрсетілмеген' }
};

const t = (key) => I18N[key]?.[lang] || key;

// --- QUESTIONS ---
const QUESTIONS = [
  { id: 'q1', type: 'text', text: { ru: 'Как к вам обращаться?', kk: 'Сізге қалай жүгінейік?' } },
  { id: 'q2', type: 'text', text: { ru: 'Сколько вам лет?', kk: 'Жасыңыз нешеде?' } },
  { id: 'q_city', type: 'text', text: { ru: 'Из какого вы города?', kk: 'Қай қаладансыз?' } },
  { 
    id: 'q_exp', 
    type: 'choice', 
    text: { ru: 'Был ли у вас опыт волонтерства ранее?', kk: 'Бұрын ерікті болдыңыз ба?' }, 
    options: { ru: ['Да', 'Нет'], kk: ['Иә', 'Жоқ'] } 
  },
  { 
    id: 'q_exp_desc', 
    condition: (ans) => ans['q_exp'] === 'Да' || ans['q_exp'] === 'Иә',
    type: 'text', 
    text: { ru: 'Расскажите кратко о вашем опыте', kk: 'Тәжірибеңіз туралы қысқаша айтып беріңіз' } 
  },
  { 
    id: 'q_freq', 
    type: 'choice', 
    text: { ru: 'Как часто вы можете помогать?', kk: 'Қаншалықты жиі көмектесе аласыз?' }, 
    options: { ru: ['Каждую неделю', 'Раз в месяц', 'По возможности'], kk: ['Апта сайын', 'Айына бір рет', 'Мүмкіндігінше'] } 
  },
  { 
    id: 'q_dir', 
    type: 'choice', 
    text: { ru: 'Какое направление вам ближе?', kk: 'Қай бағыт сізге жақын?' }, 
    options: { ru: ['Медиа (фото, видео, соцсети)', 'Организация ивентов', 'Физическая помощь'], kk: ['Медиа (фото, видео, СЖ)', 'Іс-шараларды ұйымдастыру', 'Физикалық көмек'] } 
  },
  { 
    id: 'q_dir_media', 
    condition: (ans) => (ans['q_dir'] || '').includes('Медиа'),
    type: 'choice', 
    text: { ru: 'Умеете ли вы монтировать видео?', kk: 'Видео монтаждай аласыз ба?' }, 
    options: { ru: ['Да', 'Нет'], kk: ['Иә', 'Жоқ'] } 
  },
  { 
    id: 'q_dir_org', 
    condition: (ans) => (ans['q_dir'] || '').includes('Организация') || (ans['q_dir'] || '').includes('ұйымдастыру'),
    type: 'choice', 
    text: { ru: 'Легко ли вы находите общий язык с незнакомцами?', kk: 'Бейтаныс адамдармен тез тіл табысасыз ба?' }, 
    options: { ru: ['Да', 'Зависит от ситуации', 'Нет'], kk: ['Иә', 'Жағдайға байланысты', 'Жоқ'] } 
  },
  { 
    id: 'q_dir_phys', 
    condition: (ans) => (ans['q_dir'] || '').includes('Физическая') || (ans['q_dir'] || '').includes('Физикалық'),
    type: 'choice', 
    text: { ru: 'Готовы ли вы переносить тяжести (коробки, стулья)?', kk: 'Ауыр заттарды тасуға дайынсыз ба (қораптар, орындықтар)?' }, 
    options: { ru: ['Да', 'Нет'], kk: ['Иә', 'Жоқ'] } 
  },
  { id: 'q_tg', type: 'text', text: { ru: 'Укажите ваш Telegram (@username) для связи', kk: 'Байланыс үшін Telegram (@username) көрсетіңіз' } }
];

let quizState = { step: 0, answers: {} };

function getNextStep(currentStep) {
  let next = currentStep + 1;
  while (next < QUESTIONS.length) {
    const q = QUESTIONS[next];
    if (!q.condition || q.condition(quizState.answers)) {
      return next;
    }
    next++;
  }
  return next;
}

// --- ROUTING ---
window.addEventListener('hashchange', route);
function route() {
  const hash = window.location.hash || '#home';
  if (hash === '#home') renderHome();
  else if (hash === '#feed') renderFeed();
  else if (hash === '#quiz') {
    // If starting fresh, make sure we skip conditionally blocked questions on step 0
    if (quizState.step === 0 && QUESTIONS[0].condition && !QUESTIONS[0].condition(quizState.answers)) {
      quizState.step = getNextStep(-1);
    }
    renderQuiz();
  }
  else if (hash === '#admin') renderAdmin();
}

// --- HOME ---
function renderHome() {
  app().innerHTML = `
    <div class="home-container">
      <button class="admin-circle" id="btn-admin" title="Admin"></button>
      
      <div style="position: absolute; top: 20px; right: 20px;">
        <button class="btn-outline" style="padding: 4px 12px; margin: 0; font-size: 14px; border-radius: 20px;" onclick="setLang(lang === 'ru' ? 'kk' : 'ru')">
          ${lang === 'ru' ? 'ҚАЗ' : 'РУС'}
        </button>
      </div>

      <div class="home-logo">🌟</div>
      <h1>${t('home_title')}</h1>
      <p style="margin-bottom: 40px; color: var(--text-muted);">${t('home_subtitle')}</p>
      
      <a href="#quiz" class="btn">${t('btn_quiz')}</a>
      <a href="#feed" class="btn btn-secondary">${t('btn_feed')}</a>
    </div>
  `;

  document.getElementById('btn-admin').onclick = async () => {
    const pwd = prompt('Пароль администратора / Әкімші құпия сөзі:');
    if (!pwd) return;
    try {
      const res = await api('/auth/login', {
        method: 'POST', body: JSON.stringify({ contact: 'admin', password: pwd })
      });
      localStorage.setItem('token', res.token);
      window.location.hash = '#admin';
    } catch (e) {
      alert('Ошибка / Қате');
    }
  };
}

// --- QUIZ ---
function renderQuiz() {
  const q = QUESTIONS[quizState.step];
  if (!q) return renderQuizFinished();

  const progress = (quizState.step / QUESTIONS.length) * 100;
  const val = quizState.answers[q.id] || '';
  const qText = q.text[lang];

  let inputHtml = '';
  if (q.type === 'choice') {
    inputHtml = `<div class="quiz-options">
      ${q.options[lang].map(o => `
        <button class="quiz-option ${val === o ? 'selected' : ''}" data-val="${esc(o)}">
          ${esc(o)}
        </button>
      `).join('')}
    </div>`;
  } else {
    inputHtml = `<input type="text" id="q-input" class="quiz-input" placeholder="${t('placeholder')}" value="${esc(val)}" />`;
  }

  app().innerHTML = `
    <div class="layout">
      <div class="progress-container">
        <button class="btn-close" onclick="window.location.hash='#home'">×</button>
        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
      </div>
      
      <div class="quiz-content">
        <div class="quiz-question">${esc(qText)}</div>
        ${inputHtml}
      </div>

      <div class="quiz-footer">
        <button class="btn" id="btn-next">${t('btn_next')}</button>
      </div>
    </div>
  `;

  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-option').forEach(btn => {
      btn.onclick = () => {
        quizState.answers[q.id] = btn.getAttribute('data-val');
        renderQuiz(); 
      };
    });
  }

  document.getElementById('btn-next').onclick = () => {
    if (q.type !== 'choice') {
      const input = document.getElementById('q-input');
      if (input.value.trim() === '') return showToast(t('err_empty'));
      quizState.answers[q.id] = input.value.trim();
    } else {
      if (!quizState.answers[q.id]) return showToast(t('err_choice'));
    }
    
    quizState.step = getNextStep(quizState.step);
    renderQuiz();
  };
}

async function renderQuizFinished() {
  app().innerHTML = `
    <div class="home-container">
      <h1>${t('sending')}</h1>
      <div class="progress-bar" style="width: 200px; margin: 20px auto;"><div class="progress-fill" style="width: 100%"></div></div>
    </div>
  `;

  try {
    const tgUsername = quizState.answers['q_tg'] || 'unknown';
    await api('/public/questionnaires', {
      method: 'POST',
      body: JSON.stringify({ tg_username: tgUsername, answers: quizState.answers })
    });
    
    app().innerHTML = `
      <div class="home-container">
        <div class="home-logo">🎉</div>
        <h1>${t('success_title')}</h1>
        <p style="margin-bottom: 40px; color: var(--text-muted);">${t('success_text')}</p>
        <a href="#home" class="btn">${t('btn_home')}</a>
      </div>
    `;
    quizState = { step: 0, answers: {} };
  } catch (e) {
    app().innerHTML = `
      <div class="home-container">
        <h1>${t('err_send')}</h1>
        <p>${esc(e.message)}</p>
        <button class="btn" onclick="renderQuizFinished()">${t('btn_retry')}</button>
        <a href="#home" class="btn btn-outline" style="margin-top: 10px">${t('btn_home')}</a>
      </div>
    `;
  }
}

// --- FEED ---
async function renderFeed() {
  app().innerHTML = `
    <div class="layout">
      <div class="top-nav">
        <a href="#home">${t('feed_back')}</a>
        <a href="#feed" class="active">${t('feed_title')}</a>
      </div>
      <h2>${t('feed_header')}</h2>
      <div id="feed-content">Загрузка / Жүктелуде...</div>
    </div>
  `;
  try {
    const { items } = await api('/public/events');
    const container = document.getElementById('feed-content');
    if (!items.length) {
      container.innerHTML = `<div class="card">${t('feed_empty')}</div>`;
      return;
    }
    container.innerHTML = items.map(e => `
      <div class="card">
        ${e.banner_url ? `<img src="${esc(e.banner_url)}" class="event-banner" alt="Banner">` : ''}
        <div class="meta">📍 ${esc(e.location || t('location'))} | 🕒 ${new Date(e.starts_at).toLocaleString(lang === 'ru' ? 'ru' : 'kk')}</div>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.description || '')}</p>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('feed-content').innerHTML = `Ошибка: ${esc(e.message)}`;
  }
}

// --- ADMIN ---
async function renderAdmin() {
  if (!localStorage.getItem('token')) return window.location.hash = '#home';

  app().innerHTML = `
    <div class="layout">
      <div class="top-nav">
        <a href="#home">← На главную</a>
        <button class="btn-outline" style="padding: 4px 12px; margin:0;" onclick="localStorage.removeItem('token'); window.location.hash='#home'">Выйти</button>
      </div>
      <h2>Панель управления</h2>
      
      <div class="card">
        <h3>Новый анонс</h3>
        <input type="text" id="ev-title" class="quiz-input" style="margin-bottom:10px" placeholder="Название (обязательно)" />
        <textarea id="ev-desc" class="quiz-input quiz-textarea" style="margin-bottom:10px" placeholder="Описание"></textarea>
        <input type="text" id="ev-loc" class="quiz-input" style="margin-bottom:10px" placeholder="Место" />
        <input type="datetime-local" class="quiz-input" style="margin-bottom:10px" id="ev-date" />
        <div style="margin-bottom:10px">
          <label style="font-size:14px; color:var(--text-muted)">Баннер (картинка)</label><br>
          <input type="file" id="ev-img" accept="image/*" />
        </div>
        <button class="btn" id="btn-create">Опубликовать</button>
      </div>

      <h2>Все Анкеты Волонтеров</h2>
      <div id="admin-qs">Загрузка...</div>
    </div>
  `;

  document.getElementById('btn-create').onclick = async () => {
    const file = document.getElementById('ev-img').files[0];
    let base64 = null;
    if (file) {
      base64 = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.readAsDataURL(file);
      });
    }
    try {
      await api('/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          title: document.getElementById('ev-title').value,
          description: document.getElementById('ev-desc').value,
          location: document.getElementById('ev-loc').value,
          starts_at: document.getElementById('ev-date').value,
          banner_base64: base64
        })
      });
      showToast('Анонс опубликован');
      renderAdmin();
    } catch(e) {
      showToast(e.message);
    }
  };

  try {
    const { items } = await api('/admin/questionnaires');
    document.getElementById('admin-qs').innerHTML = items.length ? items.map(q => `
      <div class="card">
        <div class="meta">Отправлена: ${new Date(q.created_at).toLocaleString('ru')}</div>
        <h3>@${esc(q.tg_username)}</h3>
        <ul style="padding-left: 20px; color: var(--text-main)">
          ${Object.entries(q.answers).map(([key, val]) => {
            const qtext = QUESTIONS.find(x => x.id === key)?.text?.ru || key;
            return `<li><strong>${esc(qtext)}:</strong> ${esc(val)}</li>`;
          }).join('')}
        </ul>
      </div>
    `).join('') : '<p>Пока нет анкет.</p>';
  } catch (e) {
    document.getElementById('admin-qs').innerHTML = `Ошибка: ${esc(e.message)}`;
  }
}

route();
