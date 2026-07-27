const app = () => document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// --- CELEBRATION PARTICLES ---
const PARTICLES = {
  shapes: ['✦', '◆', '●', '▲', '★', '♦', '◉', '⬟', '❋', '✺'],
  colors: ['#0ea5e9', '#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#22d3ee'],
  
  // Burst confetti from answer selection
  burst(x, y, count = 18) {
    const container = document.getElementById('particles') || this._createContainer();
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const shape = this.shapes[Math.floor(Math.random() * this.shapes.length)];
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const velocity = 60 + Math.random() * 120;
      const dx = Math.cos(angle) * velocity;
      const dy = Math.sin(angle) * velocity;
      const size = 10 + Math.random() * 16;
      const dur = 800 + Math.random() * 600;
      
      p.textContent = shape;
      p.style.cssText = `left:${x}px;top:${y}px;font-size:${size}px;color:${color};--dx:${dx}px;--dy:${dy}px;animation:particleBurst ${dur}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards;`;
      container.appendChild(p);
      setTimeout(() => p.remove(), dur);
    }
  },

  // Rain particles from top
  rain(count = 25) {
    const container = document.getElementById('particles') || this._createContainer();
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'particle';
        const shape = this.shapes[Math.floor(Math.random() * this.shapes.length)];
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const x = Math.random() * window.innerWidth;
        const size = 8 + Math.random() * 14;
        const dur = 1500 + Math.random() * 1500;
        const sway = -50 + Math.random() * 100;
        
        p.textContent = shape;
        p.style.cssText = `left:${x}px;top:-20px;font-size:${size}px;color:${color};--dx:${sway}px;--dy:${window.innerHeight + 50}px;animation:particleFall ${dur}ms ease-in forwards;opacity:0.8;`;
        container.appendChild(p);
        setTimeout(() => p.remove(), dur);
      }, i * 60);
    }
  },

  // Sparkle around an element
  sparkle(el) {
    const container = document.getElementById('particles') || this._createContainer();
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = '✦';
      const color = this.colors[Math.floor(Math.random() * this.colors.length)];
      const angle = (Math.PI * 2 * i) / 8;
      const r = 20 + Math.random() * 30;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      p.style.cssText = `left:${x}px;top:${y}px;font-size:14px;color:${color};animation:sparkleAnim 600ms ease-out forwards;`;
      container.appendChild(p);
      setTimeout(() => p.remove(), 600);
    }
  },

  // Big celebration for final screen
  celebrate() {
    this.rain(40);
    setTimeout(() => this.burst(window.innerWidth / 2, window.innerHeight / 2, 30), 300);
    setTimeout(() => this.burst(window.innerWidth * 0.3, window.innerHeight * 0.4, 20), 600);
    setTimeout(() => this.burst(window.innerWidth * 0.7, window.innerHeight * 0.4, 20), 900);
  },
  
  _createContainer() {
    const c = document.createElement('div');
    c.id = 'particles';
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(c);
    return c;
  }
};

// --- TRANSITION SYSTEM ---
function transitionQuiz(renderFn) {
  const content = document.querySelector('.quiz-content');
  if (content) {
    content.style.animation = 'slideOutLeft 0.3s ease forwards';
    setTimeout(() => {
      renderFn();
      const newContent = document.querySelector('.quiz-content');
      if (newContent) newContent.style.animation = 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      if (window.lucide) window.lucide.createIcons();
    }, 280);
  } else {
    renderFn();
    if (window.lucide) window.lucide.createIcons();
  }
}

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

const VECTOR_LABELS = { events: 'Іс-шара (Ивенты)', partners: 'Серіктестер (Партнеры)', media: 'Медиа', hr: 'HR', komek: 'Көмек (Волонтерство)', it: 'Креатив и IT', edu: 'Бірлес (Образование)', pr: 'Идеология и PR' };

