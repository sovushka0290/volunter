import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify, TEMPLATES } from '../services/notifications.js';
import { bad, forbidden, notFound, wrap, parseDbDate } from '../utils/helpers.js';
import { parseJson } from '../utils/helpers.js';
import { publicEvent } from './_serialize.js';

export const coordinatorRouter = Router();
coordinatorRouter.use(requireAuth, requireRole('coordinator', 'admin'));

/** Доступ к мероприятию: свое — координатору, любое — администратору. */
function loadEvent(req) {
  const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(req.params.id);
  if (!event) throw notFound('Мероприятие не найдено');
  if (req.user.role !== 'admin' && event.coordinator_id !== req.user.id)
    throw forbidden('Это мероприятие закреплено за другим координатором');
  return event;
}

/** Мероприятия координатора: текущие и прошедшие. */
coordinatorRouter.get(
  '/events',
  wrap((req, res) => {
    const rows =
      req.user.role === 'admin' && req.query.all === '1'
        ? db.prepare(`SELECT * FROM events ORDER BY starts_at DESC`).all()
        : db.prepare(`SELECT * FROM events WHERE coordinator_id = ? ORDER BY starts_at DESC`).all(req.user.id);
    const now = new Date();
    const items = rows.map((e) => publicEvent(e, req.user.id));
    res.json({
      upcoming: items.filter((e) => parseDbDate(e.starts_at) >= now && e.status !== 'cancelled'),
      past: items.filter((e) => parseDbDate(e.starts_at) < now || e.status === 'finished'),
      all: items,
    });
  })
);

/** Список записавшихся на мероприятие с данными анкеты. */
coordinatorRouter.get(
  '/events/:id/registrations',
  wrap((req, res) => {
    const event = loadEvent(req);
    const rows = db
      .prepare(
        `SELECT r.*, u.full_name, u.phone, u.city, u.birth_date, u.photo_url,
                a.skills_json, a.directions_json,
                s.total_hours, s.events_count
           FROM registrations r
           JOIN users u ON u.id = r.user_id
           LEFT JOIN volunteer_stats s ON s.user_id = u.id
           LEFT JOIN applications a
                  ON a.id = (SELECT MAX(id) FROM applications WHERE user_id = u.id AND status = 'approved')
          WHERE r.event_id = ?
          ORDER BY CASE r.status WHEN 'accepted' THEN 0 WHEN 'signed_up' THEN 1 ELSE 2 END, r.id`
      )
      .all(event.id);

    res.json({
      event: publicEvent(event, req.user.id),
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        team_role: r.team_role,
        attendance: r.attendance,
        hours: r.hours,
        comment: r.comment,
        volunteer: {
          id: r.user_id,
          full_name: r.full_name,
          phone: r.phone,
          city: r.city,
          photo_url: r.photo_url,
          skills: parseJson(r.skills_json, []),
          directions: parseJson(r.directions_json, []),
          total_hours: Number(r.total_hours || 0),
          events_count: Number(r.events_count || 0),
        },
      })),
    });
  })
);

/** Решение по участнику: accept | reject, распределение роли в команде. */
coordinatorRouter.post(
  '/registrations/:regId/decision',
  wrap((req, res) => {
    const reg = db.prepare(`SELECT * FROM registrations WHERE id = ?`).get(req.params.regId);
    if (!reg) throw notFound('Запись не найдена');
    const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(reg.event_id);
    if (req.user.role !== 'admin' && event.coordinator_id !== req.user.id) throw forbidden();

    const map = { accept: 'accepted', reject: 'rejected' };
    const status = map[req.body.decision];
    if (!status) throw bad('Решение должно быть accept или reject');

    if (status === 'accepted') {
      const accepted = db
        .prepare(`SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'accepted'`)
        .get(event.id).c;
      if (accepted >= event.needed_count && !req.body.force)
        throw bad(`Набрана команда: ${accepted} из ${event.needed_count}. Передайте force=true, чтобы добавить сверх плана`);
    }

    db.prepare(
      `UPDATE registrations SET status = ?, team_role = COALESCE(?, team_role), comment = COALESCE(?, comment), updated_at = datetime('now') WHERE id = ?`
    ).run(status, req.body.team_role ?? null, req.body.comment ?? null, reg.id);

    logActivity(req.user.id, reg.user_id, `registration_${status}`, `event:${event.id}`);
    notify(
      reg.user_id,
      ...(status === 'accepted'
        ? TEMPLATES.participationAccepted(event.title)
        : TEMPLATES.participationRejected(event.title))
    );

    res.json({ ok: true, status });
  })
);

