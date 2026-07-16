import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'app.db'),
  publicDir: path.join(__dirname, '..', 'public'),
  // Провайдер SMS. 'console' — коды печатаются в лог (режим разработки).
  smsProvider: process.env.SMS_PROVIDER || 'console',
  smsCodeTtlMinutes: Number(process.env.SMS_CODE_TTL_MINUTES || 10),
  // Отмена записи на мероприятие возможна не позднее чем за N часов до начала.
  cancelDeadlineHours: Number(process.env.CANCEL_DEADLINE_HOURS || 24),
  minAge: { organization: 14, party: 18 },
};
