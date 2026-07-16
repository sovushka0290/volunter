/* ============================================================
   Платформа волонтеров — клиентское приложение (SPA без сборки)
   Хеш-роутер, доступ по ролям, работа с REST API.
   ============================================================ */

const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  dict: null,
  unread: 0,
};

const $ = (sel, root = document) => root.querySelector(sel);
const app = () => document.getElementById('app');

/* ---------- API-клиент ---------- */
async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Истёкшая сессия (401) или блокировка учётной записи в течение сессии (403) —
    // токен больше не действует, возвращаем на экран входа.
    if (state.token && (res.status === 401 || (res.status === 403 && /заблокир/i.test(data.error || '')))) logout();
    throw new Error(data.error || 'Не удалось выполнить запрос');
  }
  return data;
}

/* ---------- Мелкие утилиты ---------- */
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Метки времени приходят из БД в UTC ('YYYY-MM-DD HH:MM' без зоны). Явно трактуем
// строку как UTC (дописываем 'Z'), чтобы toLocaleString показал корректное местное время.
const parseUtc = (v) => {
  const s = String(v).replace(' ', 'T');
  return new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(s) ? s : s + 'Z');
};
const fmtDate = (v, withTime = true) => {
  if (!v) return '—';
  const d = parseUtc(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const fmtPhone = (p) => String(p || '').replace(/^(\+\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3-$4-$5');

const STATUS_LABEL = {
  draft: 'Анкета не заполнена',
  pending: 'На рассмотрении',
  approved: 'Одобрен',
  rejected: 'Отклонен',
  revision: 'Нужна доработка',
};
const STATUS_TONE = { approved: 'pine', pending: 'amber', rejected: 'danger', revision: 'amber', draft: '' };
const TYPE_LABEL = { organization: 'Организация (14+)', party: 'Партийное крыло (18+)' };
const EVENT_STATUS = {
  draft: 'Черновик',
  published: 'Открыта запись',
  ongoing: 'Идет',
  finished: 'Завершено',
  cancelled: 'Отменено',
};
const REG_STATUS = { signed_up: 'Записан', accepted: 'В команде', rejected: 'Отклонен', cancelled: 'Запись отменена' };
const ROLE_LABEL = { volunteer: 'Волонтер', coordinator: 'Координатор', admin: 'Администратор' };

function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 4200);
}

/** Счетчик часов — фирменный элемент: 10 сегментов, шаг задается максимумом. */
function meter(hours, cap = 100) {
  const filled = Math.min(10, Math.round((hours / cap) * 10));
  return `<div class="meter">${Array.from({ length: 10 }, (_, i) =>
    `<i class="${i < filled ? (i === 9 ? 'cap' : 'on') : ''}"></i>`
  ).join('')}</div>`;
}

const skillTitle = (key) => {
  for (const d of state.dict?.directions || []) {
    const s = d.skills.find((x) => x.key === key);
    if (s) return s.title;
  }
  return key;
};
const directionTitle = (key) => (state.dict?.directions || []).find((d) => d.key === key)?.title || key;

/* ---------- Навигация ---------- */
const NAV = {
  volunteer: [
    ['#/profile', 'Личный кабинет'],
    ['#/events', 'Мероприятия'],
    ['#/notifications', 'Уведомления'],
  ],
  coordinator: [
    ['#/teams', 'Мои мероприятия'],
    ['#/team', 'Моя команда'],
    ['#/notifications', 'Уведомления'],
    ['#/profile', 'Профиль'],
  ],
  admin: [
    ['#/admin', 'Аналитика'],
    ['#/moderation', 'Заявки'],
    ['#/base', 'База волонтеров'],
    ['#/match', 'Подбор'],
    ['#/manage-events', 'Мероприятия'],
    ['#/users', 'Пользователи'],
    ['#/notifications', 'Уведомления'],
  ],
};

function layout(inner) {
  const route = location.hash || '#/';
  const links = NAV[state.user.role]
    .map(
      ([href, title]) =>
        `<a href="${href}" ${route.startsWith(href) ? 'aria-current="page"' : ''}>${title}${
          href === '#/notifications' && state.unread ? '<span class="dot"></span>' : ''
        }</a>`
    )
    .join('');

  return `
    <div class="shell">
      <aside class="rail">
        <div class="brand">Платформа<br />волонтеров<span>${ROLE_LABEL[state.user.role]}</span></div>
        <nav>${links}</nav>
        <div class="rail-foot">
          <div class="who">${esc(state.user.full_name || fmtPhone(state.user.phone))}</div>
          <button class="btn-quiet" id="theme-toggle" style="color:#c9ddd5">Сменить тему</button>
          <button class="btn-ghost btn-sm" id="logout" style="color:#c9ddd5;border-color:rgba(255,255,255,.2)">Выйти</button>
        </div>
      </aside>
      <main class="main">${inner}</main>
    </div>`;
}

function render(html, { bare = false } = {}) {
  app().innerHTML = bare ? html : layout(html);
  if (!bare) {
    $('#logout').onclick = logout;
    $('#theme-toggle').onclick = toggleTheme;
  }
  window.scrollTo(0, 0);
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  location.hash = '#/login';
  route();
}

/* ============================================================
   ЭКРАН АВТОРИЗАЦИИ
   ============================================================ */
function authScreen(tab = 'login') {
  render(
    `
    <div class="auth">
      <section class="auth-art">
        <div class="brand" style="font-family:var(--font-display);font-weight:800">Платформа волонтеров</div>
        <div>
          <h1>Команда, которую <em>видно</em> целиком</h1>
          <p style="color:#a8c5ba;max-width:44ch;margin-top:14px">
            Анкеты, мероприятия, часы и координаторы — в одной системе вместо таблицы.
          </p>
        </div>
        <div class="stat-strip">
          <div><span>3</span><small>роли доступа</small></div>
          <div><span>14+</span><small>минимальный возраст</small></div>
          <div><span>1</span><small>база волонтеров</small></div>
        </div>
      </section>
      <section class="auth-form">
        <div class="card">
          <div class="tabs" role="tablist">
            <button role="tab" aria-selected="${tab === 'login'}" data-tab="login">Вход</button>
            <button role="tab" aria-selected="${tab === 'register'}" data-tab="register">Регистрация</button>
            <button role="tab" aria-selected="${tab === 'reset'}" data-tab="reset">Восстановить</button>
          </div>
          <div id="auth-body"></div>
        </div>
      </section>
    </div>`,
    { bare: true }
  );

  app().querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => authScreen(b.dataset.tab)));
  ({ login: loginForm, register: registerForm, reset: resetForm })[tab]();
}

function loginForm() {
  $('#auth-body').innerHTML = `
    <div class="field"><label for="phone">Номер телефона</label><input id="phone" type="tel" placeholder="+7 701 000 00 01" autocomplete="username" /></div>
    <div class="field"><label for="password">Пароль</label><input id="password" type="password" autocomplete="current-password" /></div>
    <button id="submit" style="width:100%">Войти</button>
    <p class="hint" style="margin-top:12px">Демо-доступ: +7 701 000 00 01 / password123</p>`;

  const submit = async () => {
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { phone: $('#phone').value, password: $('#password').value },
      });
      state.token = data.token;
      localStorage.setItem('token', data.token);
      state.user = data.user;
      location.hash = homeFor(data.user);
      await route();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
  $('#submit').onclick = submit;
  $('#auth-body').onkeydown = (e) => e.key === 'Enter' && submit();
}

