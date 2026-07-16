import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/helpers.js';
import { DIRECTION_TITLES } from '../utils/dictionaries.js';

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, requireRole('admin'));

/** Сводка для дашборда администратора. */
analyticsRouter.get(
  '/dashboard',
  wrap((_req, res) => {
    const one = (sql, ...p) => db.prepare(sql).get(...p);

    const totals = one(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'volunteer') AS volunteers_total,
        (SELECT COUNT(*) FROM users WHERE role = 'volunteer' AND application_status = 'pending') AS new_applications,
        (SELECT COUNT(*) FROM users WHERE role = 'coordinator') AS coordinators_total,
        (SELECT COUNT(*) FROM events WHERE status = 'finished') AS events_finished,
        (SELECT COUNT(*) FROM events WHERE starts_at >= datetime('now') AND status IN ('published','ongoing')) AS events_upcoming,
        (SELECT COALESCE(SUM(hours), 0) FROM hour_logs) AS hours_total
    `);

    // Активный волонтер — участвовал хотя бы раз за последние 90 дней.
    const active = one(`
      SELECT COUNT(DISTINCT r.user_id) AS c
        FROM registrations r JOIN events e ON e.id = r.event_id
       WHERE r.attendance = 'present' AND e.starts_at >= datetime('now', '-90 days')
    `).c;

    const approved = one(`SELECT COUNT(*) AS c FROM users WHERE role = 'volunteer' AND application_status = 'approved'`).c;
    const avgHours = approved ? Number(totals.hours_total) / approved : 0;

    const byDirection = db
      .prepare(
        `SELECT je.value AS direction, COUNT(*) AS count
           FROM applications a, json_each(a.directions_json) je
          WHERE a.status = 'approved'
          GROUP BY je.value ORDER BY count DESC`
      )
      .all()
      .map((r) => ({ key: r.direction, title: DIRECTION_TITLES[r.direction] || r.direction, count: r.count }));

    const registrationsByMonth = db
      .prepare(
        `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
           FROM users WHERE role = 'volunteer'
          GROUP BY month ORDER BY month DESC LIMIT 12`
      )
      .all()
      .reverse();

    const topVolunteers = db
      .prepare(
        `SELECT u.id, u.full_name, u.city, s.total_hours, s.events_count
           FROM users u JOIN volunteer_stats s ON s.user_id = u.id
          WHERE u.role = 'volunteer' AND s.total_hours > 0
          ORDER BY s.total_hours DESC LIMIT 10`
      )
      .all();

    const topCoordinators = db
      .prepare(
        `SELECT u.id, u.full_name,
                COUNT(DISTINCT e.id) AS events_count,
                COALESCE(SUM(r.hours), 0) AS team_hours,
                (SELECT COUNT(*) FROM users v WHERE v.coordinator_id = u.id) AS team_size
           FROM users u
           LEFT JOIN events e ON e.coordinator_id = u.id AND e.status = 'finished'
           LEFT JOIN registrations r ON r.event_id = e.id
          WHERE u.role = 'coordinator'
          GROUP BY u.id ORDER BY events_count DESC, team_hours DESC LIMIT 10`
      )
      .all();

    const byStatus = db
      .prepare(
        `SELECT application_status AS status, COUNT(*) AS count
           FROM users WHERE role = 'volunteer' GROUP BY application_status`
      )
      .all();

    const byType = db
      .prepare(
        `SELECT volunteer_type AS type, COUNT(*) AS count
           FROM users WHERE role = 'volunteer' AND volunteer_type IS NOT NULL GROUP BY volunteer_type`
      )
      .all();

    res.json({
      totals: {
        volunteers_total: totals.volunteers_total,
        new_applications: totals.new_applications,
        active_volunteers: active,
        coordinators_total: totals.coordinators_total,
        events_finished: totals.events_finished,
        events_upcoming: totals.events_upcoming,
        hours_total: Number(totals.hours_total),
        avg_hours_per_volunteer: Math.round(avgHours * 10) / 10,
      },
      by_direction: byDirection,
      by_status: byStatus,
      by_type: byType,
      registrations_by_month: registrationsByMonth,
      top_volunteers: topVolunteers,
      top_coordinators: topCoordinators,
    });
  })
);
