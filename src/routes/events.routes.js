import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireRole, requireApproved } from '../middleware/auth.js';
import { notify, notifyMany, TEMPLATES } from '../services/notifications.js';
import { bad, forbidden, notFound, parseDbDate, requireFields, toArray, wrap } from '../utils/helpers.js';
import { ALL_DIRECTION_KEYS } from '../utils/dictionaries.js';
import { publicEvent } from './_serialize.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const EVENT_STATUSES = ['draft', 'published', 'ongoing', 'finished', 'cancelled'];

/**
 * Список мероприятий.
 * Волонтер видит только опубликованные и активные, координатор — свои, администратор — все.
 */
eventsRouter.get(
  '/',
  wrap(async (req, res) => {
    const where = [];
    const params = [];

    if (req.user.role === 'volunteer') {
      if (req.user.application_status !== 'approved') throw forbidden('Доступ откроется после одобрения заявки');
      where.push(`e.status IN ('published','ongoing','finished')`);
    }
    if (req.query.scope === 'mine' && req.user.role === 'coordinator') {
      where.push(`e.coordinator_id = ?`);
      params.push(req.user.id);
    }
    if (req.query.status && EVENT_STATUSES.includes(req.query.status)) {
      where.push(`e.status = ?`);
      params.push(req.query.status);
    }
    if (req.query.period === 'upcoming') where.push(`e.starts_at >= datetime('now')`);
    if (req.query.period === 'past') where.push(`e.starts_at < datetime('now')`);
    if (req.query.q) {
      where.push(`(e.title LIKE ? OR e.location LIKE ?)`);
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }

    const rows = db
      .prepare(
        `SELECT e.* FROM events e
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY e.starts_at ${req.query.period === 'past' ? 'DESC' : 'ASC'}`
      )
      .all(...params);

    res.json({ items: await Promise.all(rows.map(async (e) => await publicEvent(e, req.user.id))) });
  })
);

eventsRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const event = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
    if (!event) throw notFound('Мероприятие не найдено');
    if (req.user.role === 'volunteer' && ['draft', 'cancelled'].includes(event.status))
      throw notFound('Мероприятие не найдено');
    res.json({ event: await publicEvent(event, req.user.id) });
  })
);

/** Создание мероприятия. */
eventsRouter.post(
  '/',
  requireRole('admin'),
  wrap(async (req, res) => {
    requireFields(req.body, ['title', 'starts_at', 'needed_count']);
    const coordinatorId = req.body.coordinator_id || null;
    if (coordinatorId) assertCoordinator(coordinatorId);
    const status = EVENT_STATUSES.includes(req.body.status) ? req.body.status : 'published';
    const directions = toArray(req.body.directions).filter((d) => ALL_DIRECTION_KEYS.includes(d));

    const info = db
      .prepare(
        `INSERT INTO events
           (title, description, starts_at, ends_at, location, city, needed_count,
            coordinator_id, requirements, directions_json, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        req.body.title,
        req.body.description || null,
        req.body.starts_at,
        req.body.ends_at || null,
        req.body.location || null,
        req.body.city || null,
        Number(req.body.needed_count) || 1,
        coordinatorId,
        req.body.requirements || null,
        JSON.stringify(directions),
        status,
        req.user.id
      );

    const event = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(info.lastInsertRowid);
    await logActivity(req.user.id, null, 'event_created', `event:${event.id}`);

    if (status === 'published') {
      const audience = db
        .prepare(`SELECT id FROM users WHERE role = 'volunteer' AND application_status = 'approved' AND is_blocked = 0`)
        .all()
        .map((r) => r.id);
      notifyMany(audience, ...TEMPLATES.newEvent(event.title));
    }
    if (coordinatorId) notify(coordinatorId, 'event_assigned', 'Вы координатор мероприятия', event.title, '#/events');

    res.status(201).json({ event: await publicEvent(event, req.user.id) });
  })
);

/** Изменение мероприятия. */
eventsRouter.patch(
  '/:id',
  requireRole('admin'),
  wrap(async (req, res) => {
    const event = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
    if (!event) throw notFound('Мероприятие не найдено');

    const allowed = [
      'title', 'description', 'starts_at', 'ends_at', 'location', 'city',
      'needed_count', 'coordinator_id', 'requirements', 'status',
    ];
    const fields = allowed.filter((f) => req.body[f] !== undefined);
    if (req.body.directions !== undefined) fields.push('directions_json');
    if (!fields.length) throw bad('Нет полей для сохранения');
    if (req.body.status && !EVENT_STATUSES.includes(req.body.status)) throw bad('Некорректный статус мероприятия');
    if (req.body.coordinator_id) assertCoordinator(req.body.coordinator_id);

    const values = fields.map((f) =>
      f === 'directions_json'
        ? JSON.stringify(toArray(req.body.directions).filter((d) => ALL_DIRECTION_KEYS.includes(d)))
        : req.body[f] ?? null
    );
    await db.prepare(
      `UPDATE events SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values, event.id);

    const updated = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(event.id);
    await logActivity(req.user.id, null, 'event_updated', `event:${event.id}`);

    const participants = db
      .prepare(`SELECT user_id FROM registrations WHERE event_id = ? AND status IN ('signed_up','accepted')`)
      .all(event.id)
      .map((r) => r.user_id);
    if (req.body.status === 'cancelled') notifyMany(participants, ...TEMPLATES.eventCancelled(updated.title));
    else notifyMany(participants, ...TEMPLATES.eventUpdated(updated.title));

    // Переход в 'published' из другого статуса — это анонс: уведомляем всех одобренных волонтёров.
    if (req.body.status === 'published' && event.status !== 'published') {
      const audience = db
        .prepare(`SELECT id FROM users WHERE role = 'volunteer' AND application_status = 'approved' AND is_blocked = 0`)
        .all()
        .map((r) => r.id);
      notifyMany(audience, ...TEMPLATES.newEvent(updated.title));
    }

    if (req.body.coordinator_id && req.body.coordinator_id !== event.coordinator_id)
      notify(updated.coordinator_id, 'event_assigned', 'Вы координатор мероприятия', updated.title, '#/events');

    res.json({ event: await publicEvent(updated, req.user.id) });
  })
);