function registerForm() {
  $('#auth-body').innerHTML = `
    <div class="field"><label for="phone">Номер телефона</label><input id="phone" type="tel" placeholder="+7 700 000 00 00" /></div>
    <button id="send-code" class="btn-ghost" style="width:100%">Получить код</button>
    <div id="step2" hidden style="margin-top:14px">
      <div class="field"><label for="code">Код из SMS</label><input id="code" inputmode="numeric" maxlength="6" /></div>
      <div class="field"><label for="name">Имя и фамилия</label><input id="name" /></div>
      <div class="field"><label for="password">Пароль</label><input id="password" type="password" /><div class="hint">Минимум 8 символов</div></div>
      <button id="submit" style="width:100%">Создать аккаунт</button>
    </div>`;

  $('#send-code').onclick = async () => {
    try {
      const data = await api('/auth/request-code', { method: 'POST', body: { phone: $('#phone').value, purpose: 'register' } });
      $('#step2').hidden = false;
      toast(data.devCode ? `Код для входа в демо: ${data.devCode}` : 'Код отправлен на телефон');
      if (data.devCode) $('#code').value = data.devCode;
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  $('#submit').onclick = async () => {
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: {
          phone: $('#phone').value,
          code: $('#code').value,
          password: $('#password').value,
          full_name: $('#name').value,
        },
      });
      state.token = data.token;
      localStorage.setItem('token', data.token);
      state.user = data.user;
      location.hash = '#/onboarding';
      await route();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

function resetForm() {
  $('#auth-body').innerHTML = `
    <div class="field"><label for="phone">Номер телефона</label><input id="phone" type="tel" /></div>
    <button id="send-code" class="btn-ghost" style="width:100%">Получить код</button>
    <div id="step2" hidden style="margin-top:14px">
      <div class="field"><label for="code">Код из SMS</label><input id="code" inputmode="numeric" maxlength="6" /></div>
      <div class="field"><label for="password">Новый пароль</label><input id="password" type="password" /></div>
      <button id="submit" style="width:100%">Сохранить пароль</button>
    </div>`;

  $('#send-code').onclick = async () => {
    try {
      const data = await api('/auth/request-code', { method: 'POST', body: { phone: $('#phone').value, purpose: 'reset' } });
      $('#step2').hidden = false;
      if (data.devCode) $('#code').value = data.devCode;
      toast(data.devCode ? `Код для входа в демо: ${data.devCode}` : 'Код отправлен на телефон');
    } catch (e) {
      toast(e.message, 'err');
    }
  };
  $('#submit').onclick = async () => {
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { phone: $('#phone').value, code: $('#code').value, password: $('#password').value },
      });
      toast('Пароль обновлен. Войдите с новым паролем');
      authScreen('login');
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

/* ============================================================
   ВОЛОНТЕР: выбор типа, анкета, кабинет, мероприятия
   ============================================================ */
function onboardingPage() {
  const types = state.dict.volunteer_types;
  render(`
    <div class="page-head"><div><h1>Выберите тип волонтерства</h1>
      <div class="sub">От типа зависит анкета и доступные направления. Изменить выбор позже можно только через администратора.</div></div></div>
    <div class="grid cols-2">
      ${types
        .map(
          (t) => `<article class="card">
            <span class="tag pine">${t.min_age}+</span>
            <h2 style="margin:10px 0 6px">${esc(t.title)}</h2>
            <p class="muted small">${
              t.key === 'organization'
                ? 'Городские акции, помощь на мероприятиях, медиа и IT-задачи организации.'
                : 'Работа партийного крыла: только для совершеннолетних участников.'
            }</p>
            <button data-type="${t.key}" style="margin-top:10px">Выбрать</button>
          </article>`
        )
        .join('')}
    </div>
    <div class="card" style="margin-top:14px">
      <div class="field" style="max-width:280px"><label for="bd">Дата рождения</label>
        <input id="bd" type="date" value="${state.user.birth_date || ''}" />
        <div class="hint">Возраст проверяется автоматически.</div></div>
    </div>`);

  app().querySelectorAll('[data-type]').forEach((btn) => {
    btn.onclick = async () => {
      try {
        const data = await api('/applications/type', {
          method: 'POST',
          body: { volunteer_type: btn.dataset.type, birth_date: $('#bd').value },
        });
        state.user = data.user;
        location.hash = '#/application';
        route();
      } catch (e) {
        toast(e.message, 'err');
      }
    };
  });
}

async function applicationPage() {
  const { application } = await api('/applications/mine');
  if (state.user.application_status === 'pending') {
    location.hash = '#/profile';
    return route();
  }
  const d = state.dict;
  const prev = application || {};
  const checkGroup = (name, values, selected = []) =>
    `<div class="chips" data-group="${name}">${values
      .map(
        (v) =>
          `<button type="button" class="chip" data-value="${esc(v.key ?? v)}" aria-pressed="${
            selected.includes(v.key ?? v) ? 'true' : 'false'
          }">${esc(v.title ?? v)}</button>`
      )
      .join('')}</div>`;

  render(`
    <div class="page-head"><div><h1>Анкета волонтера</h1>
      <div class="sub">${TYPE_LABEL[state.user.volunteer_type] || ''} · после отправки заявка уходит на рассмотрение</div></div></div>
    ${
      prev.review_comment && ['rejected', 'revision'].includes(state.user.application_status)
        ? `<div class="notice warn">Комментарий администратора: ${esc(prev.review_comment)}</div>`
        : ''
    }
    <form id="form" autocomplete="on">
      <fieldset><legend>Личные данные</legend>
        <div class="grid cols-2">
          <div class="field"><label for="full_name">ФИО</label><input id="full_name" required value="${esc(state.user.full_name || '')}" /></div>
          <div class="field"><label for="birth_date">Дата рождения</label><input id="birth_date" type="date" required value="${esc(state.user.birth_date || '')}" /></div>
          <div class="field"><label for="gender">Пол</label><select id="gender">
            <option value="">Не указывать</option>
            <option value="female" ${state.user.gender === 'female' ? 'selected' : ''}>Женский</option>
            <option value="male" ${state.user.gender === 'male' ? 'selected' : ''}>Мужской</option></select></div>
          <div class="field"><label for="city">Город</label><input id="city" required value="${esc(state.user.city || '')}" /></div>
          <div class="field"><label for="email">Почта</label><input id="email" type="email" value="${esc(state.user.email || '')}" /></div>
          <div class="field"><label for="phone_ro">Телефон</label><input id="phone_ro" value="${fmtPhone(state.user.phone)}" disabled /></div>
        </div>
      </fieldset>

      <fieldset><legend>Образование и занятость</legend>
        <div class="grid cols-2">
          <div class="field"><label for="education">Образование</label><input id="education" value="${esc(prev.education || '')}" placeholder="Например: студент 3 курса" /></div>
          <div class="field"><label for="occupation">Кем работаете или учитесь</label><input id="occupation" value="${esc(prev.occupation || '')}" /></div>
        </div>
        <label>Языки</label>${checkGroup('languages', d.languages, prev.languages || [])}
      </fieldset>

      <fieldset><legend>Направления деятельности</legend>
        <div class="hint" style="margin-bottom:8px">Выберите минимум одно направление.</div>
        ${checkGroup('directions', d.directions.map((x) => ({ key: x.key, title: x.title })), prev.directions || [])}
      </fieldset>

      <fieldset><legend>Навыки и компетенции</legend>
        ${d.directions
          .map(
            (dir) => `<div style="margin-bottom:12px"><label>${esc(dir.title)}</label>
              ${checkGroup(`skills:${dir.key}`, dir.skills, prev.skills || [])}</div>`
          )
          .join('')}
      </fieldset>

      <fieldset><legend>Личные качества</legend>${checkGroup('qualities', d.qualities, prev.qualities || [])}</fieldset>

      <fieldset><legend>Интересы, цели, мотивация</legend>
        <div class="field"><label for="interests">Интересующие темы (через запятую)</label><input id="interests" value="${esc((prev.interests || []).join(', '))}" placeholder="экология, образование, спорт" /></div>
        <div class="field"><label for="goals">Цели участия</label><textarea id="goals">${esc(prev.goals || '')}</textarea></div>
        <div class="field"><label for="motivation">Мотивация</label><textarea id="motivation" required>${esc(prev.motivation || '')}</textarea></div>
        <div class="field"><label for="experience">Опыт волонтерства</label><textarea id="experience">${esc(prev.experience || '')}</textarea></div>
      </fieldset>

      <fieldset><legend>Возможности</legend>
        <div class="grid cols-2">
          <div>
            <label class="checkline"><input type="checkbox" id="has_car" ${prev.has_car ? 'checked' : ''} /> Есть автомобиль</label>
            <label class="checkline"><input type="checkbox" id="has_laptop" ${prev.has_laptop ? 'checked' : ''} /> Есть ноутбук</label>
          </div>
          <div class="field"><label for="free_time">Свободное время</label><select id="free_time">
            ${d.free_time.map((f) => `<option value="${f.key}" ${prev.free_time === f.key ? 'selected' : ''}>${esc(f.title)}</option>`).join('')}
          </select></div>
        </div>
      </fieldset>

      <button id="submit" type="button">Отправить на рассмотрение</button>
    </form>`);

  app().querySelectorAll('.chip').forEach((chip) => {
    chip.onclick = () => chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
  });

  const collect = (prefix) =>
    [...app().querySelectorAll(`[data-group^="${prefix}"] .chip[aria-pressed="true"]`)].map((c) => c.dataset.value);

  $('#submit').onclick = async () => {
    try {
      const data = await api('/applications', {
        method: 'POST',
        body: {
          full_name: $('#full_name').value,
          birth_date: $('#birth_date').value,
          gender: $('#gender').value || null,
          city: $('#city').value,
          email: $('#email').value,
          education: $('#education').value,
          occupation: $('#occupation').value,
          languages: collect('languages'),
          directions: collect('directions'),
          skills: collect('skills:'),
          qualities: collect('qualities'),
          interests: $('#interests').value.split(',').map((s) => s.trim()).filter(Boolean),
          goals: $('#goals').value,
          motivation: $('#motivation').value,
          experience: $('#experience').value,
          has_car: $('#has_car').checked,
          has_laptop: $('#has_laptop').checked,
          free_time: $('#free_time').value,
        },
      });
      state.user = data.user;
      toast('Анкета отправлена. Решение придет в уведомления');
      location.hash = '#/profile';
      route();
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

async function profilePage() {
  const data = await api('/profile');
  const u = data.user;
  const app_ = data.application;

  render(`
    <div class="page-head">
      <div><h1>${esc(u.full_name || 'Личный кабинет')}</h1>
        <div class="sub">${fmtPhone(u.phone)} · ${esc(u.city || 'город не указан')} ${u.age ? `· ${u.age} лет` : ''}</div></div>
      <div class="row">
        <span class="tag ${STATUS_TONE[u.application_status]}">${STATUS_LABEL[u.application_status]}</span>
        ${u.volunteer_type ? `<span class="tag">${TYPE_LABEL[u.volunteer_type]}</span>` : ''}
      </div>
    </div>

    ${
      u.role === 'volunteer' && u.application_status !== 'approved'
        ? `<div class="notice ${u.application_status === 'pending' ? 'info' : 'warn'}">
             ${
               u.application_status === 'pending'
                 ? 'Анкета на рассмотрении. Доступ к мероприятиям откроется после одобрения.'
                 : u.application_status === 'draft'
                 ? `Заполните анкету, чтобы получить доступ к мероприятиям. <a href="#/${u.volunteer_type ? 'application' : 'onboarding'}">Перейти к анкете</a>`
                 : `${esc(app_?.review_comment || 'Заявка отклонена.')} <a href="#/application">Заполнить анкету заново</a>`
             }
           </div>`
        : ''
    }

    <div class="grid cols-3">
      <div class="card metric"><div class="label">Волонтерских часов</div>
        <div class="value">${u.total_hours}<small> ч</small></div>${meter(u.total_hours)}</div>
      <div class="card metric"><div class="label">Мероприятий пройдено</div><div class="value">${u.events_count}</div></div>
      <div class="card metric"><div class="label">Координатор</div>
        <div class="value" style="font-size:17px;margin-top:10px">${esc(u.coordinator?.full_name || 'Не закреплен')}</div>
        ${u.coordinator ? `<div class="small muted">${fmtPhone(u.coordinator.phone)}</div>` : ''}</div>
    </div>

    <div class="grid cols-2" style="margin-top:14px">
      <section class="card">
        <div class="spread"><h2>Ближайшие мероприятия</h2><a class="btn btn-ghost btn-sm" href="#/events">Все</a></div>
        ${
          data.upcoming.length
            ? `<div class="stack" style="margin-top:12px">${data.upcoming
                .map(
                  (h) => `<div class="spread" style="border-bottom:1px solid var(--line);padding-bottom:10px">
                    <div><strong>${esc(h.title)}</strong><div class="small muted">${fmtDate(h.starts_at)} · ${esc(h.location || '')}</div></div>
                    <span class="tag ${h.status === 'accepted' ? 'pine' : 'amber'}">${REG_STATUS[h.status]}</span></div>`
                )
                .join('')}</div>`
            : '<div class="empty"><strong>Пока пусто</strong>Записывайтесь на мероприятия — они появятся здесь.</div>'
        }
      </section>

      <section class="card">
        <h2>Достижения</h2>
        <div class="chips" style="margin-top:12px">
          ${data.achievements
            .map((a) => `<span class="tag ${a.earned ? 'amber' : ''}" style="${a.earned ? '' : 'opacity:.45'}">${esc(a.title)}</span>`)
            .join('')}
        </div>
        <h3 style="margin-top:18px">Начисление часов</h3>
        <div class="stack small" style="margin-top:8px">
          ${
            data.hours.length
              ? data.hours
                  .slice(0, 6)
                  .map((h) => `<div class="spread"><span class="muted">${esc(h.event_title || h.reason || 'Начисление')}</span><strong>+${h.hours} ч</strong></div>`)
                  .join('')
              : '<span class="muted">Часы появятся после первого мероприятия.</span>'
          }
        </div>
      </section>
    </div>

    <section class="card" style="margin-top:14px">
      <h2>История участия</h2>
      ${
        data.history.length
          ? `<div class="table-wrap" style="margin-top:12px;border:none">
              <table><thead><tr><th>Мероприятие</th><th>Дата</th><th>Статус</th><th>Явка</th><th>Часы</th></tr></thead>
              <tbody>${data.history
                .map(
                  (h) => `<tr><td>${esc(h.title)}</td><td class="muted">${fmtDate(h.starts_at, false)}</td>
                    <td><span class="tag">${REG_STATUS[h.status]}</span></td>
                    <td>${h.attendance === 'present' ? 'был' : h.attendance === 'absent' ? '<span class="muted">не был</span>' : '—'}</td>
                    <td><strong>${h.hours || 0}</strong></td></tr>`
                )
                .join('')}</tbody></table></div>`
          : '<div class="empty"><strong>История пуста</strong>Здесь появятся мероприятия, в которых вы участвовали.</div>'
      }
    </section>

    <section class="card" style="margin-top:14px">
      <h2>Личные данные</h2>
      <div class="grid cols-3" style="margin-top:12px">
        <div class="field"><label for="p_name">ФИО</label><input id="p_name" value="${esc(u.full_name || '')}" /></div>
        <div class="field"><label for="p_city">Город</label><input id="p_city" value="${esc(u.city || '')}" /></div>
        <div class="field"><label for="p_email">Почта</label><input id="p_email" type="email" value="${esc(u.email || '')}" /></div>
      </div>
      <div class="row">
        <button id="save-profile">Сохранить изменения</button>
        <button id="open-password" class="btn-ghost">Сменить пароль</button>
      </div>
    </section>`);

  $('#save-profile').onclick = async () => {
    try {
      const res = await api('/profile', {
        method: 'PATCH',
        body: { full_name: $('#p_name').value, city: $('#p_city').value, email: $('#p_email').value },
      });
      state.user = res.user;
      toast('Изменения сохранены');
      route();
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  $('#open-password').onclick = () =>
    modal(
      'Смена пароля',
      `<div class="field"><label for="cur">Текущий пароль</label><input id="cur" type="password" /></div>
       <div class="field"><label for="next">Новый пароль</label><input id="next" type="password" /></div>`,
      async () => {
        await api('/auth/change-password', {
          method: 'POST',
          body: { current_password: $('#cur').value, new_password: $('#next').value },
        });
        toast('Пароль изменен');
      }
    );
}

async function eventsPage() {
  const period = new URLSearchParams(location.hash.split('?')[1] || '').get('period') || 'upcoming';
  const { items } = await api(`/events?period=${period}`);

  render(`
    <div class="page-head">
      <div><h1>Мероприятия</h1><div class="sub">Отменить запись можно не позднее чем за ${state.dict.cancel_deadline_hours} ч до начала.</div></div>
      <div class="tabs" style="width:240px;margin:0">
        <button aria-selected="${period === 'upcoming'}" data-period="upcoming">Предстоящие</button>
        <button aria-selected="${period === 'past'}" data-period="past">Прошедшие</button>
      </div>
    </div>
    ${
      items.length
        ? `<div class="grid cols-2">${items.map(eventCard).join('')}</div>`
        : '<div class="card empty"><strong>Мероприятий нет</strong>Как только появится анонс, он придет в уведомления.</div>'
    }`);

  app().querySelectorAll('[data-period]').forEach((b) => (b.onclick = () => (location.hash = `#/events?period=${b.dataset.period}`)));
  app().querySelectorAll('[data-signup]').forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/events/${b.dataset.signup}/signup`, { method: 'POST' });
          toast('Вы записаны. Координатор подтвердит участие');
          route();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
  );
  app().querySelectorAll('[data-cancel]').forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/events/${b.dataset.cancel}/cancel`, { method: 'POST' });
          toast('Запись отменена');
          route();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
  );
}

