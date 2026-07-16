import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { wrap } from '../utils/helpers.js';
import { DIRECTIONS, FREE_TIME, LANGUAGES, QUALITIES } from '../utils/dictionaries.js';

export const dictionariesRouter = Router();

/** Справочники для форм: направления, навыки, качества, языки, занятость. */
dictionariesRouter.get(
  '/',
  wrap(async (_req, res) => {
    res.json({
      directions: DIRECTIONS,
      qualities: QUALITIES,
      languages: LANGUAGES,
      free_time: FREE_TIME,
      volunteer_types: [
        { key: 'organization', title: 'Волонтер организации', min_age: config.minAge.organization },
        { key: 'party', title: 'Партийное крыло', min_age: config.minAge.party },
      ],
      cancel_deadline_hours: config.cancelDeadlineHours,
    });
  })
);

/** Список координаторов — для назначения на мероприятия и закрепления за волонтерами. */
dictionariesRouter.get(
  '/coordinators',
  requireAuth,
  wrap(async (_req, res) => {
    const items = db
      .prepare(`SELECT id, full_name, phone, city FROM users WHERE role = 'coordinator' AND is_blocked = 0 ORDER BY full_name`)
      .all();
    res.json({ items });
  })
);
