import { config } from '../config.js';
import { db } from '../db.js';

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Создает код подтверждения и «отправляет» его.
 * В режиме `console` код печатается в лог и возвращается клиенту (только для разработки).
 * Для боевого запуска подключите провайдера в `deliver()`.
 */
export function issueCode(phone, purpose) {
  const code = generateCode();
  await db.prepare(
    `INSERT INTO phone_codes (phone, code, purpose, expires_at)
     VALUES (?, ?, ?, datetime('now', ?))`
  ).run(phone, code, purpose, `+${config.smsCodeTtlMinutes} minutes`);
  deliver(phone, `Код подтверждения: ${code}`);
  return config.smsProvider === 'console' ? code : null;
}

function deliver(phone, text) {
  if (config.smsProvider === 'console') {
    console.log(`[SMS -> ${phone}] ${text}`);
    return;
  }
  // Точка интеграции с провайдером (Mobizon, Twilio, SMSC и т. п.):
  // await fetch(provider.url, { method: 'POST', body: ... })
  console.warn(`SMS-провайдер "${config.smsProvider}" не подключен. Сообщение не отправлено.`);
}

/** Проверяет код. Возвращает true и гасит код, если он верный. */
export function verifyCode(phone, code, purpose) {
  const row = db
    .prepare(
      `SELECT * FROM phone_codes
        WHERE phone = ? AND purpose = ? AND used = 0 AND expires_at > datetime('now')
        ORDER BY id DESC LIMIT 1`
    )
    .get(phone, purpose);
  if (!row) return false;
  if (row.attempts >= 5) return false;
  if (row.code !== String(code)) {
    await db.prepare(`UPDATE phone_codes SET attempts = attempts + 1 WHERE id = ?`).run(row.id);
    return false;
  }
  await db.prepare(`UPDATE phone_codes SET used = 1 WHERE id = ?`).run(row.id);
  return true;
}
