import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/helpers.js';
import { put } from '@vercel/blob';
import { getJson, saveJson } from '../blob_db.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin', 'coordinator'));

/** Создать новый анонс */
adminRouter.post(
  '/events',
  wrap(async (req, res) => {
    if (req.user.role !== 'admin') throw new Error('Недостаточно прав');
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
    let items = qs.map(q => {
      let answers = {};
      try { answers = JSON.parse(q.answers_json); } catch(e) {}
      return { ...q, answers };
    });

    // Return all items, we will sort them on the frontend for the "Tinder-like matching"
    res.json({ items });
  })
);

/** Получить список координаторов */
adminRouter.get(
  '/coordinators',
  wrap(async (req, res) => {
    if (req.user.role !== 'admin') throw new Error('Недостаточно прав');
    const coords = await getJson('database_coordinators.json', []);
    
    // We shouldn't send passwords
    const safeCoords = coords.map(c => {
      const { password_hash, ...safe } = c;
      return safe;
    });

    safeCoords.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ items: safeCoords });
  })
);

/** Одобрить координатора */
adminRouter.post(
  '/coordinators/:id/approve',
  wrap(async (req, res) => {
    if (req.user.role !== 'admin') throw new Error('Недостаточно прав');
    const id = parseInt(req.params.id, 10);
    
    const coords = await getJson('database_coordinators.json', []);
    const idx = coords.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Координатор не найден');
    
    coords[idx].is_approved = true;
    await saveJson('database_coordinators.json', coords);
    
    res.json({ ok: true });
  })
);
