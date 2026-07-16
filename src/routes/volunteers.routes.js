import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ageFrom, notFound, parseDbDate, parseJson, toArray, wrap } from '../utils/helpers.js';
import { SKILL_TITLES } from '../utils/dictionaries.js';
import { publicApplication, publicUser } from './_serialize.js';

export const volunteersRouter = Router();
volunteersRouter.use(requireAuth, requireRole('admin'));

/**
 * Строит WHERE для базы волонтеров по параметрам фильтра.
 * Поддерживает: возраст, пол, город, статус, тип, навыки, компетенции,
 * направления, интересы, часы, мероприятия, координатор, дата регистрации, поиск.
 */
function buildFilter(q) {
  const where = [`u.role = 'volunteer'`];
  const params = [];
  const add = (sql, ...values) => {
    where.push(sql);
    params.push(...values);
  };

  if (q.search) {
    // Поиск по ФИО всегда, по телефону — только если в запросе есть цифры,
    // иначе нормализованный телефон превращается в '%%' и находит всех подряд.
    const phoneDigits = q.search.replace(/[^\d+]/g, '');
    if (phoneDigits) add(`(u.full_name LIKE ? OR u.phone LIKE ?)`, `%${q.search}%`, `%${phoneDigits}%`);
    else add(`u.full_name LIKE ?`, `%${q.search}%`);
  }
  if (q.age_min) add(`CAST((julianday('now') - julianday(u.birth_date)) / 365.25 AS INT) >= ?`, Number(q.age_min));
  if (q.age_max) add(`CAST((julianday('now') - julianday(u.birth_date)) / 365.25 AS INT) <= ?`, Number(q.age_max));
  if (q.gender) add(`u.gender = ?`, q.gender);
  if (q.city) add(`u.city LIKE ?`, `%${q.city}%`);
  if (q.status) add(`u.application_status = ?`, q.status);
  if (q.volunteer_type) add(`u.volunteer_type = ?`, q.volunteer_type);
  if (q.coordinator_id) add(`u.coordinator_id = ?`, Number(q.coordinator_id));
  if (q.registered_from) add(`date(u.created_at) >= date(?)`, q.registered_from);
  if (q.registered_to) add(`date(u.created_at) <= date(?)`, q.registered_to);
  if (q.hours_min) add(`COALESCE(s.total_hours, 0) >= ?`, Number(q.hours_min));
  if (q.hours_max) add(`COALESCE(s.total_hours, 0) <= ?`, Number(q.hours_max));
  if (q.events_min) add(`COALESCE(s.events_count, 0) >= ?`, Number(q.events_min));
  if (q.blocked === '1') add(`u.is_blocked = 1`);

  // Массивы анкеты: совпадение хотя бы по одному значению (json1).
  const arrayFilters = [
    ['skills', 'a.skills_json'],
    ['directions', 'a.directions_json'],
    ['interests', 'a.interests_json'],
    ['qualities', 'a.qualities_json'],
    ['languages', 'a.languages_json'],
  ];
  for (const [key, column] of arrayFilters) {
    const values = toArray(q[key]).flatMap((v) => String(v).split(',')).map((v) => v.trim()).filter(Boolean);
    if (!values.length) continue;
    const mode = q[`${key}_mode`] === 'all' ? 'all' : 'any';
    if (mode === 'all') {
      for (const v of values) add(`EXISTS (SELECT 1 FROM json_each(${column}) je WHERE je.value = ?)`, v);
    } else {
      add(
        `EXISTS (SELECT 1 FROM json_each(${column}) je WHERE je.value IN (${values.map(() => '?').join(',')}))`,
        ...values
      );
    }
  }
  if (q.has_car === '1') add(`a.has_car = 1`);
  if (q.has_laptop === '1') add(`a.has_laptop = 1`);
  if (q.free_time) add(`a.free_time = ?`, q.free_time);

  return { where: where.join(' AND '), params };
}

const BASE_SELECT = `
  SELECT u.id, u.full_name, u.phone, u.birth_date, u.gender, u.city, u.volunteer_type,
         u.application_status, u.is_blocked, u.created_at, u.coordinator_id,
         c.full_name AS coordinator_name,
         COALESCE(s.total_hours, 0) AS total_hours,
         COALESCE(s.events_count, 0) AS events_count,
         s.last_event_at,
         a.skills_json, a.directions_json, a.interests_json, a.qualities_json,
         a.education, a.occupation, a.has_car, a.has_laptop, a.free_time
    FROM users u
    LEFT JOIN volunteer_stats s ON s.user_id = u.id
    LEFT JOIN users c ON c.id = u.coordinator_id
    LEFT JOIN applications a
           ON a.id = (SELECT MAX(id) FROM applications WHERE user_id = u.id)
`;

const SORTS = {
  created_at: 'u.created_at DESC',
  hours: 'total_hours DESC',
  events: 'events_count DESC',
  name: 'u.full_name COLLATE NOCASE ASC',
  activity: 's.last_event_at DESC',
};

function mapRow(r) {
  return {
    id: r.id,
    full_name: r.full_name,
    phone: r.phone,
    age: ageFrom(r.birth_date),
    gender: r.gender,
    city: r.city,
    volunteer_type: r.volunteer_type,
    status: r.application_status,
    is_blocked: !!r.is_blocked,
    skills: parseJson(r.skills_json, []),
    directions: parseJson(r.directions_json, []),
    interests: parseJson(r.interests_json, []),
    qualities: parseJson(r.qualities_json, []),
    education: r.education,
    occupation: r.occupation,
    has_car: !!r.has_car,
    has_laptop: !!r.has_laptop,
    free_time: r.free_time,
    total_hours: Number(r.total_hours || 0),
    events_count: Number(r.events_count || 0),
    last_event_at: r.last_event_at,
    activity: activityLabel(r.last_event_at),
    coordinator: r.coordinator_id ? { id: r.coordinator_id, full_name: r.coordinator_name } : null,
    created_at: r.created_at,
  };
}