function eventCard(e) {
  const reg = e.my_registration;
  const registered = reg && reg.status !== 'cancelled';
  const full = e.accepted_count >= e.needed_count;
  return `<article class="card">
    <div class="spread">
      <span class="tag ${e.status === 'published' ? 'pine' : ''}">${EVENT_STATUS[e.status]}</span>
      <span class="small muted">${e.signed_up_count} / ${e.needed_count} набрано</span>
    </div>
    <h2 style="margin:10px 0 6px">${esc(e.title)}</h2>
    <div class="small muted">${fmtDate(e.starts_at)} · ${esc(e.location || 'место уточняется')}${e.city ? `, ${esc(e.city)}` : ''}</div>
    <p class="small" style="margin-top:10px">${esc(e.description || '')}</p>
    ${e.requirements ? `<div class="small muted">Требования: ${esc(e.requirements)}</div>` : ''}
    <div class="chips" style="margin-top:10px">${e.directions.map((d) => `<span class="tag">${esc(directionTitle(d))}</span>`).join('')}</div>
    <div class="spread" style="margin-top:14px">
      <span class="small muted">Координатор: ${esc(e.coordinator?.full_name || 'не назначен')}</span>
      ${
        state.user.role !== 'volunteer'
          ? ''
          : registered
          ? `<div class="row"><span class="tag ${reg.status === 'accepted' ? 'pine' : 'amber'}">${REG_STATUS[reg.status]}</span>
             ${reg.status !== 'rejected' && e.status === 'published' ? `<button class="btn-ghost btn-sm" data-cancel="${e.id}">Отменить запись</button>` : ''}</div>`
          : e.status === 'published'
          ? `<button class="btn-sm" data-signup="${e.id}" ${full ? 'disabled title="Команда набрана"' : ''}>Записаться</button>`
          : ''
      }
    </div>
  </article>`;
}

async function notificationsPage() {
  const { items } = await api('/profile/notifications');
  render(`
    <div class="page-head"><div><h1>Уведомления</h1><div class="sub">${items.filter((n) => !n.is_read).length} непрочитанных</div></div>
      <button id="read-all" class="btn-ghost">Отметить все прочитанными</button></div>
    ${
      items.length
        ? `<div class="stack">${items
            .map(
              (n) => `<article class="card" style="${n.is_read ? 'opacity:.65' : 'border-left:3px solid var(--amber)'}">
                <div class="spread"><strong>${esc(n.title)}</strong><span class="small muted">${fmtDate(n.created_at)}</span></div>
                <p class="small muted" style="margin:6px 0 0">${esc(n.body || '')}</p>
                ${n.link ? `<a class="small" href="${esc(n.link)}">Открыть</a>` : ''}</article>`
            )
            .join('')}</div>`
        : '<div class="card empty"><strong>Уведомлений нет</strong>Здесь появятся новости о заявке, мероприятиях и часах.</div>'
    }`);

  $('#read-all').onclick = async () => {
    await api('/profile/notifications/read', { method: 'POST', body: {} });
    await refreshUnread();
    route();
  };
}

