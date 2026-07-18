const app = () => document.getElementById('app');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const showToast = (msg) => {
  const container = document.getElementById('toasts') || (() => {
    const el = document.createElement('div');
    el.id = 'toasts'; el.className = 'toasts';
    document.body.appendChild(el);
    return el;
  })();
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
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
};

// --- DATA ---
const QUESTIONS = [
  { id: 'q1', text: 'Как к вам обращаться?', type: 'text' },
  { id: 'q2', text: 'Сколько вам лет?', type: 'text' },
  { id: 'q3', text: 'Был ли у вас опыт волонтерства ранее?', type: 'choice', options: ['Да', 'Нет'] },
  { id: 'q4', text: 'Как часто вы можете участвовать в мероприятиях?', type: 'choice', options: ['Каждые выходные', 'Пару раз в месяц', 'Редко'] },
  { id: 'q5', text: 'Вы готовы работать в команде?', type: 'choice', options: ['Да, конечно', 'Предпочитаю работать один'] },
  { id: 'q6', text: 'Умеете ли вы фотографировать/снимать видео?', type: 'choice', options: ['Да, профессионально', 'Да, на телефон', 'Нет'] },
  { id: 'q7', text: 'Какими иностранными языками вы владеете?', type: 'text' },
  { id: 'q8', text: 'Вам комфортнее общаться с людьми или работать с документами?', type: 'choice', options: ['Общаться', 'С документами', 'И то, и другое'] },
  { id: 'q9', text: 'Что вас мотивирует быть волонтером?', type: 'textarea' },
  { id: 'q10', text: 'Умеете ли вы оказывать первую помощь?', type: 'choice', options: ['Да', 'Проходил(а) курсы', 'Нет'] },
  { id: 'q11', text: 'Готовы ли вы помогать физически (например, переносить коробки)?', type: 'choice', options: ['Да', 'Нет'] },
  { id: 'q12', text: 'Знаете ли вы, как вести социальные сети?', type: 'choice', options: ['Да', 'Немного', 'Нет'] },
  { id: 'q13', text: 'Есть ли у вас водительские права?', type: 'choice', options: ['Да', 'Нет'] },
  { id: 'q14', text: 'Опишите ваши главные навыки.', type: 'textarea' },
  { id: 'q15', text: 'Вы легко находите общий язык с незнакомцами?', type: 'choice', options: ['Да', 'Смотря по ситуации', 'Нет'] },
  { id: 'q16', text: 'Как вы узнали о нас?', type: 'text' },
  { id: 'q17', text: 'Готовы ли вы к форс-мажорным ситуациям?', type: 'choice', options: ['Да', 'Скорее да', 'Нет'] },
  { id: 'q18', text: 'Какое направление вам наиболее интересно?', type: 'choice', options: ['Организация', 'Медиа', 'Помощь на местах'] },
  { id: 'q19', text: 'Есть ли у вас хронические заболевания, о которых нам стоит знать?', type: 'text' },
  { id: 'q20', text: 'Укажите ваш Telegram (@username) для связи', type: 'text' }
];

let quizState = { step: 0, answers: {} };

// --- ROUTING ---
window.addEventListener('hashchange', route);
function route() {
  const hash = window.location.hash || '#home';
  if (hash === '#home') renderHome();
  else if (hash === '#feed') renderFeed();
  else if (hash === '#quiz') renderQuiz();
  else if (hash === '#admin') renderAdmin();
}

// --- HOME ---
function renderHome() {
  app().innerHTML = `
    <div class="home-container">
      <button class="admin-circle" id="btn-admin" title="Вход для администратора"></button>
      <div class="home-logo">🌟</div>
      <h1>Волонтерское движение</h1>
      <p style="margin-bottom: 40px; color: var(--text-muted);">Присоединяйтесь к нашей команде и следите за анонсами.</p>
      
      <a href="#quiz" class="btn">Заполнить анкету</a>
      <a href="#feed" class="btn btn-secondary">Анонсы мероприятий</a>
    </div>
  `;

  document.getElementById('btn-admin').onclick = async () => {
    const pwd = prompt('Введите пароль администратора:');
    if (!pwd) return;
    try {
      const res = await api('/auth/login', {
        method: 'POST', body: JSON.stringify({ contact: 'admin', password: pwd })
      });
      localStorage.setItem('token', res.token);
      window.location.hash = '#admin';
    } catch (e) {
      alert('Неверный пароль');
    }
  };
}

