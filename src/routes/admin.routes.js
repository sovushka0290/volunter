import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/helpers.js';

import { put } from '@vercel/blob';

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

    await db.prepare(`
      INSERT INTO events (title, description, location, starts_at, banner_url, status)
      VALUES (?, ?, ?, ?, ?, 'published')
    `).run(title, description || null, location || null, starts_at, banner_url);

    res.json({ ok: true, banner_url });
  })
);

/** Получить список всех анкет */
adminRouter.get(

  '/questionnaires',
  wrap(async (req, res) => {
    const rows = await db.prepare(`SELECT * FROM questionnaires ORDER BY created_at DESC`).all();
    res.json({
      items: rows.map(r => ({
        id: r.id,
        tg_username: r.tg_username,
        answers: JSON.parse(r.answers_json),
        created_at: r.created_at
      }))
    });
  })
);