const I18N = {
  home_title: { ru: 'Jastar Senaty', kk: 'Jastar Senaty' },
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
  { id: 'q_is_resident', type: 'choice', text: { ru: 'Вы уже являетесь резидентом Jastar Senaty?', kk: 'Сіз Jastar Senaty резидентісіз бе?' }, options: [{ text: { ru: 'Да', kk: 'Иә' } }, { text: { ru: 'Нет', kk: 'Жоқ' } }] },
  { id: 'q1', type: 'text', text: { ru: 'Как к вам обращаться?', kk: 'Сізге қалай жүгінейік?' } },
  { id: 'q2', type: 'text', text: { ru: 'Сколько вам лет?', kk: 'Жасыңыз нешеде?' } },
  { id: 's1', type: 'choice', text: { ru: 'Главный спикер застрял в пробке, в зале шумят 100 человек. Твои действия?', kk: 'Басты спикер кептелісте қалды, залда 100 адам шулап жатыр. Әрекетіңіз?' }, 
    options: [
      { text: { ru: 'Выйду на сцену и начну разогревать толпу сам', kk: 'Сахнаға шығып, халықты өзім қыздыра бастаймын' }, add: ['hr', 'pr'] },
      { text: { ru: 'Пойду за кулисы перекраивать тайминг и искать замену', kk: 'Сахна артына барып, таймингті өзгертемін және ауыстыру іздеймін' }, add: ['events'] },
      { text: { ru: 'Сниму трендовый рилс с ожидающей толпой', kk: 'Күтіп тұрған халықпен трендке сай рилс түсіремін' }, add: ['media', 'it'] },
      { text: { ru: 'Найду спонсорские напитки и раздам людям, чтобы успокоить', kk: 'Демеушілік сусындарды тауып, адамдарды тыныштандыру үшін таратамын' }, add: ['partners', 'komek'] }
    ]
  },
  { id: 's2', type: 'choice', text: { ru: 'Популярный паблик выложил про вас хейт-пост. Что делаешь?', kk: 'Танымал паблик сіз туралы хейт-пост шығарды. Не істейсіз?' }, 
    options: [
      { text: { ru: 'Напишу официальное опровержение с фактами и цифрами', kk: 'Фактілер мен сандармен ресми теріске шығару жазамын' }, add: ['pr', 'edu'] },
      { text: { ru: 'Сделаю ироничный мем в ответ и выложу в сторис', kk: 'Жауап ретінде ирониялық мем жасап, сториске саламын' }, add: ['media', 'it'] },
      { text: { ru: 'Игнорирую хейт, пойду организовывать доброе дело', kk: 'Хейтті елемей, қайырымдылық іс ұйымдастыруға барамын' }, add: ['komek', 'events'] },
      { text: { ru: 'Созвонюсь с админом паблика и предложу партнерство', kk: 'Паблик админімен хабарласып, серіктестік ұсынамын' }, add: ['partners', 'hr'] }
    ]
  },
  { id: 's3', type: 'choice', text: { ru: 'Новичок берет много задач, но постоянно срывает дедлайны.', kk: 'Жаңа адам көп тапсырма алады, бірақ дедлайндарды үнемі бұзады.' }, 
    options: [
      { text: { ru: 'Поговорю по душам, узнаю, что мешает, и помогу', kk: 'Шын жүректен сөйлесіп, не кедергі екенін біліп, көмектесемін' }, add: ['hr', 'komek'] },
      { text: { ru: 'Заберу часть задач и сделаю сам, чтобы не сорвать проект', kk: 'Жобаны бұзбау үшін тапсырмалардың бір бөлігін өзім жасаймын' }, add: ['events'] },
      { text: { ru: 'Предложу ему пройти курс по тайм-менеджменту', kk: 'Оған тайм-менеджмент курсынан өтуді ұсынамын' }, add: ['edu'] },
      { text: { ru: 'Жестко поставлю рамки: еще один срыв — переводим в резерв', kk: 'Қатаң шектеу қоямын: тағы бір бұзу — резервке ауыстырамыз' }, add: ['pr', 'partners'] }
    ]
  },
  { id: 's4', type: 'choice', text: { ru: 'Нам нужно вовлечь трудных подростков в работу. Что предложишь?', kk: 'Біз қиын жасөспірімдерді жұмысқа тартуымыз керек. Не ұсынасыз?' }, 
    options: [
      { text: { ru: 'Проведем уличный фестиваль с рэпом и стрит-артом', kk: 'Рэп және стрит-артпен көше фестивалін өткіземіз' }, add: ['events', 'it'] },
      { text: { ru: 'Организуем сбор макулатуры с призами от спонсоров', kk: 'Демеушілерден сыйлықтармен макулатура жинауды ұйымдастырамыз' }, add: ['komek', 'partners'] },
      { text: { ru: 'Снимем про них документалку, чтобы дать им высказаться', kk: 'Оларға өз ойларын айтуға мүмкіндік беру үшін деректі фильм түсіреміз' }, add: ['media', 'pr'] },
      { text: { ru: 'Проведем воркшопы по дизайну, чтобы дать им профессию', kk: 'Оларға мамандық беру үшін дизайн бойынша воркшоптар өткіземіз' }, add: ['edu', 'hr'] }
    ]
  },
  { id: 's5', type: 'choice', text: { ru: 'Спонсор дает деньги, но просит рекламировать вредный для экологии продукт.', kk: 'Демеуші ақша береді, бірақ экологияға зиянды өнімді жарнамалауды сұрайды.' }, 
    options: [
      { text: { ru: 'Откажусь. Репутация и принципы важнее денег', kk: 'Бас тартамын. Бедел мен принциптер ақшадан маңызды' }, add: ['pr', 'komek'] },
      { text: { ru: 'Попытаюсь переубедить его проспонсировать наш ЭКО-проект', kk: 'Оны біздің ЭКО-жобаға демеушілік жасауға көндіруге тырысамын' }, add: ['partners'] },
      { text: { ru: 'Соглашусь, но рекламу сделаю максимально нейтральной', kk: 'Келісемін, бірақ жарнаманы барынша бейтарап жасаймын' }, add: ['events', 'media'] },
      { text: { ru: 'Проведу опрос среди команды: если большинство "за", берем', kk: 'Команда арасында сауалнама жүргіземін: егер көпшілік "қолдаса", аламыз' }, add: ['hr', 'edu'] }
    ]
  },
  { id: 's6', type: 'choice', text: { ru: 'Какой навык ты хочешь прокачать больше всего?', kk: 'Қандай дағдыны көбірек дамытқыңыз келеді?' }, 
    options: [
      { text: { ru: 'Съемка, монтаж, дизайн, IT', kk: 'Түсірілім, монтаж, дизайн, IT' }, add: ['media', 'it'] },
      { text: { ru: 'Управление людьми, психология, нетворкинг', kk: 'Адамдарды басқару, психология, нетворкинг' }, add: ['hr', 'partners'] },
      { text: { ru: 'Организация масштабных событий, логистика', kk: 'Ауқымды іс-шараларды ұйымдастыру, логистика' }, add: ['events'] },
      { text: { ru: 'Ораторское искусство, создание смыслов, образование', kk: 'Шешендік өнер, мағына жасау, білім беру' }, add: ['edu', 'pr', 'komek'] }
    ]
  },
  { id: 'q_wa', type: 'text', text: { ru: 'Ваш номер WhatsApp', kk: 'WhatsApp нөміріңіз' } }
];

