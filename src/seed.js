/**
 * Демо-данные: администратор, координаторы, волонтеры, мероприятия, часы.
 * Запуск: npm run seed (повторный запуск ничего не дублирует).
 */
import { db } from './db.js';
import { hashPassword } from './middleware/auth.js';
import { DIRECTIONS } from './utils/dictionaries.js';

const PASSWORD = 'password123';
const SKILLS = DIRECTIONS.flatMap((d) => d.skills.map((s) => ({ ...s, direction: d.key })));

const FIRST = ['Айгерим', 'Данияр', 'Алина', 'Ержан', 'Мадина', 'Тимур', 'Асель', 'Нурлан', 'Камила', 'Санжар', 'Дана', 'Арман', 'Жанна', 'Ильяс', 'Гульнара', 'Ринат', 'Сабина', 'Олжас'];
const LAST = ['Ахметова', 'Сериков', 'Ким', 'Ибраев', 'Смагулова', 'Ли', 'Абдрахманова', 'Жумабаев', 'Токтарова', 'Нургалиев'];
const CITIES = ['Астана', 'Алматы', 'Шымкент', 'Караганда', 'Актобе'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickMany = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const iso = (daysOffset, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 16).replace('T', ' ');
};

function ensureUser({ contact, role, full_name, city, birth_date, gender, volunteer_type, status }) {
  const existing = await db.prepare(`SELECT * FROM users WHERE contact = ?`).get(contact);
  if (existing) return existing;
  const info = db
    .prepare(
      `INSERT INTO users (contact, password_hash, role, full_name, birth_date, gender, city, volunteer_type, application_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
    )
    .run(
      contact,
      hashPassword(PASSWORD),
      role,
      full_name,
      birth_date || null,
      gender || null,
      city || null,
      volunteer_type || null,
      status || 'approved',
      `-${Math.floor(Math.random() * 300)} days`
    );
  return await db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
}

if (await db.prepare(`SELECT COUNT(*) AS c FROM users`).get().c > 0) {
  console.log('В базе уже есть данные. Для чистого набора: npm run reset');
}

// --- Администратор ---
const admin = ensureUser({
  contact: '@admin', role: 'admin', full_name: 'Администратор Платформы',
  city: 'Астана', birth_date: '1990-05-14', gender: 'female',
});

// --- Координаторы ---
const coordinators = [
  { contact: '@coord1', full_name: 'Ержан Сериков', city: 'Астана' },
  { contact: '@coord2', full_name: 'Алина Ким', city: 'Алматы' },
  { contact: '@coord3', full_name: 'Тимур Ибраев', city: 'Шымкент' },
].map((c) => ensureUser({ ...c, role: 'coordinator', birth_date: '1992-03-10', gender: 'male' }));

// --- Волонтеры ---
const statuses = ['approved', 'approved', 'approved', 'approved', 'pending', 'rejected', 'draft'];
const volunteers = [];
for (let i = 0; i < 40; i++) {
  const contact = `@vol${i}`;
  const type = Math.random() > 0.4 ? 'organization' : 'party';
  const age = type === 'party' ? 19 + Math.floor(Math.random() * 20) : 14 + Math.floor(Math.random() * 25);
  const birthYear = new Date().getFullYear() - age;
  const status = pick(statuses);
  const user = ensureUser({
    contact,
    role: 'volunteer',
    full_name: `${pick(FIRST)} ${pick(LAST)}`,
    city: pick(CITIES),
    birth_date: `${birthYear}-0${1 + Math.floor(Math.random() * 8)}-1${Math.floor(Math.random() * 9)}`,
    gender: Math.random() > 0.5 ? 'female' : 'male',
    volunteer_type: status === 'draft' ? null : type,
    status,
  });
  volunteers.push(user);

  if (status === 'draft') continue;
  if (await db.prepare(`SELECT id FROM applications WHERE user_id = ?`).get(user.id)) continue;

  const skills = pickMany(SKILLS, 1 + Math.floor(Math.random() * 3));
  await db.prepare(
    `INSERT INTO applications
       (user_id, volunteer_type, status, answers_json, education, occupation, languages_json,
        skills_json, directions_json, interests_json, qualities_json, goals, motivation,
        experience, has_car, has_laptop, free_time, submitted_at)
     VALUES (?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`
  ).run(
    user.id,
    type,
    status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending',
    pick(['Среднее', 'Бакалавр', 'Магистр', 'Студент']),
    pick(['Студент', 'Специалист', 'Фрилансер', 'Школьник']),
    JSON.stringify(pickMany(['Казахский', 'Русский', 'Английский'], 2)),
    JSON.stringify(skills.map((s) => s.key)),
    JSON.stringify([...new Set(skills.map((s) => s.direction))]),
    JSON.stringify(pickMany(['экология', 'образование', 'спорт', 'культура', 'помощь людям'], 2)),
    JSON.stringify(pickMany(['Ответственность', 'Коммуникабельность', 'Пунктуальность', 'Лидерство'], 2)),
    'Развивать навыки и приносить пользу городу',
    'Хочу участвовать в жизни сообщества и находить единомышленников',
    pick(['Нет опыта', 'Волонтерил на городском марафоне', 'Помогал в организации форума']),
    Math.random() > 0.7 ? 1 : 0,
    Math.random() > 0.4 ? 1 : 0,
    pick(['weekdays_evening', 'weekends', 'flexible', 'weekdays_day']),
    `-${Math.floor(Math.random() * 200)} days`
  );

  if (status === 'approved' && Math.random() > 0.25)
    await db.prepare(`UPDATE users SET coordinator_id = ? WHERE id = ?`).run(pick(coordinators).id, user.id);
}

// --- Мероприятия ---
const eventSeeds = [
  { title: 'Городской субботник в парке', days: -30, dir: ['events'], need: 20 },
  { title: 'Форум молодежи: регистрация гостей', days: -14, dir: ['events', 'media'], need: 12 },
  { title: 'Фотосъемка благотворительного забега', days: -7, dir: ['content'], need: 6 },
  { title: 'Обучающий интенсив по цифровым навыкам', days: 5, dir: ['it', 'events'], need: 10 },
  { title: 'Донорская акция', days: 12, dir: ['events'], need: 15 },
  { title: 'Съемка социального ролика', days: 20, dir: ['content', 'media'], need: 8 },
];

if (await db.prepare(`SELECT COUNT(*) AS c FROM events`).get().c === 0) {
  for (const e of eventSeeds) {
    const past = e.days < 0;
    const coordinator = pick(coordinators);
    const info = db
      .prepare(
        `INSERT INTO events (title, description, starts_at, ends_at, location, city, needed_count,
                             coordinator_id, requirements, directions_json, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        e.title,
        'Подробности и точный сбор команды координатор сообщит после подтверждения участия.',
        iso(e.days, 10),
        iso(e.days, 16),
        pick(['Центральный парк', 'Дворец школьников', 'Конгресс-холл', 'Городская площадь']),
        pick(CITIES),
        e.need,
        coordinator.id,
        pick(['Удобная обувь', 'Опыт не требуется', 'Свой ноутбук', 'Готовность работать на улице']),
        JSON.stringify(e.dir),
        past ? 'finished' : 'published',
        admin.id
      );
    const eventId = info.lastInsertRowid;

    const approved = volunteers.filter((v) => v.application_status === 'approved');
    for (const v of pickMany(approved, Math.min(e.need, approved.length))) {
      const status = past ? 'accepted' : pick(['signed_up', 'accepted', 'accepted']);
      const attendance = past ? (Math.random() > 0.15 ? 'present' : 'absent') : null;
      const hours = attendance === 'present' ? 3 + Math.floor(Math.random() * 5) : 0;
      await db.prepare(
        `INSERT OR IGNORE INTO registrations (event_id, user_id, status, attendance, hours) VALUES (?, ?, ?, ?, ?)`
      ).run(eventId, v.id, status, attendance, hours);
      if (hours > 0)
        await db.prepare(`INSERT INTO hour_logs (user_id, event_id, hours, reason, created_by) VALUES (?, ?, ?, ?, ?)`).run(
          v.id,
          eventId,
          hours,
          `Мероприятие «${e.title}»`,
          coordinator.id
        );
    }
  }
}

console.log(`Готово. Пароль для всех демо-аккаунтов: ${PASSWORD}`);
console.log(`  Администратор: @admin`);
console.log(`  Координатор:   @coord1`);
console.log(`  Волонтер:      @vol0`);
