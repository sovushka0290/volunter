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
    const { title, description, location, starts_at, banner_base64 } = req.body;
    if (!title || !starts_at) throw new Error('Название и Дата обязательны');

    let banner_url = null;
    if (banner_base64) {
      const match = banner_base64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!match) throw new Error('Неверный формат изображения');
      
      const buffer = Buffer.from(match[2], 'base64');
      const ext = match[1].split('/')[1] || 'png';
      const filename = `events/banner_${Date.now()}.${ext}`;
      
      const blob = await put(filename, buffer, { access: 'public' });
      banner_url = blob.url;
    }

    const events = await getJson('database_events.json', []);
    events.push({
      id: Date.now(),
      title,
      description: description || null,
      location: location || null,
      starts_at,
      banner_url,
      status: 'published',
      created_at: new Date().toISOString()
    });
    await saveJson('database_events.json', events);

    res.json({ ok: true, banner_url });
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
