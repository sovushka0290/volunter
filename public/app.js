/* ============================================================
   Платформа анонсов и анкет (Genshin Impact Theme)
   ============================================================ */

const state = {
  token: localStorage.getItem('token') || null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');

/* ---------- API-клиент ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (state.token && res.status === 401) {
      localStorage.removeItem('token');
      state.token = null;
      window.location.hash = '#admin';
    }
    throw new Error(data.error || 'Ошибка запроса');
  }
  return data;
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = esc(msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ---------- Роутер ---------- */
async function route() {
  const hash = window.location.hash || '#feed';
  app().innerHTML = '<div class="layout"><div class="card">Загрузка...</div></div>';
  try {
    if (hash === '#feed') await renderFeed();
    else if (hash === '#questionnaire') await renderQuestionnaire();
    else if (hash === '#admin') await renderAdmin();
    else window.location.hash = '#feed';
  } catch (e) {
    app().innerHTML = `<div class="layout"><div class="card">Ошибка: ${esc(e.message)}</div></div>`;
  }
}
window.addEventListener('hashchange', route);

/* ---------- Экраны ---------- */
function navHTML(active) {
  return `
    <header>
      <h1>Звездный Путь</h1>
      <div class="nav">
        <a href="#feed" class="${active === 'feed' ? 'active' : ''}">Анонсы</a>
        <a href="#questionnaire" class="${active === 'questionnaire' ? 'active' : ''}">Анкета</a>
      </div>
    </header>
  `;
}

async function renderFeed() {
  const res = await api('/public/events');
  const items = res.items || [];
  
  let html = `<div class="layout">${navHTML('feed')}`;
  if (items.length === 0) {
    html += `<div class="card">Пока нет доступных анонсов.</div>`;
  } else {
    items.forEach(e => {
      html += `
        <div class="card">
          ${e.banner_url ? `<img src="${esc(e.banner_url)}" class="event-banner" alt="Banner">` : ''}
          <h2>${esc(e.title)}</h2>
          <div class="meta">📍 ${esc(e.location || 'Место не указано')} | 🕒 ${new Date(e.starts_at).toLocaleString('ru')}</div>
          <p>${esc(e.description)}</p>
        </div>
      `;
    });
  }
  html += `</div>`;
  app().innerHTML = html;
}

async function renderQuestionnaire() {
  app().innerHTML = `
    <div class="layout">
      ${navHTML('questionnaire')}
      <div class="card" id="q-form">
        <h2>Анкета Искателя Приключений</h2>
        <p style="margin-bottom:20px; color:var(--text-muted);">Расскажите о себе, чтобы присоединиться к нашей гильдии.</p>
        
        <div class="question-group">
          <label>Ваша мотивация:</label>
          <textarea id="q-mot" rows="4" placeholder="Почему вы хотите присоединиться?"></textarea>
        </div>
        
        <div class="question-group">
          <label>Ваш опыт:</label>
          <textarea id="q-exp" rows="4" placeholder="Был ли у вас опыт подобных приключений?"></textarea>
        </div>
        
        <div class="question-group">
          <label>Чем вы можете быть полезны?</label>
          <textarea id="q-skills" rows="4" placeholder="Ваши уникальные навыки..."></textarea>
        </div>
        
        <div class="question-group">
          <label>Ваш Telegram (username)</label>
          <input type="text" id="q-tg" placeholder="@username" />
        </div>
        
        <button class="btn btn-primary" id="btn-submit">Отправить анкету</button>
      </div>
    </div>
  `;
  
  $('#btn-submit').onclick = async () => {
    const tg = $('#q-tg').value;
    const mot = $('#q-mot').value;
    const exp = $('#q-exp').value;
    const skills = $('#q-skills').value;
    
    if (!tg) return toast('Укажите Telegram!', 'error');
    
    try {
      $('#btn-submit').disabled = true;
      $('#btn-submit').textContent = 'Отправка...';
      await api('/public/questionnaires', {
        method: 'POST',
        body: { tg_username: tg, answers: { motivation: mot, experience: exp, skills } }
      });
      $('#q-form').innerHTML = `<h2>Анкета успешно отправлена!</h2><p>Ожидайте, мы свяжемся с вами в Telegram.</p><br><a href="#feed" class="btn">Вернуться к анонсам</a>`;
    } catch(e) {
      toast(e.message, 'error');
      $('#btn-submit').disabled = false;
      $('#btn-submit').textContent = 'Отправить анкету';
    }
  };
}

async function renderAdmin() {
  if (!state.token) {
    app().innerHTML = `
      <div class="layout" style="margin-top: 100px;">
        <div class="card" style="text-align:center;">
          <h2>Вход для Магистра</h2>
          <input type="password" id="admin-pass" placeholder="Пароль" style="max-width:300px; margin: 20px auto; display:block;" />
          <button class="btn btn-primary" id="btn-login">Войти</button>
        </div>
      </div>
    `;
    $('#btn-login').onclick = async () => {
      try {
        const res = await api('/auth/login', { method: 'POST', body: { contact: 'admin', password: $('#admin-pass').value } });
        state.token = res.token;
        localStorage.setItem('token', res.token);
        renderAdmin();
      } catch(e) {
        toast(e.message, 'error');
      }
    };
    return;
  }
  
  // Dashboard
  const res = await api('/admin/questionnaires');
  const qs = res.items || [];
  
  app().innerHTML = `
    <div class="layout">
      <header>
        <h1>Панель Магистра (Админ)</h1>
        <div class="nav">
          <a href="#feed">Выйти на главную</a>
          <a href="#" id="btn-logout">Выйти из аккаунта</a>
        </div>
      </header>
      
      <div class="card">
        <h2>Анкеты (${qs.length})</h2>
        <div style="overflow-x:auto;">
          <table>
            <tr><th>Дата</th><th>Telegram</th><th>Мотивация</th><th>Опыт</th><th>Навыки</th></tr>
            ${qs.map(q => `
              <tr>
                <td>${new Date(q.created_at).toLocaleDateString()}</td>
                <td>@${esc(q.tg_username)}</td>
                <td>${esc(q.answers.motivation)}</td>
                <td>${esc(q.answers.experience)}</td>
                <td>${esc(q.answers.skills)}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      </div>
    </div>
  `;
  
  $('#btn-logout').onclick = (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    state.token = null;
    window.location.hash = '#feed';
  };
}

route();
