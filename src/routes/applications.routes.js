import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { config } from '../config.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify, TEMPLATES } from '../services/notifications.js';
import { ageFrom, bad, forbidden, notFound, requireFields, toArray, wrap } from '../utils/helpers.js';
import { ALL_DIRECTION_KEYS, ALL_SKILL_KEYS } from '../utils/dictionaries.js';
import { publicApplication, publicUser } from './_serialize.js';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

const TYPES = { organization: 'Волонтер организации (14+)', party: 'Партийное крыло (18+)' };

/** Выбор типа волонтерства. Проверяется возрастной порог. */
applicationsRouter.post(
  '/type',
  wrap((req, res) => {
    const type = req.body.volunteer_type;
    if (!TYPES[type]) throw bad('Выберите тип волонтерства');
    const birthDate = req.body.birth_date || req.user.birth_date;
    const age = ageFrom(birthDate);
    if (age === null) throw bad('Укажите дату рождения — от нее зависит доступный тип участия');
    const minAge = config.minAge[type];
    if (age < minAge) throw bad(`Для этого типа участия нужно ${minAge} лет и больше. Сейчас: ${age}`);

    db.prepare(
      `UPDATE users SET volunteer_type = ?, birth_date = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(type, birthDate, req.user.id);
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
    res.json({ user: publicUser(user) });
  })
);

/** Отправка анкеты на рассмотрение. Повторная отправка допустима после отклонения/доработки. */
applicationsRouter.post(
  '/',
  wrap((req, res) => {
    const user = req.user;
    if (!user.volunteer_type) throw bad('Сначала выберите тип волонтерства');
    if (['pending', 'approved'].includes(user.application_status))
      throw bad(
        user.application_status === 'pending'
          ? 'Анкета уже на рассмотрении'
          : 'Анкета уже одобрена. Изменения вносите через личные данные'
      );

    requireFields(req.body, ['full_name', 'birth_date', 'city', 'motivation']);
    const age = ageFrom(req.body.birth_date);
    if (age === null) throw bad('Некорректная дата рождения');
    if (age < config.minAge[user.volunteer_type])
      throw bad(`Минимальный возраст для выбранного типа: ${config.minAge[user.volunteer_type]} лет`);

    const skills = toArray(req.body.skills).filter((s) => ALL_SKILL_KEYS.includes(s));
    const directions = toArray(req.body.directions).filter((d) => ALL_DIRECTION_KEYS.includes(d));
    if (!directions.length) throw bad('Выберите хотя бы одно направление деятельности');

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE users
            SET full_name = ?, birth_date = ?, gender = ?, city = ?, email = ?,
                application_status = 'pending', updated_at = datetime('now')
          WHERE id = ?`
      ).run(
        req.body.full_name,
        req.body.birth_date,
        req.body.gender || null,
        req.body.city,
        req.body.email || null,
        user.id
      );

      const info = db
        .prepare(
          `INSERT INTO applications
             (user_id, volunteer_type, status, answers_json, education, occupation, languages_json,
              skills_json, directions_json, interests_json, qualities_json, goals, motivation,
              experience, has_car, has_laptop, free_time)
           VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          user.id,
          user.volunteer_type,
          JSON.stringify(req.body.answers || {}),
          req.body.education || null,
          req.body.occupation || null,
          JSON.stringify(toArray(req.body.languages)),
          JSON.stringify(skills),
          JSON.stringify(directions),
          JSON.stringify(toArray(req.body.interests)),
          JSON.stringify(toArray(req.body.qualities)),
          req.body.goals || null,
          req.body.motivation,
          req.body.experience || null,
          req.body.has_car ? 1 : 0,
          req.body.has_laptop ? 1 : 0,
          req.body.free_time || null
        );
      return info.lastInsertRowid;
    });

    const id = tx();
    logActivity(user.id, user.id, 'application_submitted', `application:${id}`);
    notify(user.id, ...TEMPLATES.applicationSubmitted());
    const application = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id);
    const fresh = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id);
    res.status(201).json({ application: publicApplication(application), user: publicUser(fresh) });
  })
);

/** Своя последняя анкета. */
applicationsRouter.get(
  '/mine',
  wrap((req, res) => {
    const app = db
      .prepare(`SELECT * FROM applications WHERE user_id = ? ORDER BY id DESC LIMIT 1`)
      .get(req.user.id);
    res.json({ application: publicApplication(app) });
  })
);

/** Очередь модерации. */
applicationsRouter.get(
  '/',
  requireRole('admin'),
  wrap((req, res) => {
    const status = req.query.status || 'pending';
    const rows = db
      .prepare(
        `SELECT a.*, u.full_name, u.contact, u.city, u.birth_date
           FROM applications a JOIN users u ON u.id = a.user_id
          WHERE a.id = (SELECT MAX(id) FROM applications WHERE user_id = a.user_id)
            AND (? = 'all' OR a.status = ?)
          ORDER BY a.id DESC`
      )
      .all(status, status);
    res.json({
      items: rows.map((r) => ({
        ...publicApplication(r),
        user: { id: r.user_id, full_name: r.full_name, contact: r.contact, city: r.city, age: ageFrom(r.birth_date) },
      })),
    });
  })
);

/** Карточка заявки. Свою анкету видит владелец, чужие — только администратор. */
applicationsRouter.get(
  '/:id',
  wrap((req, res) => {
    const app = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(req.params.id);
    if (!app) throw notFound('Заявка не найдена');
    if (req.user.role !== 'admin' && app.user_id !== req.user.id) throw forbidden();
    const owner = db.prepare(`SELECT * FROM users WHERE id = ?`).get(app.user_id);
    res.json({ application: publicApplication(app), user: publicUser(owner) });
  })
);

/** Решение по заявке: approve | reject | revision. */
applicationsRouter.post(
  '/:id/decision',
  requireRole('admin'),
  wrap((req, res) => {
    const decision = req.body.decision;
    const map = { approve: 'approved', reject: 'rejected', revision: 'revision' };
    if (!map[decision]) throw bad('Решение должно быть одним из: approve, reject, revision');

    const app = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(req.params.id);
    if (!app) throw notFound('Заявка не найдена');
    if (app.status !== 'pending') throw bad('По этой заявке решение уже принято');

    const status = map[decision];
    const comment = req.body.comment || null;
    if (decision !== 'approve' && !comment) throw bad('Укажите причину — она уйдет волонтеру');

    db.transaction(() => {
      db.prepare(
        `UPDATE applications SET status = ?, review_comment = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`
      ).run(status, comment, req.user.id, app.id);
      db.prepare(`UPDATE users SET application_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
        status === 'revision' ? 'revision' : status,
        app.user_id
      );
    })();

    logActivity(req.user.id, app.user_id, `application_${status}`, comment);
    if (status === 'approved') notify(app.user_id, ...TEMPLATES.approved());
    if (status === 'rejected') notify(app.user_id, ...TEMPLATES.rejected(comment));
    if (status === 'revision') notify(app.user_id, ...TEMPLATES.revision(comment));

    const updated = db.prepare(`SELECT * FROM applications WHERE id = ?`).get(app.id);
    res.json({ application: publicApplication(updated) });
  })
);