/* ============================================================
   КООРДИНАТОР
   ============================================================ */
async function coordinatorEventsPage() {
  const data = await api('/coordinator/events');
  const card = (e) => `<article class="card">
      <div class="spread"><span class="tag ${e.status === 'published' ? 'pine' : ''}">${EVENT_STATUS[e.status]}</span>
        <span class="small muted">${e.accepted_count} в команде из ${e.needed_count}</span></div>
      <h2 style="margin:10px 0 4px">${esc(e.title)}</h2>
      <div class="small muted">${fmtDate(e.starts_at)} · ${esc(e.location || '')}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn-sm" data-open="${e.id}">Состав команды</button>
        <span class="small muted">${e.signed_up_count} заявок</span>
      </div>
    </article>`;

  render(`
    <div class="page-head"><div><h1>Мои мероприятия</h1><div class="sub">Подтверждайте участников, отмечайте явку и начисляйте часы.</div></div></div>
    <h2 style="margin-bottom:10px">Предстоящие</h2>
    ${
      data.upcoming.length
        ? `<div class="grid cols-2">${data.upcoming.map(card).join('')}</div>`
        : '<div class="card empty"><strong>Пока ничего не закреплено</strong>Администратор назначит вас координатором мероприятия.</div>'
    }
    <h2 style="margin:22px 0 10px">Прошедшие</h2>
    ${data.past.length ? `<div class="grid cols-2">${data.past.map(card).join('')}</div>` : '<div class="card empty">История пуста.</div>'}`);

  app().querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => (location.hash = `#/teams/${b.dataset.open}`)));
}