const COORD_QUESTIONS = [
  { id: 'name', type: 'text', text: { ru: 'Как вас зовут?', kk: 'Есіміңіз кім?' } },
  ...QUESTIONS.slice(2, -1), // Only the situational questions
  { id: 'coord_login', type: 'text', text: { ru: 'Придумайте логин', kk: 'Логин ойлап табыңыз' } },
  { id: 'coord_pass', type: 'text', text: { ru: 'Придумайте пароль', kk: 'Құпия сөз ойлап табыңыз' } }
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

let coordQuizState = { step: 0, answers: {} };

window.addEventListener('hashchange', route);
function route() {
  const p = window.location.pathname;
  if (p === '/quiz') { window.history.replaceState(null, '', '/#quiz'); }
  if (p === '/coord') { window.history.replaceState(null, '', '/#coord-reg'); }
  
  const h = window.location.hash || '#home';
  if (h === '#home') renderHome();
  else if (h === '#feed') renderFeed();
  else if (h === '#quiz') { if (quizState.step === 0) quizState = { step: 0, answers: {} }; renderQuiz(); }
  else if (h === '#coord-reg') { if (coordQuizState.step === 0) coordQuizState = { step: 0, answers: {} }; renderCoordReg(); }
  else if (h === '#admin') window.renderAdmin();
  if (window.lucide) window.lucide.createIcons();
}

// --- HOME ---
function renderHome() {
  app().innerHTML = `
    <div class="home-container">
      <div style="position:absolute;top:20px;right:20px">
        <button class="btn-outline btn-small" onclick="setLang(lang==='ru'?'kk':'ru')">${lang==='ru'?'ҚАЗ':'РУС'}</button>
      </div>
      <div class="home-logo"><i data-lucide="sparkles" style="width:72px;height:72px;stroke-width:1.5;color:var(--accent);filter:drop-shadow(0 0 20px rgba(2, 132, 199, 0.4))"></i></div>
      <h1>${t('home_title')}</h1>
      <p style="margin-bottom:36px;color:var(--text-muted)">${t('home_sub')}</p>
      <a href="#quiz" class="btn">${t('btn_quiz')}</a>
      
      <div style="margin-top:40px">
        <button id="btn-admin" style="background:none;border:none;color:var(--text-muted);font-size:13px;font-family:var(--font-body);cursor:pointer;opacity:0.6;transition:opacity 0.2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">
          Вход для сотрудников
        </button>
      </div>
    </div>`;
  document.getElementById('btn-admin').onclick = async () => {
    const login = prompt('Логин:');
    if (!login) return;
    const pwd = prompt('Пароль:');
    if (!pwd) return;
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ contact: login, password: pwd }) });
      localStorage.setItem('token', r.token);
      localStorage.setItem('user_role', r.user.role || 'admin');
      localStorage.setItem('user_vector', r.user.vector || '');
      localStorage.setItem('user_label', r.user.label || 'Админ');
      adminTab = r.user.role === 'coordinator' ? 'list' : 'dashboard'; 
      viewingQuestionnaire = null;
      window.location.hash = '#admin';
    } catch { alert('Неверный логин или пароль'); }
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
    inp = `<div class="quiz-options" style="display:flex;flex-direction:column;gap:8px;">${q.options.map(o => {
      const optText = o.text[lang];
      return `<button class="quiz-option ${val===optText?'selected':''}" data-val="${esc(optText)}" style="text-align:left;height:auto;white-space:normal;line-height:1.4">${esc(optText)}</button>`;
    }).join('')}</div>`;
  } else {
    inp = `<input type="text" id="q-input" class="quiz-input" placeholder="${t('placeholder')}" value="${esc(val)}" />`;
  }
  app().innerHTML = `
    <div class="layout">
      <div class="progress-container">
        <button class="btn-close" onclick="window.location.hash='#home'">✕</button>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <button class="btn-outline btn-small" style="padding: 4px 8px; font-size: 12px; margin-left: 8px" onclick="setLang(lang==='ru'?'kk':'ru')">${lang==='ru'?'ҚАЗ':'РУС'}</button>
      </div>
      <div class="quiz-content"><div class="quiz-question">${esc(qText)}</div>${inp}</div>
      <div class="quiz-footer"><button class="btn" id="btn-next">${t('btn_next')}</button></div>
    </div>`;
  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-option').forEach(b => { 
      b.onclick = (e) => { 
        quizState.answers[q.id] = b.getAttribute('data-val'); 
        // Particle burst from click point
        PARTICLES.burst(e.clientX, e.clientY, 12);
        PARTICLES.sparkle(b);
        renderQuiz(); 
      }; 
    });
  }
  document.getElementById('btn-next').onclick = (e) => {
    if (q.type !== 'choice') { const i = document.getElementById('q-input'); if (!i.value.trim()) return showToast(t('err_empty')); quizState.answers[q.id] = i.value.trim(); }
    else { if (!quizState.answers[q.id]) return showToast(t('err_choice')); }
    quizState.step = getNextStep(quizState.step);
    // Rain particles + slide transition
    PARTICLES.rain(10);
    transitionQuiz(renderQuiz);
  };
}

