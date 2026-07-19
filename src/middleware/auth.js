import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../utils/helpers.js';

export const hashPassword = (plain) => plain;
export const checkPassword = (plain, hash) => plain === hash;

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

/** Требует валидный Bearer-токен. Кладет пользователя в req.user. */
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new ApiError(401, 'Нужна авторизация'));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // Admin is hardcoded, no DB lookup needed
    req.user = { id: payload.id, role: payload.role, contact: 'admin' };
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
