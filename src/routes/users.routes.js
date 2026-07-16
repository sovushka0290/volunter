import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireRole, hashPassword } from '../middleware/auth.js';
import { notify, TEMPLATES } from '../services/notifications.js';
import { bad, notFound, normalizeContact, wrap } from '../utils/helpers.js';
import { publicUser } from './_serialize.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole('admin'));

const ROLES = ['volunteer', 'coordinator', 'admin'];

/** Список пользователей по роли. */
usersRouter.get(
  '/',
  wrap(async (req, res) => {
    const role = ROLES.includes(req.query.role) ? req.query.role : null;
    const rows = db
      .prepare(
        `SELECT * FROM users
          WHERE (? IS NULL OR role = ?)
            AND (? IS NULL OR full_name LIKE ? OR contact LIKE ?)
          ORDER BY created_at DESC LIMIT 500`
      )
      .all(role, role, req.query.q || null, `%${req.query.q || ''}%`, `%${req.query.q || ''}%`);
    res.json({ items: await Promise.all(rows.map(async (u) => await publicUser(u))) });
  })
);

/** Создание координатора или администратора вручную. */
usersRouter.post(
  '/',
  wrap(async (req, res) => {
    const contact = normalizeContact(req.body.contact);
    if (!contact) throw bad('Укажите корректный контакт');
    if (!ROLES.includes(req.body.role)) throw bad('Некорректная роль');
    if (typeof req.body.password !== 'string' || req.body.password.length < 8)
      throw bad('Пароль должен содержать минимум 8 символов');
    if (await db.prepare(`SELECT id FROM users WHERE contact = ?`).get(contact)) throw bad('Пользователь с таким контактом уже есть');

    const info = db
      .prepare(
        `INSERT INTO users (contact, password_hash, role, full_name, city, application_status)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        contact,
        hashPassword(req.body.password),
        req.body.role,
        req.body.full_name || null,
        req.body.city || null,
        req.body.role === 'volunteer' ? 'draft' : 'approved'
      );
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
    await logActivity(req.user.id, user.id, 'user_created', user.role);
    res.status(201).json({ user: await publicUser(user) });
  })
);

/** Изменение данных пользователя. */
usersRouter.patch(
  '/:id',
  wrap(async (req, res) => {
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!user) throw notFound('Пользователь не найден');

    const allowed = ['full_name', 'birth_date', 'gender', 'city', 'email', 'photo_url', 'volunteer_type', 'application_status'];
    const fields = allowed.filter((f) => req.body[f] !== undefined);
    if (!fields.length) throw bad('Нет полей для сохранения');
    await db.prepare(
      `UPDATE users SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...fields.map((f) => req.body[f] ?? null), user.id);
    await logActivity(req.user.id, user.id, 'user_updated', fields.join(','));
    res.json({ user: await publicUser(await db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id)) });
  })
);

/** Смена роли. */
usersRouter.post(
  '/:id/role',
  wrap(async (req, res) => {
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!user) throw notFound('Пользователь не найден');
    if (!ROLES.includes(req.body.role)) throw bad('Некорректная роль');
    if (user.id === req.user.id) throw bad('Нельзя изменить собственную роль');

    await db.transaction(async () => {
      await db.prepare(`UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?`).run(req.body.role, user.id);
      if (req.body.role !== 'volunteer')
        await db.prepare(`UPDATE users SET application_status = 'approved', coordinator_id = NULL WHERE id = ?`).run(user.id);
      // Волонтеры, закрепленные за бывшим координатором, освобождаются.
      if (user.role === 'coordinator' && req.body.role !== 'coordinator')
        await db.prepare(`UPDATE users SET coordinator_id = NULL WHERE coordinator_id = ?`).run(user.id);
    })();

    await logActivity(req.user.id, user.id, 'role_changed', `${user.role} -> ${req.body.role}`);
    notify(user.id, 'role_changed', 'Роль изменена', `Новая роль: ${req.body.role}`, '#/profile');
    res.json({ user: await publicUser(await db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id)) });
  })
);