async function renderQuizDone() {
  app().innerHTML = `<div class="home-container"><div class="home-logo"><i data-lucide="loader-2" style="width:48px;height:48px;color:var(--accent);animation:spin 1s linear infinite"></i></div><h1>${t('sending')}</h1></div>`;
  if (window.lucide) window.lucide.createIcons();
  try {
    const scores = { events:0, partners:0, media:0, hr:0, komek:0, it:0, edu:0, pr:0 };
    for (const q of QUESTIONS) {
      if (q.type === 'choice' && q.options) {
        const selectedText = quizState.answers[q.id];
        const opt = q.options.find(o => o.text.ru === selectedText || o.text.kk === selectedText);
        if (opt && opt.add) {
          opt.add.forEach(v => scores[v]++);
        }
      }
    }
    
    let maxV = 'events';
    let maxS = -1;
    for (const [k, v] of Object.entries(scores)) {
      if (v > maxS) { maxS = v; maxV = k; }
    }

    await api('/public/questionnaires', {
      method: 'POST',
      body: JSON.stringify({ tg_username: quizState.answers.q_wa || '?', answers: quizState.answers, vector: maxV })
    });
    app().innerHTML = `<div class="home-container"><div class="home-logo"><i data-lucide="party-popper" style="width:64px;height:64px;color:var(--accent)"></i></div><h1>${t('done_title')}</h1><p style="margin-bottom:32px;color:var(--text-muted)">${t('done_text')}</p><a href="#home" class="btn">${t('btn_home')}</a></div>`;
    if (window.lucide) window.lucide.createIcons();
    PARTICLES.celebrate();
    quizState = { step: 0, answers: {} };
  } catch (e) {
    app().innerHTML = `<div class="home-container"><h1>${t('err_send')}</h1><p>${esc(e.message)}</p><button class="btn" onclick="renderQuizDone()">${t('btn_retry')}</button><a href="#home" class="btn btn-outline" style="margin-top:8px">${t('btn_home')}</a></div>`;
  }
}

