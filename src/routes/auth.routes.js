import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, logActivity } from '../db.js';
import { notify, TEMPLATES } from '../services/notifications.js';
import { hashPassword, checkPassword, signToken, requireAuth } from '../middleware/auth.js';
import { bad, normalizeContact, requireFields, wrap, ApiError } from '../utils/helpers.js';
import { await publicUser } from './_serialize.js';

export const authRouter = Router();

const codeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

function validPassword(pwd) {
  return typeof pwd === 'string' && pwd.length >= 8;
}

/** Регистрация: Telegram/Email и пароль. */
authRouter.post(
  '/register',
  wrap(async (req, res) => {
    requireFields(req.body, ['contact', 'password']);
    const contact = normalizeContact(req.body.contact);
    if (!contact) throw bad('Укажите корректный контакт (Telegram или Email)');
    if (!validPassword(req.body.password)) throw bad('Пароль должен содержать минимум 8 символов');
    if (await db.prepare(`SELECT id FROM users WHERE contact = ?`).get(contact)) throw bad('Этот контакт уже зарегистрирован');

    const info = db
      .prepare(
        `INSERT INTO users (contact, password_hash, role, full_name, application_status)
         VALUES (?, ?, 'volunteer', ?, 'draft')`
      )
      .run(contact, hashPassword(req.body.password), req.body.full_name || null);

    const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
    await logActivity(user.id, user.id, 'register', contact);
    notify(user.id, ...TEMPLATES.registered());
    res.status(201).json({ token: signToken(user), user: await publicUser(user) });
  })
);

/** Вход по контакту и паролю. */
authRouter.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    requireFields(req.body, ['contact', 'password']);
    const contact = normalizeContact(req.body.contact);
    const user = contact ? await db.prepare(`SELECT * FROM users WHERE contact = ?`).get(contact) : null;
    if (!user || !checkPassword(req.body.password, user.password_hash))
      throw new ApiError(401, 'Неверный контакт или пароль');
    if (user.is_blocked) throw new ApiError(403, 'Учетная запись заблокирована');
    await logActivity(user.id, user.id, 'login', null);
    res.json({ token: signToken(user), user: await publicUser(user) });
  })
);

/** Смена пароля из личного кабинета. */
authRouter.post(
  '/change-password',
  requireAuth,
  wrap(async (req, res) => {
    requireFields(req.body, ['current_password', 'new_password']);
    if (!checkPassword(req.body.current_password, req.user.password_hash))
      throw bad('Текущий пароль указан неверно');
    if (!validPassword(req.body.new_password)) throw bad('Пароль должен содержать минимум 8 символов');
    await db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
      hashPassword(req.body.new_password),
      req.user.id
    );
    res.json({ ok: true });
  })
);

/** Текущий пользователь. */
authRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ user: await publicUser(req.user) });
  })
);
