export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const bad = (message, details) => new ApiError(400, message, details);
export const forbidden = (message = 'Недостаточно прав') => new ApiError(403, message);
export const notFound = (message = 'Не найдено') => new ApiError(404, message);

/** Приводит телефон к формату +7XXXXXXXXXX (только цифры и ведущий плюс). */
export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null;
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.length < 10 || digits.length > 15) return null;
  return '+' + digits;
}

export function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value ?? '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function toArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) return [value];
  return [];
}

/** Полных лет на сегодня. Возвращает null при некорректной дате. */
export function ageFrom(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

/**
 * Разбирает временную метку из БД как UTC.
 * Все метки хранятся в UTC (datetime('now') и seed через toISOString),
 * но строка вида 'YYYY-MM-DD HH:MM' без зоны трактуется движком как локальная —
 * поэтому явно дописываем 'Z', если смещение не указано.
 */
export function parseDbDate(value) {
  if (!value) return null;
  const iso = String(value).replace(' ', 'T');
  const d = new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : iso + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function requireFields(body, fields) {
  const missing = fields.filter((f) => body?.[f] === undefined || body[f] === '' || body[f] === null);
  if (missing.length) throw bad(`Заполните обязательные поля: ${missing.join(', ')}`);
}

/** Обертка для async-роутов: ошибки уходят в общий обработчик. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