// --- QUIZ ---
function renderQuiz() {
  const q = QUESTIONS[quizState.step];
  if (!q) return renderQuizFinished();

  const progress = (quizState.step / QUESTIONS.length) * 100;
  const val = quizState.answers[q.id] || '';

  let inputHtml = '';
  if (q.type === 'choice') {
    inputHtml = `<div class="quiz-options">
      ${q.options.map(o => `
        <button class="quiz-option ${val === o ? 'selected' : ''}" data-val="${esc(o)}">
          ${esc(o)}
        </button>
      `).join('')}
    </div>`;
  } else if (q.type === 'textarea') {
    inputHtml = `<textarea id="q-input" class="quiz-input quiz-textarea" placeholder="Ваш ответ...">${esc(val)}</textarea>`;
  } else {
    inputHtml = `<input type="text" id="q-input" class="quiz-input" placeholder="Ваш ответ..." value="${esc(val)}" />`;
  }

  app().innerHTML = `
    <div class="layout">
      <div class="progress-container">
        <button class="btn-close" onclick="window.location.hash='#home'">×</button>
        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%"></div></div>
      </div>
      
      <div class="quiz-content">
        <div class="quiz-question">${esc(q.text)}</div>
        ${inputHtml}
      </div>

      <div class="quiz-footer">
        <button class="btn" id="btn-next">ПРОДОЛЖИТЬ</button>
      </div>
    </div>
  `;

  if (q.type === 'choice') {
    document.querySelectorAll('.quiz-option').forEach(btn => {
      btn.onclick = () => {
        quizState.answers[q.id] = btn.getAttribute('data-val');
        renderQuiz(); // re-render to show selected
      };
    });
  }

  document.getElementById('btn-next').onclick = () => {
    if (q.type !== 'choice') {
      const input = document.getElementById('q-input');
      if (input.value.trim() === '') return showToast('Пожалуйста, введите ответ');
      quizState.answers[q.id] = input.value.trim();
    } else {
      if (!quizState.answers[q.id]) return showToast('Выберите один из вариантов');
    }
    
    quizState.step++;
    renderQuiz();
  };
}

async function renderQuizFinished() {
  app().innerHTML = `
    <div class="home-container">
      <h1>Отправка анкеты...</h1>
      <div class="progress-bar" style="width: 200px; margin: 20px auto;"><div class="progress-fill" style="width: 100%"></div></div>
    </div>
  `;

  try {
    const tgUsername = quizState.answers['q20'] || 'unknown';
    await api('/public/questionnaires', {
      method: 'POST',
      body: JSON.stringify({ tg_username: tgUsername, answers: quizState.answers })
    });
    
    app().innerHTML = `
      <div class="home-container">
        <div class="home-logo">🎉</div>
        <h1>Поздравляем!</h1>
        <p style="margin-bottom: 40px; color: var(--text-muted);">Ваша анкета успешно отправлена. Мы скоро свяжемся с вами в Telegram.</p>
        <a href="#home" class="btn">На главную</a>
      </div>
    `;
    quizState = { step: 0, answers: {} };
  } catch (e) {
    app().innerHTML = `
      <div class="home-container">
        <h1>Ошибка отправки</h1>
        <p>${esc(e.message)}</p>
        <button class="btn" onclick="renderQuizFinished()">Попробовать снова</button>
      </div>
    `;
  }
}

// --- FEED ---
async function renderFeed() {
  app().innerHTML = `
    <div class="layout">
      <div class="top-nav">
        <a href="#home">← Назад</a>
        <a href="#feed" class="active">Анонсы</a>
      </div>
      <h2>Ближайшие мероприятия</h2>
      <div id="feed-content">Загрузка...</div>
    </div>
  `;
  try {
    const { items } = await api('/public/events');
    const container = document.getElementById('feed-content');
    if (!items.length) {
      container.innerHTML = `<div class="card">Пока нет доступных анонсов.</div>`;
      return;
    }
    container.innerHTML = items.map(e => `
      <div class="card">
        ${e.banner_url ? `<img src="${esc(e.banner_url)}" class="event-banner" alt="Banner">` : ''}
        <div class="meta">📍 ${esc(e.location || 'Не указано')} | 🕒 ${new Date(e.starts_at).toLocaleString('ru')}</div>
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
        <div>
          <button class="btn-outline" style="padding: 4px 12px; margin:0;" onclick="localStorage.removeItem('token'); window.location.hash='#home'">Выйти</button>
        </div>
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
            const qtext = QUESTIONS.find(x => x.id === key)?.text || key;
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
