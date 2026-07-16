import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { db } from '../db.js';
import { ApiError } from '../utils/helpers.js';

export const hashPassword = (plain) => bcrypt.hashSync(plain, 10);
export const checkPassword = (plain, hash) => bcrypt.compareSync(plain, hash);

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Требует валидный Bearer-токен. Кладет пользователя в req.user. */
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Нужна авторизация'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(payload.id);
    if (!user) return next(new ApiError(401, 'Пользователь не найден'));
    if (user.is_blocked) return next(new ApiError(403, 'Учетная запись заблокирована'));
    req.user = user;
    next();
  } catch {
    next(new ApiError(401, 'Сессия истекла. Войдите заново'));
  }
}

/** Ограничивает доступ списком ролей. */
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Нужна авторизация'));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, 'Недостаточно прав'));
    next();
  };

/** Волонтер получает доступ к мероприятиям только после одобрения анкеты. */
export function requireApproved(req, _res, next) {
  if (req.user.role !== 'volunteer') return next();
  if (req.user.application_status !== 'approved')
    return next(new ApiError(403, 'Доступ откроется после одобрения заявки'));
  next();
}
