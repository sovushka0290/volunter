import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/helpers.js';
import { put } from '@vercel/blob';
import { getJson, saveJson } from '../blob_db.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

/** Создать новый анонс */
adminRouter.post(
  '/events',
  wrap(async (req, res) => {
    const { title, description, location, starts_at, emoji, theme_id } = req.body;
    if (!title || !starts_at) throw new Error('Название и Дата обязательны');

    const events = await getJson('database_events.json', []);
    events.push({
      id: Date.now(),
      title,
      description: description || null,
      location: location || null,
      starts_at,
      emoji: emoji || '🎉',
      theme_id: theme_id || 0,
      status: 'published',
      created_at: new Date().toISOString()
    });
    await saveJson('database_events.json', events);

    res.json({ ok: true });
  })
);

/** Получить список всех анкет */
adminRouter.get(
  '/questionnaires',
  wrap(async (req, res) => {
    const qs = await getJson('database_questionnaires.json', []);
    qs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Parse answers JSON for the frontend
    const items = qs.map(q => {
      let answers = {};
      try { answers = JSON.parse(q.answers_json); } catch(e) {}
      return { ...q, answers };
    });

    res.json({ items });
  })
);