// --- COORD REGISTRATION ---
function renderCoordReg() {
  const q = COORD_QUESTIONS[coordQuizState.step];
  if (!q) return renderCoordDone();

  const pct = Math.round((coordQuizState.step / COORD_QUESTIONS.length) * 100);

  app().innerHTML = `
    <div class="layout">
      <div class="progress-container">
        <button class="btn-close" onclick="window.location.hash='#home'">✕</button>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <button class="btn-outline btn-small" style="padding: 4px 8px; font-size: 12px; margin-left: 8px" onclick="setLang(lang==='ru'?'kk':'ru')">${lang==='ru'?'ҚАЗ':'РУС'}</button>
      </div>
      <div class="quiz-content">
        <div class="quiz-question">${esc(q.text[lang] || q.text.ru)}</div>
        ${q.type === 'choice' ? `
          <div class="quiz-options">
            ${q.options.map(o => {
              const text = o.text[lang] || o.text.ru;
              const sel = coordQuizState.answers[q.id] === text ? 'selected' : '';
              return `<div class="quiz-option ${sel}" data-val="${esc(text)}">${esc(text)}</div>`;
            }).join('')}
          </div>` : `
          <input type="text" id="qa" class="quiz-input" placeholder="${t('placeholder')}" value="${esc(coordQuizState.answers[q.id] || '')}" autofocus />
        `}
      </div>
      <div class="quiz-footer">
        <button class="btn" id="btn-n">${t('btn_next')}</button>
      </div>
    </div>`;

  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-option').forEach(b => { 
      b.onclick = (e) => { 
        coordQuizState.answers[q.id] = b.getAttribute('data-val'); 
        PARTICLES.burst(e.clientX, e.clientY, 12);
        PARTICLES.sparkle(b);
        renderCoordReg(); 
      }; 
    });
  }

  document.getElementById('btn-n').onclick = () => {
    if (q.type === 'text') {
      const v = document.getElementById('qa').value.trim();
      if (!v) return showToast(t('err_empty'));
      coordQuizState.answers[q.id] = v;
    } else if (!coordQuizState.answers[q.id]) {
      return showToast(t('err_choice'));
    }
    coordQuizState.step++;
    PARTICLES.rain(10);
    transitionQuiz(renderCoordReg);
  };
}

