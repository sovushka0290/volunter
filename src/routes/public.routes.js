import { Router } from 'express';
import { db } from '../db.js';
import { bad, wrap } from '../utils/helpers.js';
import { publicEvent } from './_serialize.js';

export const publicRouter = Router();

/** Получить список всех опубликованных анонсов (мероприятий) */
publicRouter.get(
  '/events',
  wrap(async (req, res) => {
    const rows = await db.prepare(`SELECT * FROM events WHERE status = 'published' ORDER BY starts_at DESC`).all();
    // For public feed, we don't have a logged-in user, so we pass null
    const items = await Promise.all(rows.map((e) => publicEvent(e, null)));
    res.json({ items });
  })
);

/** Отправить анкету (без регистрации) */
publicRouter.post(
  '/questionnaires',
  wrap(async (req, res) => {
    const { tg_username, answers } = req.body;
    if (!tg_username || !tg_username.trim()) throw bad('Укажите ваш Telegram username');
    
    // Normalize TG username (remove @ if present)
    const normalizedTg = tg_username.trim().replace(/^@/, '');
    
    const answersJson = JSON.stringify(answers || {});
    
    await db.prepare(
      `INSERT INTO questionnaires (tg_username, answers_json) VALUES (?, ?)`
    ).run(normalizedTg, answersJson);
    
    res.json({ ok: true });
  })
);