async function eventTeamPage(eventId) {
  const data = await api(`/coordinator/events/${eventId}/registrations`);
  const e = data.event;
  const rows = data.items
    .map(
      (r) => `<tr data-reg="${r.id}">
        <td><strong>${esc(r.volunteer.full_name || '—')}</strong><div class="small muted">${fmtPhone(r.volunteer.phone)} · ${esc(r.volunteer.city || '')}</div></td>
        <td>${r.volunteer.skills.slice(0, 3).map((s) => `<span class="tag">${esc(skillTitle(s))}</span>`).join(' ') || '<span class="muted">—</span>'}</td>
        <td class="small muted">${r.volunteer.total_hours} ч · ${r.volunteer.events_count} мер.</td>
        <td><span class="tag ${r.status === 'accepted' ? 'pine' : r.status === 'rejected' ? 'danger' : 'amber'}">${REG_STATUS[r.status]}</span></td>
        <td>
          ${
            r.status === 'accepted'
              ? `<div class="row">
                  <select class="btn-sm" data-att="${r.id}" style="width:120px">
                    <option value="">Явка</option>
                    <option value="present" ${r.attendance === 'present' ? 'selected' : ''}>Был</option>
                    <option value="absent" ${r.attendance === 'absent' ? 'selected' : ''}>Не был</option>
                  </select>
                  <input type="number" min="0" max="24" step="0.5" value="${r.hours || ''}" placeholder="ч" data-hours="${r.id}" style="width:70px" />
                  <button class="btn-sm" data-save="${r.id}">Сохранить</button>
                </div>`
              : `<div class="row">
                  <button class="btn-sm" data-accept="${r.id}">Принять</button>
                  <button class="btn-sm btn-ghost" data-reject="${r.id}">Отклонить</button>
                </div>`
          }
        </td>
      </tr>`
    )
    .join('');

  render(`
    <div class="page-head">
      <div><h1>${esc(e.title)}</h1>
        <div class="sub">${fmtDate(e.starts_at)} · ${esc(e.location || '')} · нужно ${e.needed_count} волонтеров, принято ${e.accepted_count}</div></div>
      <div class="row"><a class="btn btn-ghost btn-sm" href="#/teams">Назад</a>
        ${e.status !== 'finished' ? '<button id="close-event" class="btn-amber btn-sm">Завершить и начислить часы</button>' : ''}</div>
    </div>
    ${
      data.items.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Волонтер</th><th>Навыки</th><th>Опыт</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>${rows}</tbody></table></div>`
        : '<div class="card empty"><strong>Заявок пока нет</strong>Волонтеры увидят анонс и запишутся.</div>'
    }`);

  const decide = async (regId, decision) => {
    try {
      await api(`/coordinator/registrations/${regId}/decision`, { method: 'POST', body: { decision } });
      toast(decision === 'accept' ? 'Волонтер в команде' : 'Заявка отклонена');
      route();
    } catch (e2) {
      toast(e2.message, 'err');
    }
  };
  app().querySelectorAll('[data-accept]').forEach((b) => (b.onclick = () => decide(b.dataset.accept, 'accept')));
  app().querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => decide(b.dataset.reject, 'reject')));

  app().querySelectorAll('[data-save]').forEach(
    (b) =>
      (b.onclick = async () => {
        const id = b.dataset.save;
        const attendance = $(`[data-att="${id}"]`).value;
        if (!attendance) return toast('Отметьте явку', 'err');
        try {
          await api(`/coordinator/registrations/${id}/attendance`, {
            method: 'POST',
            body: { attendance, hours: Number($(`[data-hours="${id}"]`).value || 0) },
          });
          toast('Сохранено. Часы ушли в профиль волонтера');
          route();
        } catch (e2) {
          toast(e2.message, 'err');
        }
      })
  );

  const closeBtn = $('#close-event');
  if (closeBtn)
    closeBtn.onclick = () =>
      modal(
        'Завершить мероприятие',
        `<p class="small muted">Отмеченные явка и часы будут сохранены, мероприятие получит статус «Завершено».</p>
         <div class="field"><label for="def-hours">Часы по умолчанию для присутствовавших</label><input id="def-hours" type="number" min="0" max="24" step="0.5" value="4" /></div>`,
        async () => {
          const hours = Number($('#def-hours').value || 0);
          const items = data.items
            .filter((r) => r.status === 'accepted')
            .map((r) => ({
              registration_id: r.id,
              attendance: r.attendance || 'present',
              hours: r.hours || ((r.attendance || 'present') === 'present' ? hours : 0),
            }));
          await api(`/coordinator/events/${eventId}/close`, { method: 'POST', body: { items } });
          toast('Мероприятие завершено, часы начислены');
          route();
        }
      );
}

async function teamPage() {
  const data = await api('/coordinator/team');
  render(`
    <div class="page-head"><div><h1>Моя команда</h1><div class="sub">Волонтеры, закрепленные за вами администратором.</div></div></div>
    <div class="grid cols-4">
      <div class="card metric"><div class="label">В команде</div><div class="value">${data.stats.members_count}</div></div>
      <div class="card metric"><div class="label">Мероприятий</div><div class="value">${data.stats.events_total}</div></div>
      <div class="card metric"><div class="label">Предстоящих</div><div class="value">${data.stats.upcoming_events}</div></div>
      <div class="card metric"><div class="label">Часов команды</div><div class="value">${data.stats.team_hours}<small> ч</small></div></div>
    </div>
    <div class="table-wrap" style="margin-top:14px">
      <table><thead><tr><th>Волонтер</th><th>Город</th><th>Тип</th><th>Часы</th><th>Мероприятий</th><th>Последнее участие</th></tr></thead>
        <tbody>${
          data.members.length
            ? data.members
                .map(
                  (m) => `<tr><td><strong>${esc(m.full_name || '—')}</strong><div class="small muted">${fmtPhone(m.phone)}</div></td>
                    <td class="muted">${esc(m.city || '—')}</td>
                    <td><span class="tag">${TYPE_LABEL[m.volunteer_type] || '—'}</span></td>
                    <td><strong>${m.total_hours}</strong>${meter(m.total_hours)}</td>
                    <td>${m.events_count}</td>
                    <td class="muted small">${fmtDate(m.last_event_at, false)}</td></tr>`
                )
                .join('')
            : '<tr><td colspan="6"><div class="empty"><strong>Команда пуста</strong>Администратор закрепит за вами волонтеров.</div></td></tr>'
        }</tbody></table>
    </div>`);
}

/* ============================================================
   АДМИНИСТРАТОР
   ============================================================ */
async function dashboardPage() {
  const d = await api('/analytics/dashboard');
  const t = d.totals;
  const maxMonth = Math.max(1, ...d.registrations_by_month.map((m) => m.count));
  const monthName = (m) => {
    const [y, mm] = m.split('-');
    return new Date(y, mm - 1).toLocaleDateString('ru-RU', { month: 'short' });
  };

  render(`
    <div class="page-head"><div><h1>Аналитика</h1><div class="sub">Сводка по волонтерам, мероприятиям и часам в реальном времени.</div></div>
      <a class="btn btn-ghost btn-sm" href="#/moderation">Заявки: ${t.new_applications}</a></div>

    <div class="grid cols-4">
      <div class="card metric"><div class="label">Всего волонтеров</div><div class="value">${t.volunteers_total}</div></div>
      <div class="card metric"><div class="label">Новых заявок</div><div class="value" style="color:var(--amber)">${t.new_applications}</div></div>
      <div class="card metric"><div class="label">Активных за 90 дней</div><div class="value">${t.active_volunteers}</div></div>
      <div class="card metric"><div class="label">Координаторов</div><div class="value">${t.coordinators_total}</div></div>
      <div class="card metric"><div class="label">Проведено мероприятий</div><div class="value">${t.events_finished}</div></div>
      <div class="card metric"><div class="label">Предстоящих</div><div class="value">${t.events_upcoming}</div></div>
      <div class="card metric"><div class="label">Волонтерских часов</div><div class="value">${t.hours_total}<small> ч</small></div>${meter(t.hours_total, Math.max(100, t.hours_total))}</div>
      <div class="card metric"><div class="label">Часов на волонтера</div><div class="value">${t.avg_hours_per_volunteer}<small> ч</small></div></div>
    </div>

    <div class="grid cols-2" style="margin-top:14px">
      <section class="card">
        <h2>Регистрации по месяцам</h2>
        <div class="bars">${d.registrations_by_month
          .map(
            (m) => `<div title="${m.month}: ${m.count}">
              <span class="b" style="height:${Math.round((m.count / maxMonth) * 100)}%"></span>
              <span class="l">${monthName(m.month)}</span></div>`
          )
          .join('')}</div>
      </section>
      <section class="card">
        <h2>Участники по направлениям</h2>
        <div class="stack" style="margin-top:12px">
          ${d.by_direction
            .map(
              (x) => `<div><div class="spread small"><span>${esc(x.title)}</span><strong>${x.count}</strong></div>
                <div style="height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin-top:4px">
                  <div style="height:100%;width:${Math.round((x.count / Math.max(...d.by_direction.map((y) => y.count))) * 100)}%;background:var(--pine)"></div>
                </div></div>`
            )
            .join('')}
        </div>
      </section>
    </div>

    <div class="grid cols-2" style="margin-top:14px">
      <section class="card">
        <h2>Самые активные волонтеры</h2>
        <div class="table-wrap" style="border:none;margin-top:8px">
          <table><tbody>${
            d.top_volunteers
              .map(
                (v, i) => `<tr><td style="width:28px" class="muted">${i + 1}</td>
                  <td><strong>${esc(v.full_name || '—')}</strong><div class="small muted">${esc(v.city || '')}</div></td>
                  <td style="text-align:right"><strong>${v.total_hours} ч</strong><div class="small muted">${v.events_count} мер.</div></td></tr>`
              )
              .join('') || '<tr><td class="muted">Данных пока нет</td></tr>'
          }</tbody></table>
        </div>
      </section>
      <section class="card">
        <h2>Самые активные координаторы</h2>
        <div class="table-wrap" style="border:none;margin-top:8px">
          <table><tbody>${
            d.top_coordinators
              .map(
                (c, i) => `<tr><td style="width:28px" class="muted">${i + 1}</td>
                  <td><strong>${esc(c.full_name || '—')}</strong><div class="small muted">команда: ${c.team_size}</div></td>
                  <td style="text-align:right"><strong>${c.events_count} мер.</strong><div class="small muted">${c.team_hours} ч</div></td></tr>`
              )
              .join('') || '<tr><td class="muted">Данных пока нет</td></tr>'
          }</tbody></table>
        </div>
      </section>
    </div>`);
}

async function moderationPage() {
  const status = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || 'pending';
  const { items } = await api(`/applications?status=${status}`);

  render(`
    <div class="page-head"><div><h1>Заявки</h1><div class="sub">Одобрение открывает доступ к мероприятиям.</div></div>
      <div class="tabs" style="width:auto;margin:0">
        ${['pending', 'approved', 'rejected', 'revision', 'all']
          .map((s) => `<button aria-selected="${status === s}" data-status="${s}">${STATUS_LABEL[s] || 'Все'}</button>`)
          .join('')}
      </div></div>
    ${
      items.length
        ? `<div class="stack">${items
            .map(
              (a) => `<article class="card">
                <div class="spread">
                  <div><h2>${esc(a.user.full_name || 'Без имени')}</h2>
                    <div class="small muted">${fmtPhone(a.user.phone)} · ${esc(a.user.city || '')} · ${a.user.age ?? '?'} лет · ${TYPE_LABEL[a.volunteer_type]}</div></div>
                  <div class="row"><span class="tag ${STATUS_TONE[a.status]}">${STATUS_LABEL[a.status]}</span>
                    <span class="small muted">${fmtDate(a.submitted_at, false)}</span></div>
                </div>
                <div class="grid cols-2" style="margin-top:12px">
                  <div class="small"><strong>Направления:</strong> ${a.directions.map((x) => esc(directionTitle(x))).join(', ') || '—'}<br />
                    <strong>Навыки:</strong> ${a.skills.map((x) => esc(skillTitle(x))).join(', ') || '—'}<br />
                    <strong>Языки:</strong> ${a.languages.join(', ') || '—'}<br />
                    <strong>Возможности:</strong> ${[a.has_car ? 'авто' : null, a.has_laptop ? 'ноутбук' : null].filter(Boolean).join(', ') || '—'}</div>
                  <div class="small"><strong>Мотивация:</strong> ${esc(a.motivation || '—')}<br />
                    <strong>Опыт:</strong> ${esc(a.experience || '—')}</div>
                </div>
                ${
                  a.status === 'pending'
                    ? `<div class="row" style="margin-top:12px">
                        <button class="btn-sm" data-approve="${a.id}">Одобрить</button>
                        <button class="btn-sm btn-ghost" data-revision="${a.id}">Вернуть на доработку</button>
                        <button class="btn-sm btn-danger" data-reject="${a.id}">Отклонить</button>
                      </div>`
                    : a.review_comment
                    ? `<div class="small muted" style="margin-top:10px">Комментарий: ${esc(a.review_comment)}</div>`
                    : ''
                }
              </article>`
            )
            .join('')}</div>`
        : '<div class="card empty"><strong>Заявок в этом статусе нет</strong>Новые анкеты появятся здесь сразу после отправки.</div>'
    }`);

  app().querySelectorAll('[data-status]').forEach((b) => (b.onclick = () => (location.hash = `#/moderation?status=${b.dataset.status}`)));

  app().querySelectorAll('[data-approve]').forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/applications/${b.dataset.approve}/decision`, { method: 'POST', body: { decision: 'approve' } });
          toast('Заявка одобрена');
          route();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
  );

  const withComment = (id, decision, title) =>
    modal(title, `<div class="field"><label for="cm">Причина — уйдет волонтеру</label><textarea id="cm"></textarea></div>`, async () => {
      await api(`/applications/${id}/decision`, { method: 'POST', body: { decision, comment: $('#cm').value } });
      toast('Решение сохранено');
      route();
    });
  app().querySelectorAll('[data-reject]').forEach((b) => (b.onclick = () => withComment(b.dataset.reject, 'reject', 'Отклонить заявку')));
  app().querySelectorAll('[data-revision]').forEach((b) => (b.onclick = () => withComment(b.dataset.revision, 'revision', 'Вернуть на доработку')));
}

const baseFilters = {};

async function basePage() {
  const q = new URLSearchParams(Object.entries(baseFilters).filter(([, v]) => v !== '' && v != null));
  const { items, total, page, limit } = await api(`/volunteers?${q}`);
  const { items: coordinators } = await api('/dictionaries/coordinators');
  const allSkills = state.dict.directions.flatMap((d) => d.skills);

  render(`
    <div class="page-head"><div><h1>База волонтеров</h1><div class="sub">Найдено: ${total}</div></div>
      <div class="row"><button id="export" class="btn-ghost btn-sm">Выгрузить CSV</button>
        <button id="assign" class="btn-sm">Закрепить координатора</button></div></div>

    <section class="card" style="margin-bottom:14px">
      <div class="grid cols-4">
        <div class="field"><label for="f_search">Поиск по ФИО или телефону</label><input id="f_search" value="${esc(baseFilters.search || '')}" /></div>
        <div class="field"><label for="f_city">Город</label><input id="f_city" value="${esc(baseFilters.city || '')}" /></div>
        <div class="field"><label for="f_status">Статус</label><select id="f_status">
          <option value="">Любой</option>
          ${['approved', 'pending', 'rejected', 'revision', 'draft']
            .map((s) => `<option value="${s}" ${baseFilters.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`)
            .join('')}</select></div>
        <div class="field"><label for="f_type">Тип волонтерства</label><select id="f_type">
          <option value="">Любой</option>
          ${Object.entries(TYPE_LABEL)
            .map(([k, v]) => `<option value="${k}" ${baseFilters.volunteer_type === k ? 'selected' : ''}>${v}</option>`)
            .join('')}</select></div>
        <div class="field"><label for="f_gender">Пол</label><select id="f_gender">
          <option value="">Любой</option>
          <option value="female" ${baseFilters.gender === 'female' ? 'selected' : ''}>Женский</option>
          <option value="male" ${baseFilters.gender === 'male' ? 'selected' : ''}>Мужской</option></select></div>
        <div class="field"><label>Возраст</label><div class="row">
          <input id="f_age_min" type="number" placeholder="от" value="${esc(baseFilters.age_min || '')}" style="width:48%" />
          <input id="f_age_max" type="number" placeholder="до" value="${esc(baseFilters.age_max || '')}" style="width:48%" /></div></div>
        <div class="field"><label>Часы</label><div class="row">
          <input id="f_hours_min" type="number" placeholder="от" value="${esc(baseFilters.hours_min || '')}" style="width:48%" />
          <input id="f_hours_max" type="number" placeholder="до" value="${esc(baseFilters.hours_max || '')}" style="width:48%" /></div></div>
        <div class="field"><label for="f_events_min">Мероприятий, от</label><input id="f_events_min" type="number" value="${esc(baseFilters.events_min || '')}" /></div>
        <div class="field"><label for="f_coordinator">Координатор</label><select id="f_coordinator">
          <option value="">Любой</option>
          ${coordinators.map((c) => `<option value="${c.id}" ${String(baseFilters.coordinator_id) === String(c.id) ? 'selected' : ''}>${esc(c.full_name)}</option>`).join('')}
        </select></div>
        <div class="field"><label for="f_from">Регистрация с</label><input id="f_from" type="date" value="${esc(baseFilters.registered_from || '')}" /></div>
        <div class="field"><label for="f_to">Регистрация по</label><input id="f_to" type="date" value="${esc(baseFilters.registered_to || '')}" /></div>
        <div class="field"><label for="f_sort">Сортировка</label><select id="f_sort">
          ${[['created_at', 'Дата регистрации'], ['hours', 'Часы'], ['events', 'Мероприятия'], ['name', 'ФИО'], ['activity', 'Активность']]
            .map(([k, v]) => `<option value="${k}" ${baseFilters.sort === k ? 'selected' : ''}>${v}</option>`)
            .join('')}</select></div>
      </div>
      <label>Направления</label>
      <div class="chips" data-group="directions" style="margin-bottom:12px">
        ${state.dict.directions
          .map(
            (d) => `<button type="button" class="chip" data-value="${d.key}" aria-pressed="${(baseFilters.directions || []).includes(d.key)}">${esc(d.title)}</button>`
          )
          .join('')}
      </div>
      <label>Навыки и компетенции</label>
      <div class="chips" data-group="skills" style="margin-bottom:14px">
        ${allSkills
          .map((s) => `<button type="button" class="chip" data-value="${s.key}" aria-pressed="${(baseFilters.skills || []).includes(s.key)}">${esc(s.title)}</button>`)
          .join('')}
      </div>
      <div class="row"><button id="apply">Показать</button><button id="clear" class="btn-ghost">Сбросить фильтры</button></div>
    </section>

    <div class="table-wrap">
      <table><thead><tr>
        <th style="width:32px"><input type="checkbox" id="check-all" /></th>
        <th>Волонтер</th><th>Возраст</th><th>Город</th><th>Тип</th><th>Статус</th>
        <th>Навыки</th><th>Часы</th><th>Мер.</th><th>Активность</th><th>Координатор</th>
      </tr></thead>
      <tbody>${
        items.length
          ? items
              .map(
                (v) => `<tr>
                  <td><input type="checkbox" class="pick" value="${v.id}" /></td>
                  <td><strong style="cursor:pointer" data-card="${v.id}">${esc(v.full_name || '—')}</strong>
                    <div class="small muted">${fmtPhone(v.phone)}</div></td>
                  <td>${v.age ?? '—'}</td>
                  <td class="muted">${esc(v.city || '—')}</td>
                  <td class="small">${TYPE_LABEL[v.volunteer_type] || '—'}</td>
                  <td><span class="tag ${STATUS_TONE[v.status]}">${STATUS_LABEL[v.status]}</span></td>
                  <td class="small">${v.skills.slice(0, 2).map((s) => esc(skillTitle(s))).join(', ') || '—'}${v.skills.length > 2 ? ` +${v.skills.length - 2}` : ''}</td>
                  <td><strong>${v.total_hours}</strong></td>
                  <td>${v.events_count}</td>
                  <td><span class="tag ${v.activity === 'активный' ? 'pine' : ''}">${v.activity}</span></td>
                  <td class="small muted">${esc(v.coordinator?.full_name || '—')}</td>
                </tr>`
              )
              .join('')
          : '<tr><td colspan="11"><div class="empty"><strong>Никто не найден</strong>Смягчите фильтры или сбросьте их.</div></td></tr>'
      }</tbody></table>
    </div>
    <div class="row" style="margin-top:12px;justify-content:center">
      <button class="btn-ghost btn-sm" id="prev" ${page <= 1 ? 'disabled' : ''}>Назад</button>
      <span class="small muted">Страница ${page} из ${Math.max(1, Math.ceil(total / limit))}</span>
      <button class="btn-ghost btn-sm" id="next" ${page * limit >= total ? 'disabled' : ''}>Вперед</button>
    </div>`);

  app().querySelectorAll('.chip').forEach((c) => (c.onclick = () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')));

  const readFilters = () => {
    Object.assign(baseFilters, {
      search: $('#f_search').value,
      city: $('#f_city').value,
      status: $('#f_status').value,
      volunteer_type: $('#f_type').value,
      gender: $('#f_gender').value,
      age_min: $('#f_age_min').value,
      age_max: $('#f_age_max').value,
      hours_min: $('#f_hours_min').value,
      hours_max: $('#f_hours_max').value,
      events_min: $('#f_events_min').value,
      coordinator_id: $('#f_coordinator').value,
      registered_from: $('#f_from').value,
      registered_to: $('#f_to').value,
      sort: $('#f_sort').value,
      directions: [...app().querySelectorAll('[data-group="directions"] .chip[aria-pressed="true"]')].map((c) => c.dataset.value),
      skills: [...app().querySelectorAll('[data-group="skills"] .chip[aria-pressed="true"]')].map((c) => c.dataset.value),
    });
  };

  $('#apply').onclick = () => {
    readFilters();
    baseFilters.page = 1;
    route();
  };
  $('#clear').onclick = () => {
    Object.keys(baseFilters).forEach((k) => delete baseFilters[k]);
    route();
  };
  $('#prev').onclick = () => {
    baseFilters.page = Math.max(1, (Number(baseFilters.page) || 1) - 1);
    route();
  };
  $('#next').onclick = () => {
    baseFilters.page = (Number(baseFilters.page) || 1) + 1;
    route();
  };
  $('#check-all').onchange = (e) => app().querySelectorAll('.pick').forEach((c) => (c.checked = e.target.checked));

  $('#export').onclick = async () => {
    const res = await api(`/volunteers/export/csv?${q}`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: 'volunteers.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  $('#assign').onclick = () => {
    const ids = [...app().querySelectorAll('.pick:checked')].map((c) => Number(c.value));
    if (!ids.length) return toast('Отметьте волонтеров в списке', 'err');
    modal(
      `Закрепить координатора: выбрано ${ids.length}`,
      `<div class="field"><label for="co">Координатор</label><select id="co">
        <option value="">Снять закрепление</option>
        ${coordinators.map((c) => `<option value="${c.id}">${esc(c.full_name)}</option>`).join('')}</select></div>`,
      async () => {
        await api('/users/assign-coordinator', {
          method: 'POST',
          body: { coordinator_id: $('#co').value ? Number($('#co').value) : null, volunteer_ids: ids },
        });
        toast('Координатор закреплен');
        route();
      }
    );
  };

  app().querySelectorAll('[data-card]').forEach((el) => (el.onclick = () => volunteerCard(el.dataset.card)));
}

async function volunteerCard(id) {
  const d = await api(`/volunteers/${id}`);
  const u = d.user;
  const a = d.application || {};
  modal(
    esc(u.full_name || 'Волонтер'),
    `<div class="row" style="margin-bottom:12px">
      <span class="tag ${STATUS_TONE[u.application_status]}">${STATUS_LABEL[u.application_status]}</span>
      <span class="tag">${TYPE_LABEL[u.volunteer_type] || '—'}</span>
      <span class="small muted">${fmtPhone(u.phone)} · ${esc(u.city || '')} · ${u.age ?? '?'} лет</span>
    </div>
    <div class="grid cols-2 small">
      <div><strong>Часы:</strong> ${u.total_hours} · <strong>Мероприятий:</strong> ${u.events_count}<br />
        <strong>Координатор:</strong> ${esc(u.coordinator?.full_name || 'не закреплен')}<br />
        <strong>Образование:</strong> ${esc(a.education || '—')}<br />
        <strong>Занятость:</strong> ${esc(a.occupation || '—')}<br />
        <strong>Языки:</strong> ${(a.languages || []).join(', ') || '—'}<br />
        <strong>Свободное время:</strong> ${esc(a.free_time || '—')}</div>
      <div><strong>Направления:</strong> ${(a.directions || []).map((x) => esc(directionTitle(x))).join(', ') || '—'}<br />
        <strong>Навыки:</strong> ${(a.skills || []).map((x) => esc(skillTitle(x))).join(', ') || '—'}<br />
        <strong>Качества:</strong> ${(a.qualities || []).join(', ') || '—'}<br />
        <strong>Интересы:</strong> ${(a.interests || []).join(', ') || '—'}<br />
        <strong>Авто:</strong> ${a.has_car ? 'есть' : 'нет'} · <strong>Ноутбук:</strong> ${a.has_laptop ? 'есть' : 'нет'}</div>
    </div>
    <p class="small" style="margin-top:12px"><strong>Мотивация:</strong> ${esc(a.motivation || '—')}</p>
    <p class="small"><strong>Опыт:</strong> ${esc(a.experience || '—')}</p>
    <h3 style="margin-top:14px">История участия</h3>
    <div class="table-wrap" style="border:none">
      <table><tbody>${
        d.history
          .map(
            (h) => `<tr><td>${esc(h.title)}</td><td class="muted small">${fmtDate(h.starts_at, false)}</td>
              <td>${h.attendance === 'present' ? `${h.hours} ч` : '<span class="muted">не был</span>'}</td></tr>`
          )
          .join('') || '<tr><td class="muted small">Участия пока нет</td></tr>'
      }</tbody></table>
    </div>`,
    null,
    'Закрыть'
  );
}

async function matchPage() {
  const allSkills = state.dict.directions.flatMap((d) => d.skills.map((s) => ({ ...s, dir: d.title })));
  render(`
    <div class="page-head"><div><h1>Подбор волонтеров</h1>
      <div class="sub">Отметьте, кто нужен под задачу — система отранжирует кандидатов по совпадению навыков, опыту и активности.</div></div></div>

    <section class="card">
      <label>Навыки</label>
      <div class="chips" data-group="skills" style="margin-bottom:14px">
        ${allSkills.map((s) => `<button type="button" class="chip" data-value="${s.key}">${esc(s.title)} <span class="muted small">· ${esc(s.dir)}</span></button>`).join('')}
      </div>
      <div class="grid cols-4">
        <div class="field"><label for="m_city">Город</label><input id="m_city" placeholder="Любой" /></div>
        <div class="field"><label for="m_type">Тип волонтерства</label><select id="m_type">
          <option value="">Любой</option>${Object.entries(TYPE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label for="m_time">Свободное время</label><select id="m_time">
          <option value="">Не важно</option>${state.dict.free_time.map((f) => `<option value="${f.key}">${esc(f.title)}</option>`).join('')}</select></div>
        <div class="field"><label>Требуется</label>
          <label class="checkline"><input type="checkbox" id="m_car" /> Автомобиль</label>
          <label class="checkline"><input type="checkbox" id="m_laptop" /> Ноутбук</label></div>
      </div>
      <button id="find">Подобрать</button>
    </section>
    <div id="result" style="margin-top:14px"></div>`);

  app().querySelectorAll('.chip').forEach((c) => (c.onclick = () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')));

  $('#find').onclick = async () => {
    const skills = [...app().querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.dataset.value);
    if (!skills.length) return toast('Отметьте хотя бы один навык', 'err');
    try {
      const { items } = await api('/volunteers/match', {
        method: 'POST',
        body: {
          skills,
          city: $('#m_city').value || undefined,
          volunteer_type: $('#m_type').value || undefined,
          free_time: $('#m_time').value || undefined,
          needs_car: $('#m_car').checked,
          needs_laptop: $('#m_laptop').checked,
        },
      });
      $('#result').innerHTML = items.length
        ? `<div class="table-wrap"><table>
            <thead><tr><th>Кандидат</th><th>Совпадения</th><th>Город</th><th>Опыт</th><th>Активность</th><th>Ранг</th></tr></thead>
            <tbody>${items
              .map(
                (v) => `<tr><td><strong>${esc(v.full_name || '—')}</strong><div class="small muted">${fmtPhone(v.phone)}</div></td>
                  <td>${v.matched_skills.map((s) => `<span class="tag pine">${esc(s)}</span>`).join(' ')}</td>
                  <td class="muted">${esc(v.city || '—')}</td>
                  <td class="small">${v.total_hours} ч · ${v.events_count} мер.</td>
                  <td><span class="tag ${v.activity === 'активный' ? 'pine' : ''}">${v.activity}</span></td>
                  <td><strong>${v.score}</strong></td></tr>`
              )
              .join('')}</tbody></table></div>`
        : '<div class="card empty"><strong>Подходящих кандидатов нет</strong>Уберите часть требований и попробуйте снова.</div>';
    } catch (e) {
      toast(e.message, 'err');
    }
  };
}

async function manageEventsPage() {
  const { items } = await api('/events');
  const { items: coordinators } = await api('/dictionaries/coordinators');

  render(`
    <div class="page-head"><div><h1>Мероприятия</h1><div class="sub">Анонс, координатор, набор команды.</div></div>
      <button id="create">Создать мероприятие</button></div>
    <div class="table-wrap">
      <table><thead><tr><th>Мероприятие</th><th>Дата</th><th>Место</th><th>Координатор</th><th>Набор</th><th>Статус</th><th></th></tr></thead>
      <tbody>${
        items.length
          ? items
              .map(
                (e) => `<tr>
                  <td><strong>${esc(e.title)}</strong><div class="small muted">${e.directions.map((d) => esc(directionTitle(d))).join(', ')}</div></td>
                  <td class="small">${fmtDate(e.starts_at)}</td>
                  <td class="muted small">${esc(e.location || '—')}</td>
                  <td class="small">${esc(e.coordinator?.full_name || '<span class="muted">не назначен</span>')}</td>
                  <td>${e.accepted_count} / ${e.needed_count}<div class="small muted">${e.signed_up_count} заявок</div></td>
                  <td><span class="tag ${e.status === 'published' ? 'pine' : e.status === 'cancelled' ? 'danger' : ''}">${EVENT_STATUS[e.status]}</span></td>
                  <td><div class="row">
                    <button class="btn-sm btn-ghost" data-edit="${e.id}">Изменить</button>
                    <button class="btn-sm btn-ghost" data-team="${e.id}">Команда</button>
                    <button class="btn-sm btn-quiet" data-del="${e.id}" style="color:var(--danger)">Удалить</button>
                  </div></td></tr>`
              )
              .join('')
          : '<tr><td colspan="7"><div class="empty"><strong>Мероприятий нет</strong>Создайте первый анонс — волонтеры получат уведомление.</div></td></tr>'
      }</tbody></table>
    </div>`);

  // БД хранит время в UTC — для поля datetime-local переводим в местное.
  const toLocalInput = (v) => {
    if (!v) return '';
    const d = parseUtc(v);
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const form = (e = {}) => `
    <div class="field"><label for="e_title">Название</label><input id="e_title" value="${esc(e.title || '')}" /></div>
    <div class="field"><label for="e_desc">Описание</label><textarea id="e_desc">${esc(e.description || '')}</textarea></div>
    <div class="grid cols-2">
      <div class="field"><label for="e_start">Начало</label><input id="e_start" type="datetime-local" value="${toLocalInput(e.starts_at)}" /></div>
      <div class="field"><label for="e_end">Окончание</label><input id="e_end" type="datetime-local" value="${toLocalInput(e.ends_at)}" /></div>
      <div class="field"><label for="e_loc">Место проведения</label><input id="e_loc" value="${esc(e.location || '')}" /></div>
      <div class="field"><label for="e_city">Город</label><input id="e_city" value="${esc(e.city || '')}" /></div>
      <div class="field"><label for="e_need">Нужно волонтеров</label><input id="e_need" type="number" min="1" value="${e.needed_count || 10}" /></div>
      <div class="field"><label for="e_co">Координатор</label><select id="e_co">
        <option value="">Не назначен</option>
        ${coordinators.map((c) => `<option value="${c.id}" ${e.coordinator?.id === c.id ? 'selected' : ''}>${esc(c.full_name)}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="e_req">Дополнительные требования</label><input id="e_req" value="${esc(e.requirements || '')}" /></div>
    <div class="field"><label for="e_status">Статус</label><select id="e_status">
      ${Object.entries(EVENT_STATUS).map(([k, v]) => `<option value="${k}" ${(e.status || 'published') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <label>Направления</label>
    <div class="chips" data-group="dirs">${state.dict.directions
      .map((d) => `<button type="button" class="chip" data-value="${d.key}" aria-pressed="${(e.directions || []).includes(d.key)}">${esc(d.title)}</button>`)
      .join('')}</div>`;

  // Пользователь вводит местное время — переводим в UTC для хранения.
  const toDbUtc = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : null);
  const readForm = () => ({
    title: $('#e_title').value,
    description: $('#e_desc').value,
    starts_at: toDbUtc($('#e_start').value),
    ends_at: toDbUtc($('#e_end').value),
    location: $('#e_loc').value,
    city: $('#e_city').value,
    needed_count: Number($('#e_need').value),
    coordinator_id: $('#e_co').value ? Number($('#e_co').value) : null,
    requirements: $('#e_req').value,
    status: $('#e_status').value,
    directions: [...document.querySelectorAll('[data-group="dirs"] .chip[aria-pressed="true"]')].map((c) => c.dataset.value),
  });

  $('#create').onclick = () =>
    modal('Новое мероприятие', form(), async () => {
      await api('/events', { method: 'POST', body: readForm() });
      toast('Мероприятие создано, волонтеры уведомлены');
      route();
    });

  app().querySelectorAll('[data-edit]').forEach(
    (b) =>
      (b.onclick = async () => {
        const { event } = await api(`/events/${b.dataset.edit}`);
        modal('Изменить мероприятие', form(event), async () => {
          await api(`/events/${event.id}`, { method: 'PATCH', body: readForm() });
          toast('Изменения сохранены, участники уведомлены');
          route();
        });
      })
  );
  app().querySelectorAll('[data-team]').forEach((b) => (b.onclick = () => (location.hash = `#/teams/${b.dataset.team}`)));
  app().querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () =>
        modal('Удалить мероприятие', '<p class="small">Записи участников и связанные часы также будут удалены. Действие необратимо.</p>', async () => {
          await api(`/events/${b.dataset.del}`, { method: 'DELETE' });
          toast('Мероприятие удалено');
          route();
        }))
  );
}

async function usersPage() {
  const role = new URLSearchParams(location.hash.split('?')[1] || '').get('role') || '';
  const { items } = await api(`/users${role ? `?role=${role}` : ''}`);

  render(`
    <div class="page-head"><div><h1>Пользователи</h1><div class="sub">Роли, блокировки, сброс паролей.</div></div>
      <div class="row">
        <div class="tabs" style="margin:0">
          ${[['', 'Все'], ['volunteer', 'Волонтеры'], ['coordinator', 'Координаторы'], ['admin', 'Администраторы']]
            .map(([k, v]) => `<button aria-selected="${role === k}" data-role="${k}">${v}</button>`)
            .join('')}
        </div>
        <button id="create">Добавить пользователя</button>
      </div></div>
    <div class="table-wrap">
      <table><thead><tr><th>Пользователь</th><th>Роль</th><th>Город</th><th>Статус</th><th>Регистрация</th><th></th></tr></thead>
      <tbody>${items
        .map(
          (u) => `<tr>
            <td><strong>${esc(u.full_name || '—')}</strong><div class="small muted">${fmtPhone(u.phone)}</div></td>
            <td><select class="btn-sm" data-role-of="${u.id}" style="width:150px">
              ${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
            <td class="muted">${esc(u.city || '—')}</td>
            <td>${u.is_blocked ? '<span class="tag danger">Заблокирован</span>' : `<span class="tag ${STATUS_TONE[u.application_status]}">${STATUS_LABEL[u.application_status]}</span>`}</td>
            <td class="small muted">${fmtDate(u.created_at, false)}</td>
            <td><div class="row">
              <button class="btn-sm btn-ghost" data-block="${u.id}" data-blocked="${u.is_blocked}">${u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button>
              <button class="btn-sm btn-ghost" data-reset="${u.id}">Сбросить пароль</button>
              <button class="btn-sm btn-ghost" data-log="${u.id}">История</button>
              <button class="btn-sm btn-quiet" data-del="${u.id}" style="color:var(--danger)">Удалить</button>
            </div></td></tr>`
        )
        .join('')}</tbody></table>
    </div>`);

  app().querySelectorAll('[data-role]').forEach((b) => (b.onclick = () => (location.hash = `#/users${b.dataset.role ? `?role=${b.dataset.role}` : ''}`)));

  app().querySelectorAll('[data-role-of]').forEach(
    (sel) =>
      (sel.onchange = async () => {
        try {
          await api(`/users/${sel.dataset.roleOf}/role`, { method: 'POST', body: { role: sel.value } });
          toast('Роль изменена');
          route();
        } catch (e) {
          toast(e.message, 'err');
          route();
        }
      })
  );

  app().querySelectorAll('[data-block]').forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await api(`/users/${b.dataset.block}/block`, { method: 'POST', body: { blocked: b.dataset.blocked !== 'true' } });
          toast('Готово');
          route();
        } catch (e) {
          toast(e.message, 'err');
        }
      })
  );

  app().querySelectorAll('[data-reset]').forEach(
    (b) =>
      (b.onclick = () =>
        modal('Сбросить пароль', '<p class="small">Будет создан временный пароль. Передайте его пользователю — он сможет сменить пароль в кабинете.</p>', async () => {
          const r = await api(`/users/${b.dataset.reset}/reset-password`, { method: 'POST', body: {} });
          modal('Временный пароль', `<p>Передайте пользователю: <strong style="font-family:var(--font-display)">${esc(r.temporary_password)}</strong></p>`, null, 'Закрыть');
        }))
  );

  app().querySelectorAll('[data-log]').forEach(
    (b) =>
      (b.onclick = async () => {
        const { items: log } = await api(`/users/${b.dataset.log}/activity`);
        modal(
          'История активности',
          `<div class="table-wrap" style="border:none"><table><tbody>${
            log
              .map(
                (l) => `<tr><td class="small">${esc(l.action)}</td><td class="small muted">${esc(l.details || '')}</td>
                  <td class="small muted">${fmtDate(l.created_at)}</td></tr>`
              )
              .join('') || '<tr><td class="muted small">Записей нет</td></tr>'
          }</tbody></table></div>`,
          null,
          'Закрыть'
        );
      })
  );

  app().querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () =>
        modal('Удалить пользователя', '<p class="small">Анкета, записи на мероприятия и часы будут удалены. Действие необратимо.</p>', async () => {
          await api(`/users/${b.dataset.del}`, { method: 'DELETE' });
          toast('Пользователь удален');
          route();
        }))
  );

  $('#create').onclick = () =>
    modal(
      'Новый пользователь',
      `<div class="grid cols-2">
        <div class="field"><label for="u_phone">Телефон</label><input id="u_phone" /></div>
        <div class="field"><label for="u_name">ФИО</label><input id="u_name" /></div>
        <div class="field"><label for="u_city">Город</label><input id="u_city" /></div>
        <div class="field"><label for="u_role">Роль</label><select id="u_role">
          ${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${k === 'coordinator' ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="u_pass">Пароль</label><input id="u_pass" type="text" /><div class="hint">Минимум 8 символов</div></div>`,
      async () => {
        await api('/users', {
          method: 'POST',
          body: {
            phone: $('#u_phone').value,
            full_name: $('#u_name').value,
            city: $('#u_city').value,
            role: $('#u_role').value,
            password: $('#u_pass').value,
          },
        });
        toast('Пользователь добавлен');
        route();
      }
    );
}

