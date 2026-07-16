import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { wrap, bad, parseDbDate } from '../utils/helpers.js';
import { publicUser, publicApplication } from './_serialize.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

/** Личный кабинет: профиль, статус заявки, часы, координатор, история. */
profileRouter.get(
  '/',
  wrap((req, res) => {
    const application = db
      .prepare(`SELECT * FROM applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
      .get(req.user.id);

    const history = db
      .prepare(
        `SELECT r.id, r.status, r.attendance, r.hours, r.comment,
                e.id AS event_id, e.title, e.starts_at, e.location, e.status AS event_status
           FROM registrations r
           JOIN events e ON e.id = r.event_id
          WHERE r.user_id = ?
          ORDER BY e.starts_at DESC`
      )
      .all(req.user.id);

    const hours = db
      .prepare(
        `SELECT h.id, h.hours, h.reason, h.created_at, e.title AS event_title
           FROM hour_logs h
           LEFT JOIN events e ON e.id = h.event_id
          WHERE h.user_id = ?
          ORDER BY h.id DESC`
      )
      .all(req.user.id);

    const upcoming = history.filter(
      (h) => h.event_status !== 'cancelled' && parseDbDate(h.starts_at) >= new Date() && h.status !== 'cancelled'
    );

    res.json({
      user: publicUser(req.user),
      application: publicApplication(application),
      history,
      upcoming,
      hours,
      achievements: buildAchievements(req.user.id),
    });
  })
);

/** Редактирование личных данных. */
profileRouter.patch(
  '/',
  wrap((req, res) => {
    const allowed = ['full_name', 'birth_date', 'gender', 'city', 'email', 'photo_url'];
    const fields = allowed.filter((f) => req.body[f] !== undefined);
    if (!fields.length) throw bad('Нет полей для сохранения');
    if (req.body.gender && !['male', 'female'].includes(req.body.gender)) throw bad('Некорректное значение поля «пол»');

    db.prepare(
      `UPDATE users SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...fields.map((f) => req.body[f] ?? null), req.user.id);

    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    res.json({ user: publicUser(user) });
  })
);

/** Уведомления пользователя. */
profileRouter.get(
  '/notifications',
  wrap((req, res) => {
    const items = db
      .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100`)
      .all(req.user.id);
    const unread = items.filter((n) => !n.is_read).length;
    res.json({ items: items.map((n) => ({ ...n, is_read: !!n.is_read })), unread });
  })
);

profileRouter.post(
  '/notifications/read',
  wrap((req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : null;
    if (ids?.length) {
      const stmt = db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`);
      const tx = db.transaction((list) => list.forEach((id) => stmt.run(id, req.user.id)));
      tx(ids);
    } else {
      db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.user.id);
    }
    res.json({ ok: true });
  })
);

/** Простые достижения на основе часов и мероприятий. */
function buildAchievements(userId) {
  const stats = db.prepare(`SELECT * FROM volunteer_stats WHERE user_id = ?`).get(userId) || {};
  const hours = Number(stats.total_hours || 0);
  const events = Number(stats.events_count || 0);
  const list = [
    { key: 'first_event', title: 'Первое мероприятие', earned: events >= 1 },
    { key: 'five_events', title: '5 мероприятий', earned: events >= 5 },
    { key: 'ten_hours', title: '10 часов', earned: hours >= 10 },
    { key: 'fifty_hours', title: '50 часов', earned: hours >= 50 },
    { key: 'hundred_hours', title: '100 часов', earned: hours >= 100 },
  ];
  return list;
}
