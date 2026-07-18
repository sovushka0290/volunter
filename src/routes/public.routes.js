import { Router } from 'express';
import { wrap } from '../utils/helpers.js';
import { getJson, saveJson } from '../blob_db.js';

export const publicRouter = Router();

/** Получить список опубликованных мероприятий */
publicRouter.get(
  '/events',
  wrap(async (req, res) => {
    const events = await getJson('database_events.json', []);
    const active = events.filter(e => e.status === 'published');
    
    // Форматируем под фронт (убираем сложные связи)
    const items = active.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      starts_at: e.starts_at,
      location: e.location,
      banner_url: e.banner_url,
      status: e.status
    }));

    res.json({ items });
  })
);

/** Отправить новую анкету без регистрации */
publicRouter.post(
  '/questionnaires',
  wrap(async (req, res) => {
    const { tg_username, answers } = req.body;
    if (!tg_username) throw new Error('Telegram username обязателен');
    
    const normalizedTg = String(tg_username).replace(/^@/, '').trim();
    const qs = await getJson('database_questionnaires.json', []);
    
    qs.push({
      id: Date.now(),
      tg_username: normalizedTg,
      answers_json: JSON.stringify(answers || {}),
      created_at: new Date().toISOString()
    });
    
    await saveJson('database_questionnaires.json', qs);

    res.json({ ok: true });
  })
);