/* ---------- Модальное окно ---------- */
function modal(title, bodyHtml, onConfirm, confirmLabel = 'Подтвердить') {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="spread" style="margin-bottom:12px"><h2>${title}</h2><button class="btn-quiet" data-close>✕</button></div>
      <div>${bodyHtml}</div>
      <div class="row" style="margin-top:16px;justify-content:flex-end">
        <button class="btn-ghost" data-close>${onConfirm ? 'Отмена' : confirmLabel}</button>
        ${onConfirm ? `<button data-confirm>${confirmLabel}</button>` : ''}
      </div>
    </div>`;
  document.body.append(bg);

  const close = () => bg.remove();
  bg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
  bg.onclick = (e) => e.target === bg && close();
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onEsc);
    }
  });
  bg.querySelectorAll('.chip').forEach((c) => (c.onclick = () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')));

  const confirm = bg.querySelector('[data-confirm]');
  if (confirm)
    confirm.onclick = async () => {
      confirm.disabled = true;
      try {
        await onConfirm();
        close();
      } catch (e) {
        toast(e.message, 'err');
        confirm.disabled = false;
      }
    };
  return bg;
}

/* ---------- Роутер ---------- */
const homeFor = (u) => (u.role === 'admin' ? '#/admin' : u.role === 'coordinator' ? '#/teams' : u.application_status === 'approved' ? '#/profile' : u.volunteer_type ? '#/application' : '#/onboarding');

async function refreshUnread() {
  try {
    const { unread } = await api('/profile/notifications');
    state.unread = unread;
  } catch {
    state.unread = 0;
  }
}

async function route() {
  const hash = location.hash || '#/';

  if (!state.token) return authScreen('login');

  if (!state.user) {
    try {
      const { user } = await api('/auth/me');
      state.user = user;
    } catch {
      return authScreen('login');
    }
  }
  if (!state.dict) state.dict = await api('/dictionaries');
  await refreshUnread();

  const u = state.user;
  const path = hash.split('?')[0];

  // Волонтер без анкеты попадает в онбординг с любого маршрута.
  if (u.role === 'volunteer' && u.application_status === 'draft' && !['#/onboarding', '#/application', '#/notifications'].includes(path)) {
    location.hash = u.volunteer_type ? '#/application' : '#/onboarding';
    return;
  }
  // Роль не имеет доступа к разделу — уводим на домашний экран.
  // '#/teams' доступен только координатору/админу (у координатора он и так в NAV,
  // админу нужен для перехода к составу команды по '#/teams/:id').
  const allowed = NAV[u.role]
    .map(([h]) => h)
    .concat(u.role === 'volunteer' ? ['#/onboarding', '#/application'] : ['#/onboarding', '#/application', '#/teams']);
  if (!allowed.some((h) => path.startsWith(h)) && path !== '#/') {
    location.hash = homeFor(u);
    return;
  }

  try {
    if (path === '#/' || path === '#/login') return (location.hash = homeFor(u));
    if (path === '#/onboarding') return onboardingPage();
    if (path === '#/application') return applicationPage();
    if (path === '#/profile') return profilePage();
    if (path === '#/events') return eventsPage();
    if (path === '#/notifications') return notificationsPage();
    if (path.startsWith('#/teams/')) return eventTeamPage(path.split('/')[2]);
    if (path === '#/teams') return coordinatorEventsPage();
    if (path === '#/team') return teamPage();
    if (path === '#/admin') return dashboardPage();
    if (path === '#/moderation') return moderationPage();
    if (path === '#/base') return basePage();
    if (path === '#/match') return matchPage();
    if (path === '#/manage-events') return manageEventsPage();
    if (path === '#/users') return usersPage();
    render('<div class="card empty"><strong>Страница не найдена</strong>Проверьте адрес или вернитесь в начало.</div>');
  } catch (e) {
    toast(e.message, 'err');
    render(`<div class="card empty"><strong>Не удалось загрузить раздел</strong>${esc(e.message)}</div>`);
  }
}

document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
window.addEventListener('hashchange', route);
route();
