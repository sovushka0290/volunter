import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wrap } from '../utils/helpers.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

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