/** Активность по дате последнего мероприятия. */
function activityLabel(lastEventAt) {
  if (!lastEventAt) return 'нет участия';
  const days = (Date.now() - parseDbDate(lastEventAt).getTime()) / 86400000;
  if (days <= 30) return 'активный';
  if (days <= 90) return 'редко';
  return 'неактивный';
}

/** База волонтеров с фильтрами и пагинацией. */
volunteersRouter.get(
  '/',
  wrap((req, res) => {
    const { where, params } = buildFilter(req.query);
    const limit = Math.min(Number(req.query.limit) || 25, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const order = SORTS[req.query.sort] || SORTS.created_at;

    const total = db
      .prepare(
        `SELECT COUNT(*) AS c FROM users u
           LEFT JOIN volunteer_stats s ON s.user_id = u.id
           LEFT JOIN applications a ON a.id = (SELECT MAX(id) FROM applications WHERE user_id = u.id)
          WHERE ${where}`
      )
      .get(...params).c;

    const rows = db
      .prepare(`${BASE_SELECT} WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, limit, (page - 1) * limit);

    res.json({ total, page, limit, items: rows.map(mapRow) });
  })
);

/** Карточка волонтера с анкетой и историей участия. */
volunteersRouter.get(
  '/:id',
  wrap((req, res) => {
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!user) throw notFound('Волонтер не найден');
    const application = db
      .prepare(`SELECT * FROM applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
      .get(user.id);
    const history = db
      .prepare(
        `SELECT r.status, r.attendance, r.hours, r.comment, e.id AS event_id, e.title, e.starts_at
           FROM registrations r JOIN events e ON e.id = r.event_id
          WHERE r.user_id = ? ORDER BY e.starts_at DESC`
      )
      .all(user.id);
    const log = db
      .prepare(`SELECT * FROM activity_log WHERE target_id = ? ORDER BY id DESC LIMIT 50`)
      .all(user.id);
    res.json({ user: publicUser(user), application: publicApplication(application), history, activity_log: log });
  })
);

/**
 * Подбор кандидатов под задачу.
 * Считает релевантность: совпадения по навыкам и направлениям + бонусы за опыт и активность.
 */
volunteersRouter.post(
  '/match',
  wrap((req, res) => {
    const skills = toArray(req.body.skills);
    const directions = toArray(req.body.directions);
    const limit = Math.min(Number(req.body.limit) || 20, 100);

    const query = { status: 'approved', ...(req.body.city ? { city: req.body.city } : {}) };
    if (req.body.volunteer_type) query.volunteer_type = req.body.volunteer_type;
    const { where, params } = buildFilter(query);

    const rows = db.prepare(`${BASE_SELECT} WHERE ${where}`).all(...params).map(mapRow);

    const scored = rows
      .map((v) => {
        const skillHits = skills.filter((s) => v.skills.includes(s));
        const directionHits = directions.filter((d) => v.directions.includes(d));
        if (skills.length + directions.length > 0 && skillHits.length + directionHits.length === 0) return null;
        let score = skillHits.length * 10 + directionHits.length * 5;
        if (v.activity === 'активный') score += 4;
        if (v.activity === 'редко') score += 1;
        score += Math.min(v.events_count, 10);
        if (req.body.needs_car && v.has_car) score += 3;
        if (req.body.needs_laptop && v.has_laptop) score += 3;
        if (req.body.free_time && v.free_time === req.body.free_time) score += 2;
        return {
          ...v,
          score,
          matched_skills: skillHits.map((s) => SKILL_TITLES[s] || s),
          matched_directions: directionHits,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || b.total_hours - a.total_hours)
      .slice(0, limit);

    res.json({ total: scored.length, items: scored });
  })
);

/** Экспорт выборки в CSV (открывается в Excel). */
volunteersRouter.get(
  '/export/csv',
  wrap((req, res) => {
    const { where, params } = buildFilter(req.query);
    const rows = db.prepare(`${BASE_SELECT} WHERE ${where} ORDER BY u.created_at DESC`).all(...params).map(mapRow);

    const headers = [
      'ФИО', 'Телефон', 'Возраст', 'Пол', 'Город', 'Тип волонтерства', 'Статус',
      'Навыки', 'Направления', 'Часы', 'Мероприятий', 'Активность', 'Координатор', 'Дата регистрации',
    ];
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.join(';')];
    for (const r of rows) {
      lines.push(
        [
          r.full_name, r.phone, r.age, r.gender === 'male' ? 'М' : r.gender === 'female' ? 'Ж' : '',
          r.city, r.volunteer_type, r.status,
          r.skills.map((s) => SKILL_TITLES[s] || s).join(', '),
          r.directions.join(', '),
          r.total_hours, r.events_count, r.activity,
          r.coordinator?.full_name || '', r.created_at,
        ]
          .map(escape)
          .join(';')
      );
    }
    // BOM — чтобы Excel открыл кириллицу корректно.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="volunteers.csv"');
    res.send('\uFEFF' + lines.join('\n'));
  })
);
