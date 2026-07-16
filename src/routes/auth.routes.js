import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, logActivity } from '../db.js';
import { issueCode, verifyCode } from '../services/sms.js';
import { notify, TEMPLATES } from '../services/notifications.js';
import { hashPassword, checkPassword, signToken, requireAuth } from '../middleware/auth.js';
import { bad, normalizePhone, requireFields, wrap, ApiError } from '../utils/helpers.js';
import { publicUser } from './_serialize.js';

export const authRouter = Router();

const codeLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

function validPassword(pwd) {
  return typeof pwd === 'string' && pwd.length >= 8;
}

/** Шаг 1 регистрации: отправка кода на телефон. */
authRouter.post(
  '/request-code',
  codeLimiter,
  wrap((req, res) => {
    const phone = normalizePhone(req.body.phone);
    if (!phone) throw bad('Укажите корректный номер телефона');
    const purpose = req.body.purpose === 'reset' ? 'reset' : 'register';

    const existing = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
    if (purpose === 'register' && existing) throw bad('Этот номер уже зарегистрирован. Войдите в аккаунт');
    if (purpose === 'reset' && !existing) throw bad('Аккаунт с таким номером не найден');

    const devCode = issueCode(phone, purpose);
    res.json({ ok: true, phone, ...(devCode ? { devCode } : {}) });
  })
);

/** Шаг 2 регистрации: подтверждение кода и создание аккаунта. */
authRouter.post(
  '/register',
  wrap((req, res) => {
    requireFields(req.body, ['phone', 'code', 'password']);
    const phone = normalizePhone(req.body.phone);
    if (!phone) throw bad('Укажите корректный номер телефона');
    if (!validPassword(req.body.password)) throw bad('Пароль должен содержать минимум 8 символов');
    if (db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone)) throw bad('Этот номер уже зарегистрирован');
    if (!verifyCode(phone, req.body.code, 'register')) throw bad('Код неверный или истек');

    const info = db
      .prepare(
        `INSERT INTO users (phone, password_hash, role, full_name, phone_verified, application_status)
         VALUES (?, ?, 'volunteer', ?, 1, 'draft')`
      )
      .run(phone, hashPassword(req.body.password), req.body.full_name || null);

    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
    logActivity(user.id, user.id, 'register', phone);
    notify(user.id, ...TEMPLATES.registered());
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

/** Вход по телефону и паролю. */
authRouter.post(
  '/login',
  loginLimiter,
  wrap((req, res) => {
    requireFields(req.body, ['phone', 'password']);
    const phone = normalizePhone(req.body.phone);
    const user = phone ? db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone) : null;
    if (!user || !checkPassword(req.body.password, user.password_hash))
      throw new ApiError(401, 'Неверный номер или пароль');
    if (user.is_blocked) throw new ApiError(403, 'Учетная запись заблокирована');
    logActivity(user.id, user.id, 'login', null);
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

/** Восстановление пароля: код + новый пароль. */
authRouter.post(
  '/reset-password',
  wrap((req, res) => {
    requireFields(req.body, ['phone', 'code', 'password']);
    const phone = normalizePhone(req.body.phone);
    if (!validPassword(req.body.password)) throw bad('Пароль должен содержать минимум 8 символов');
    const user = phone ? db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone) : null;
    if (!user) throw bad('Аккаунт с таким номером не найден');
    if (!verifyCode(phone, req.body.code, 'reset')) throw bad('Код неверный или истек');

    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
      hashPassword(req.body.password),
      user.id
    );
    logActivity(user.id, user.id, 'password_reset', null);
    res.json({ ok: true });
  })
);

/** Смена пароля из личного кабинета. */
authRouter.post(
  '/change-password',
  requireAuth,
  wrap((req, res) => {
    requireFields(req.body, ['current_password', 'new_password']);
    if (!checkPassword(req.body.current_password, req.user.password_hash))
      throw bad('Текущий пароль указан неверно');
    if (!validPassword(req.body.new_password)) throw bad('Пароль должен содержать минимум 8 символов');
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(
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
  wrap((req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);