/** Закрепление координатора за волонтерами. */
usersRouter.post(
  '/assign-coordinator',
  wrap(async (req, res) => {
    const coordinatorId = req.body.coordinator_id;
    const volunteerIds = Array.isArray(req.body.volunteer_ids) ? req.body.volunteer_ids : [];
    if (!volunteerIds.length) throw bad('Выберите волонтеров');

    let coordinator = null;
    if (coordinatorId !== null) {
      coordinator = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(coordinatorId);
      if (!coordinator) throw notFound('Координатор не найден');
      if (!['coordinator', 'admin'].includes(coordinator.role)) throw bad('У выбранного пользователя нет роли «Координатор»');
    }

    const stmt = await db.prepare(`UPDATE users SET coordinator_id = ?, updated_at = datetime('now') WHERE id = ? AND role = 'volunteer'`);
    await db.transaction(async () => volunteerIds.forEach((id) => stmt.run(coordinator?.id ?? null, id)))();

    for (const id of volunteerIds) {
      await logActivity(req.user.id, id, 'coordinator_assigned', coordinator ? String(coordinator.id) : 'снят');
      if (coordinator) notify(id, ...TEMPLATES.coordinatorAssigned(coordinator.full_name || coordinator.contact));
    }
    res.json({ ok: true, updated: volunteerIds.length });
  })
);

/** Блокировка и разблокировка. */
usersRouter.post(
  '/:id/block',
  wrap(async (req, res) => {
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!user) throw notFound('Пользователь не найден');
    if (user.id === req.user.id) throw bad('Нельзя заблокировать самого себя');
    const blocked = req.body.blocked === false ? 0 : 1;
    await db.prepare(`UPDATE users SET is_blocked = ?, updated_at = datetime('now') WHERE id = ?`).run(blocked, user.id);
    await logActivity(req.user.id, user.id, blocked ? 'user_blocked' : 'user_unblocked', req.body.reason || null);
    res.json({ user: await publicUser(await db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id)) });
  })
);

/** Сброс пароля администратором: генерируется временный пароль. */
usersRouter.post(
  '/:id/reset-password',
  wrap(async (req, res) => {
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!user) throw notFound('Пользователь не найден');
    const temporary = req.body.password || Math.random().toString(36).slice(-10);
    if (temporary.length < 8) throw bad('Пароль должен содержать минимум 8 символов');
    await db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
      hashPassword(temporary),
      user.id
    );
    await logActivity(req.user.id, user.id, 'password_reset_by_admin', null);
    notify(user.id, 'password_reset', 'Пароль сброшен', 'Администратор сбросил пароль. Войдите с временным паролем и смените его.', '#/profile');
    res.json({ ok: true, temporary_password: temporary });
  })
);

/** Удаление пользователя. Связанные записи удаляются каскадно. */
usersRouter.delete(
  '/:id',
  wrap(async (req, res) => {
    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
    if (!user) throw notFound('Пользователь не найден');
    if (user.id === req.user.id) throw bad('Нельзя удалить собственный аккаунт');
    await db.prepare(`DELETE FROM users WHERE id = ?`).run(user.id);
    await logActivity(req.user.id, null, 'user_deleted', `${user.contact} (${user.full_name || 'без имени'})`);
    res.json({ ok: true });
  })
);

/** История активности пользователя. */
usersRouter.get(
  '/:id/activity',
  wrap(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT l.*, a.full_name AS actor_name
           FROM activity_log l LEFT JOIN users a ON a.id = l.actor_id
          WHERE l.target_id = ? OR l.actor_id = ?
          ORDER BY l.id DESC LIMIT 200`
      )
      .all(req.params.id, req.params.id);
    res.json({ items: rows });
  })
);