/** Явка и часы. Часы начисляются один раз и пересчитываются при исправлении. */
coordinatorRouter.post(
  '/registrations/:regId/attendance',
  wrap((req, res) => {
    const reg = db.prepare(`SELECT * FROM registrations WHERE id = ?`).get(req.params.regId);
    if (!reg) throw notFound('Запись не найдена');
    const event = db.prepare(`SELECT * FROM events WHERE id = ?`).get(reg.event_id);
    if (req.user.role !== 'admin' && event.coordinator_id !== req.user.id) throw forbidden();
    if (reg.status !== 'accepted') throw bad('Отмечать явку можно только у принятых в команду');

    const attendance = req.body.attendance;
    if (!['present', 'absent'].includes(attendance)) throw bad('Отметьте явку: present или absent');
    const hours = attendance === 'present' ? Number(req.body.hours ?? 0) : 0;
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw bad('Часы указываются числом от 0 до 24');

    db.transaction(() => {
      db.prepare(
        `UPDATE registrations SET attendance = ?, hours = ?, comment = COALESCE(?, comment), updated_at = datetime('now') WHERE id = ?`
      ).run(attendance, hours, req.body.comment ?? null, reg.id);

      // Пересчет: удаляем прежнее начисление по этому мероприятию и пишем актуальное.
      db.prepare(`DELETE FROM hour_logs WHERE user_id = ? AND event_id = ?`).run(reg.user_id, event.id);
      if (hours > 0)
        db.prepare(
          `INSERT INTO hour_logs (user_id, event_id, hours, reason, created_by) VALUES (?, ?, ?, ?, ?)`
        ).run(reg.user_id, event.id, hours, `Мероприятие «${event.title}»`, req.user.id);
    })();

    logActivity(req.user.id, reg.user_id, 'attendance_marked', `event:${event.id} ${attendance} ${hours}ч`);
    if (hours > 0) notify(reg.user_id, ...TEMPLATES.hoursAdded(hours, event.title));

    res.json({ ok: true, attendance, hours });
  })
);

/** Массовая отметка явки после мероприятия. */
coordinatorRouter.post(
  '/events/:id/close',
  wrap((req, res) => {
    const event = loadEvent(req);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) throw bad('Передайте список участников с явкой и часами');

    const results = [];
    db.transaction(() => {
      for (const item of items) {
        const reg = db
          .prepare(`SELECT * FROM registrations WHERE id = ? AND event_id = ?`)
          .get(item.registration_id, event.id);
        if (!reg || reg.status !== 'accepted') continue;
        const attendance = item.attendance === 'present' ? 'present' : 'absent';
        const hours = attendance === 'present' ? Math.max(0, Math.min(24, Number(item.hours) || 0)) : 0;

        db.prepare(
          `UPDATE registrations SET attendance = ?, hours = ?, comment = COALESCE(?, comment), updated_at = datetime('now') WHERE id = ?`
        ).run(attendance, hours, item.comment ?? null, reg.id);
        db.prepare(`DELETE FROM hour_logs WHERE user_id = ? AND event_id = ?`).run(reg.user_id, event.id);
        if (hours > 0)
          db.prepare(`INSERT INTO hour_logs (user_id, event_id, hours, reason, created_by) VALUES (?, ?, ?, ?, ?)`).run(
            reg.user_id,
            event.id,
            hours,
            `Мероприятие «${event.title}»`,
            req.user.id
          );
        results.push({ registration_id: reg.id, user_id: reg.user_id, attendance, hours });
      }
      db.prepare(`UPDATE events SET status = 'finished', updated_at = datetime('now') WHERE id = ?`).run(event.id);
    })();

    for (const r of results) if (r.hours > 0) notify(r.user_id, ...TEMPLATES.hoursAdded(r.hours, event.title));
    logActivity(req.user.id, null, 'event_closed', `event:${event.id}`);
    res.json({ ok: true, updated: results.length });
  })
);

/** Команда координатора: закрепленные волонтеры и их статистика. */
coordinatorRouter.get(
  '/team',
  wrap((req, res) => {
    const coordinatorId = req.user.role === 'admin' && req.query.coordinator_id ? req.query.coordinator_id : req.user.id;
    const members = db
      .prepare(
        `SELECT u.id, u.full_name, u.phone, u.city, u.volunteer_type, u.application_status,
                s.total_hours, s.events_count, s.last_event_at
           FROM users u LEFT JOIN volunteer_stats s ON s.user_id = u.id
          WHERE u.coordinator_id = ? AND u.role = 'volunteer'
          ORDER BY s.total_hours DESC`
      )
      .all(coordinatorId);

    const stats = db
      .prepare(
        `SELECT COUNT(*) AS events_total,
                SUM(CASE WHEN starts_at >= datetime('now') AND status != 'cancelled' THEN 1 ELSE 0 END) AS upcoming
           FROM events WHERE coordinator_id = ?`
      )
      .get(coordinatorId);

    res.json({
      members: members.map((m) => ({ ...m, total_hours: Number(m.total_hours || 0), events_count: Number(m.events_count || 0) })),
      stats: {
        members_count: members.length,
        events_total: Number(stats?.events_total || 0),
        upcoming_events: Number(stats?.upcoming || 0),
        team_hours: members.reduce((sum, m) => sum + Number(m.total_hours || 0), 0),
      },
    });
  })
);