eventsRouter.delete(
  '/:id',
  requireRole('admin'),
  wrap(async (req, res) => {
    const event = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
    if (!event) throw notFound('Мероприятие не найдено');
    await db.prepare(`DELETE FROM events WHERE id = ?`).run(event.id);
    await logActivity(req.user.id, null, 'event_deleted', `event:${event.id}`);
    res.json({ ok: true });
  })
);

/** Запись волонтера на мероприятие. */
eventsRouter.post(
  '/:id/signup',
  requireRole('volunteer'),
  requireApproved,
  wrap(async (req, res) => {
    const event = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
    if (!event) throw notFound('Мероприятие не найдено');
    if (event.status !== 'published') throw bad('Запись на это мероприятие закрыта');
    if (parseDbDate(event.starts_at) < new Date()) throw bad('Мероприятие уже началось');

    const existing = db
      .prepare(`SELECT * FROM registrations WHERE event_id = ? AND user_id = ?`)
      .get(event.id, req.user.id);
    if (existing && existing.status !== 'cancelled') throw bad('Вы уже записаны на это мероприятие');

    if (existing) {
      await db.prepare(`UPDATE registrations SET status = 'signed_up', updated_at = datetime('now') WHERE id = ?`).run(existing.id);
    } else {
      await db.prepare(`INSERT INTO registrations (event_id, user_id, status) VALUES (?, ?, 'signed_up')`).run(
        event.id,
        req.user.id
      );
    }
    await logActivity(req.user.id, req.user.id, 'event_signup', `event:${event.id}`);
    if (event.coordinator_id)
      notify(event.coordinator_id, 'new_signup', 'Новая запись на мероприятие', `${req.user.full_name || req.user.phone} — ${event.title}`, '#/teams');

    res.status(201).json({ event: await publicEvent(event, req.user.id) });
  })
);

/** Отмена записи — не позднее установленного срока до начала. */
eventsRouter.post(
  '/:id/cancel',
  requireRole('volunteer'),
  wrap(async (req, res) => {
    const event = await db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
    if (!event) throw notFound('Мероприятие не найдено');
    const reg = await db.prepare(`SELECT * FROM registrations WHERE event_id = ? AND user_id = ?`).get(event.id, req.user.id);
    if (!reg || reg.status === 'cancelled') throw bad('Записи на это мероприятие нет');

    const deadline = new Date(parseDbDate(event.starts_at).getTime() - config.cancelDeadlineHours * 3600 * 1000);
    if (new Date() > deadline)
      throw bad(`Отменить запись можно не позднее чем за ${config.cancelDeadlineHours} ч до начала. Свяжитесь с координатором`);

    await db.prepare(`UPDATE registrations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(reg.id);
    await logActivity(req.user.id, req.user.id, 'event_cancel', `event:${event.id}`);
    if (event.coordinator_id)
      notify(event.coordinator_id, 'signup_cancelled', 'Волонтер отменил запись', `${req.user.full_name || req.user.phone} — ${event.title}`, '#/teams');

    res.json({ event: await publicEvent(event, req.user.id) });
  })
);

function assertCoordinator(id) {
  const user = await db.prepare(`SELECT role FROM users WHERE id = ?`).get(id);
  if (!user) throw bad('Координатор не найден');
  if (!['coordinator', 'admin'].includes(user.role)) throw bad('Назначить координатором можно только пользователя с ролью «Координатор»');
}