async function renderCoordDone() {
  app().innerHTML = `<div class="home-container"><div class="home-logo"><i data-lucide="loader-2" style="width:48px;height:48px;color:var(--accent);animation:spin 1s linear infinite"></i></div><h1>${t('sending')}</h1></div>`;
  if (window.lucide) window.lucide.createIcons();
  try {
    const scores = { events:0, partners:0, media:0, hr:0, komek:0, it:0, edu:0, pr:0 };
    for (const q of COORD_QUESTIONS) {
      if (q.type === 'choice' && q.options) {
        const selectedText = coordQuizState.answers[q.id];
        const opt = q.options.find(o => o.text.ru === selectedText || o.text.kk === selectedText);
        if (opt && opt.add) {
          opt.add.forEach(v => scores[v]++);
        }
      }
    }
    
    let maxV = 'events';
    let maxS = -1;
    for (const [k, v] of Object.entries(scores)) {
      if (v > maxS) { maxS = v; maxV = k; }
    }

    const res = await api('/auth/register-coord', {
      method: 'POST',
      body: JSON.stringify({ 
        contact: coordQuizState.answers.coord_login, 
        password: coordQuizState.answers.coord_pass,
        answers: coordQuizState.answers, 
        vector: maxV 
      })
    });
    
    app().innerHTML = `<div class="home-container"><div class="home-logo"><i data-lucide="party-popper" style="width:64px;height:64px;color:var(--accent)"></i></div><h1>Успешно!</h1><p style="margin-bottom:32px;color:var(--text-muted)">Ваш аккаунт создан (Вектор: <b>${VECTOR_LABELS[maxV]}</b>).<br><br>Ожидайте подтверждения от администратора перед входом.</p><a href="#home" class="btn">На главную</a></div>`;
    if (window.lucide) window.lucide.createIcons();
    PARTICLES.celebrate();
    coordQuizState = { step: 0, answers: {} };
  } catch (e) {
    app().innerHTML = `<div class="home-container"><h1>${t('err_send')}</h1><p>${esc(e.message)}</p><button class="btn" onclick="renderCoordDone()">${t('btn_retry')}</button><a href="#home" class="btn btn-outline" style="margin-top:8px">${t('btn_home')}</a></div>`;
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
        <div class="card" style="padding:0; overflow:hidden; position:relative; ${theme.border ? `border:${theme.border};` : ''}">
          ${theme.hat ? `<div style="position:absolute;top:0;left:0;right:0;height:12px;background:${theme.hat};z-index:10"></div>` : ''}
          <div style="background:${theme.bg};color:${theme.text};padding:24px;text-align:center;position:relative;${theme.hat ? 'padding-top:36px;' : ''}">
            <div style="position:relative;z-index:2">
              ${renderEmoji}
              <div style="font-size:24px;font-weight:800">${esc(e.title)}</div>
            </div>
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

  const role = localStorage.getItem('user_role') || 'admin';
  const label = localStorage.getItem('user_label') || 'Админ';

  app().innerHTML = `
    <div class="layout">
      <div class="top-nav">
        <a href="#" onclick="localStorage.removeItem('token');localStorage.removeItem('user_role');window.location.hash='#home';return false">← Выйти</a>
        <span style="font-weight:700;color:var(--accent)">${esc(label)}</span>
      </div>
      <div class="tabs">
        ${role === 'admin' ? `
          <button class="tab ${window.adminTab==='dashboard'?'active':''}" onclick="window.adminTab='dashboard';window.renderAdmin()">📊 Дашборд</button>
        ` : ''}
        <button class="tab ${window.adminTab==='list'?'active':''}" onclick="window.adminTab='list';window.renderAdmin()">📋 Анкеты</button>
        ${role === 'admin' ? `
          <button class="tab ${window.adminTab==='events'?'active':''}" onclick="window.adminTab='events';window.renderAdmin()">📢 Анонсы</button>
          <button class="tab ${window.adminTab==='coords'?'active':''}" onclick="window.adminTab='coords';window.renderAdmin()">👥 Координаторы</button>
        ` : ''}
      </div>
      <div id="admin-content">Загрузка...</div>
    </div>`;

  try {
    const { items } = await api('/admin/questionnaires');
    const container = document.getElementById('admin-content');

    if (window.adminTab === 'dashboard') renderDashboard(container, items);
    else if (window.adminTab === 'list') renderQList(container, items);
    else if (window.adminTab === 'events') renderEventsTab(container);
    else if (window.adminTab === 'coords') renderCoordsTab(container);
  } catch (e) {
    document.getElementById('admin-content').innerHTML = `<div class="card"><p>Ошибка: ${esc(e.message)}</p></div>`;
  }
}

function renderDashboard(el, items) {
  const total = items.length;
  const today = items.filter(q => { const d = new Date(q.created_at); const now = new Date(); return d.toDateString() === now.toDateString(); }).length;
  
  // Count vectors
  const vectors = {};
  items.forEach(q => {
    if (q.vector) vectors[q.vector] = (vectors[q.vector]||0)+1;
  });

  const maxV = Math.max(...Object.values(vectors), 1);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${total}</div><div class="stat-label">Всего анкет</div></div>
      <div class="stat-card"><div class="stat-number">${today}</div><div class="stat-label">Сегодня</div></div>
    </div>

    ${Object.keys(vectors).length ? `
    <div class="card">
      <h3 style="margin-bottom:16px">Векторы (Таланты)</h3>
      ${Object.entries(vectors).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `
        <div class="chart-bar-row">
          <div class="chart-label">${esc(VECTOR_LABELS[k] || k)}</div>
          <div class="chart-track"><div class="chart-fill" style="width:${(v/maxV*100)}%"></div></div>
          <div class="chart-value">${v}</div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
}

function renderQList(el, items) {
  if (!items.length) { el.innerHTML = '<div class="card"><p>Анкет пока нет.</p></div>'; return; }
  
  const userVector = localStorage.getItem('user_vector');
  const role = localStorage.getItem('user_role');

  if (role === 'coordinator' && userVector) {
    items.sort((a, b) => {
      const aMatch = a.vector === userVector;
      const bMatch = b.vector === userVector;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  } else {
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  
  el.innerHTML = items.map((q, i) => {
    const isMatch = role === 'coordinator' && q.vector === userVector;
    return `
    <div class="card card-clickable" onclick="window.viewingQuestionnaire=${i};window.renderAdmin()" style="animation-delay:${i*0.05}s; ${isMatch ? 'border-left: 4px solid #10b981;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:800;font-size:17px;display:flex;align-items:center;gap:8px">
            @${esc(q.tg_username || (q.answers&&q.answers.name) || 'Аноним')}
            ${q.answers && (q.answers.q_is_resident === 'Да' || q.answers.q_is_resident === 'Иә') ? `<span style="font-size:11px;background:#3b82f6;color:#fff;padding:2px 8px;border-radius:12px">✅ Резидент</span>` : `<span style="font-size:11px;background:#ef4444;color:#fff;padding:2px 8px;border-radius:12px">🔥 Новый</span>`}
            ${q.vector ? `<span style="font-size:11px;background:var(--accent);color:#fff;padding:2px 8px;border-radius:12px">${esc(VECTOR_LABELS[q.vector] || q.vector)}</span>` : ''}
            ${isMatch ? `<span style="font-size:11px;background:#10b981;color:#fff;padding:2px 8px;border-radius:12px;display:inline-flex;align-items:center;gap:4px;"><i data-lucide="zap" style="width:12px;height:12px;"></i> Идеальный мэтч</span>` : ''}
          </div>
          <div class="meta">${new Date(q.created_at).toLocaleString('ru')}</div>
        </div>
        <div style="color:var(--accent);font-size:20px;display:flex;align-items:center;"><i data-lucide="chevron-right"></i></div>
      </div>
    </div>
  `}).join('');
  
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
            <div style="font-weight:800;font-size:18px">@${esc(q.tg_username || (q.answers&&q.answers.name) || 'Аноним')}</div>
            <div class="meta">${new Date(q.created_at).toLocaleString('ru')}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${q.answers && (q.answers.q_is_resident === 'Да' || q.answers.q_is_resident === 'Иә') ? `<span style="font-size:13px;background:#3b82f6;color:#fff;padding:4px 10px;border-radius:12px;font-weight:700">✅ Резидент</span>` : `<span style="font-size:13px;background:#ef4444;color:#fff;padding:4px 10px;border-radius:12px;font-weight:700">🔥 Новый</span>`}
          ${q.vector ? `<span style="font-size:13px;background:var(--accent);color:#fff;padding:4px 10px;border-radius:12px;font-weight:700">Вектор: ${esc(VECTOR_LABELS[q.vector] || q.vector)}</span>` : ''}
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
  { id: 'fire', bg: 'linear-gradient(135deg, #f7971e, #ffd200)', text: '#5a3800' },
  { id: 'white-border', bg: '#fff', text: '#333', border: '3px solid var(--accent)' },
  { id: 'dark-border', bg: '#1a1a2e', text: '#fff', border: '3px solid #4facfe' },
  { id: 'hat-purple', bg: '#fff', text: '#333', hat: 'linear-gradient(135deg, #667eea, #764ba2)' },
  { id: 'hat-sunset', bg: '#fff', text: '#333', hat: 'linear-gradient(135deg, #f093fb, #f5576c)' },
  { id: 'soft-pink', bg: '#fff0f5', text: '#d81b60', border: '2px dashed #f48fb1' },
  { id: 'soft-green', bg: '#f0fff4', text: '#2e7d32', border: '2px dashed #81c784' }
];

window.EVENT_ICONS = [
  { id: 'party', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.39-1.87.15-2.15 1.07v0a1.96 1.96 0 0 1-2.52 1.36l-1.3-.54c-.86-.35-1.8.2-1.92 1.15l-.05.45"/><path d="m11 2-.33.82c-.39.86.15 1.87 1.07 2.15v0c.93.28 1.48 1.25 1.25 2.18l-.45 1.83c-.24.96.48 1.88 1.46 1.96l.52.05"/><path d="M11.46 8.54 5.27 14.73a2.86 2.86 0 0 0 0 4l2 2a2.86 2.86 0 0 0 4 0l6.19-6.19"/></svg>' },
  { id: 'star', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { id: 'heart', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' },
  { id: 'zap', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { id: 'flame', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>' },
  { id: 'target', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>' },
  { id: 'users', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { id: 'trophy', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>' },
  { id: 'camera', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>' },
  { id: 'music', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  { id: 'tree', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-6"/><path d="M12 8v8"/><path d="M12 8a3 3 0 0 0-3-3H7.5"/><path d="M12 8a3 3 0 0 1 3-3h1.5"/><path d="M12 16a4 4 0 0 0-4-4H6.5"/><path d="M12 16a4 4 0 0 1 4-4h1.5"/></svg>' },
  { id: 'smile', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
  { id: 'map-pin', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' },
  { id: 'calendar', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' }
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
    <div style="background:${theme.bg};color:${theme.text};border-radius:var(--radius);${theme.border ? `border:${theme.border};` : ''}padding:28px 24px;text-align:center;transition:all 0.3s;position:relative;overflow:hidden;box-shadow:var(--shadow);${theme.hat ? 'padding-top:40px;' : ''}">
      ${theme.hat ? `<div style="position:absolute;top:0;left:0;right:0;height:12px;background:${theme.hat}"></div>` : ''}
      <div style="width:48px;height:48px;margin:0 auto 12px;position:relative;z-index:2">${iconObj.svg}</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:8px;position:relative;z-index:2">${esc(title)}</div>
      ${desc ? `<div style="font-size:14px;opacity:0.85;margin-bottom:8px;position:relative;z-index:2">${esc(desc)}</div>` : ''}
      ${loc ? `<div style="font-size:13px;opacity:0.7;position:relative;z-index:2">📍 ${esc(loc)}</div>` : ''}
    </div>`;
}

async function renderEventsTab(el) {
  const theme = window.EVENT_THEMES[window._evTheme];
  const iconObj = window.EVENT_ICONS.find(x => x.id === window._evEmoji) || window.EVENT_ICONS[0];
  el.innerHTML = `
    <div class="card">
      <h3>Создать анонс</h3>

      <div id="ev-preview" style="margin-bottom:16px">
        <div style="background:${theme.bg};color:${theme.text};border-radius:var(--radius);${theme.border ? `border:${theme.border};` : ''}padding:28px 24px;text-align:center;position:relative;overflow:hidden;box-shadow:var(--shadow);${theme.hat ? 'padding-top:40px;' : ''}">
          ${theme.hat ? `<div style="position:absolute;top:0;left:0;right:0;height:12px;background:${theme.hat}"></div>` : ''}
          <div style="width:48px;height:48px;margin:0 auto 12px;position:relative;z-index:2">${iconObj.svg}</div>
          <div style="font-size:22px;font-weight:800;position:relative;z-index:2">Так будет выглядеть</div>
        </div>
      </div>

      <label class="meta">Векторная иконка</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
        ${window.EVENT_ICONS.map(i => `<button onclick="pickEmoji('${i.id}')" style="width:48px;height:48px;padding:10px;border-radius:10px;border:2px solid ${window._evEmoji===i.id?'var(--accent)':'var(--border)'};background:${window._evEmoji===i.id?'#ede9fe':'var(--bg-card)'};color:var(--text);cursor:pointer;transition:all 0.2s" title="${i.id}">${i.svg}</button>`).join('')}
      </div>

      <label class="meta">Цвет фона</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        ${window.EVENT_THEMES.map((t, i) => `<button onclick="pickTheme(${i})" style="width:36px;height:36px;border-radius:8px;background:${t.bg};border:3px solid ${window._evTheme===i?'var(--accent)':'var(--border)'};cursor:pointer;transition:all 0.2s;position:relative;overflow:hidden" title="${t.id}">
          ${t.hat ? `<div style="position:absolute;top:0;left:0;right:0;height:6px;background:${t.hat}"></div>` : ''}
        </button>`).join('')}
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

async function renderCoordsTab(el) {
  el.innerHTML = '<div class="card"><p>Загрузка...</p></div>';
  try {
    const { items } = await api('/admin/coordinators');
    if (!items.length) { el.innerHTML = '<div class="card"><p>Координаторов нет.</p></div>'; return; }
    
    el.innerHTML = items.map(c => `
      <div class="card" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700;font-size:18px">${esc(c.contact)}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
            Вектор: <b>${esc(VECTOR_LABELS[c.vector] || c.vector)}</b>
          </div>
        </div>
        <div>
          ${c.is_approved 
            ? '<span style="color:#10b981;font-weight:700;font-size:13px">✅ Одобрен</span>' 
            : `<button class="btn btn-small" onclick="approveCoord(${c.id})" style="background:var(--accent)">Одобрить</button>`}
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<div class="card"><p>Ошибка: ${esc(e.message)}</p></div>`;
  }
}

window.approveCoord = async function(id) {
  try {
    await api(\`/admin/coordinators/\${id}/approve\`, { method: 'POST' });
    showToast('Координатор одобрен!');
    window.renderAdmin();
  } catch(e) { showToast(e.message); }
};

route();

