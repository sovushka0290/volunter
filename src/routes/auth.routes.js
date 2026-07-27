import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { wrap } from '../utils/helpers.js';
import { getJson, saveJson } from '../blob_db.js';

export const authRouter = Router();

// Registration for coordinators
authRouter.post(
  '/register-coord',
  wrap(async (req, res) => {
    const { contact, password, vector, answers } = req.body;
    if (!contact || !password || !vector) throw new Error('Заполните все обязательные поля');

    const normalizedContact = String(contact).trim();
    const coords = await getJson('database_coordinators.json', []);

    // Check if exists
    if (coords.some(c => c.contact === normalizedContact) || normalizedContact === 'admin') {
      throw new Error('Пользователь с таким логином уже существует');
    }

    const password_hash = await bcrypt.hash(password, 10);
    
    const newCoord = {
      id: Date.now(),
      contact: normalizedContact,
      password_hash,
      vector,
      answers_json: JSON.stringify(answers || {}),
      is_approved: false,
      created_at: new Date().toISOString()
    };

    coords.push(newCoord);
    await saveJson('database_coordinators.json', coords);

    // We do not return a token here, because they must wait for admin approval
    res.json({ 
      ok: true, 
      user: { id: newCoord.id, contact: newCoord.contact, role: 'coordinator', vector: newCoord.vector, is_approved: false } 
    });
  })
);

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const { contact, password } = req.body;
    if (!contact || !password) throw new Error('Заполните все поля');

    const normalizedContact = String(contact).trim();

    // 1. Check Admin
    if (normalizedContact === 'admin' && password === '18273645') {
      const token = jwt.sign({ id: 1, role: 'admin', contact: 'admin' }, config.jwtSecret, { expiresIn: '7d' });
      return res.json({ token, user: { id: 1, contact: 'admin', role: 'admin' } });
    }

    // 2. Check Dynamic Coordinators in Blob DB
    const coords = await getJson('database_coordinators.json', []);
    const coord = coords.find(c => c.contact === normalizedContact);
    
    if (coord) {
      if (coord.is_approved === false) {
        throw new Error('Ваш аккаунт находится на модерации администратором. Ожидайте подтверждения.');
      }
      const isMatch = await bcrypt.compare(password, coord.password_hash);
      if (isMatch) {
        const token = jwt.sign(
          { id: coord.id, role: 'coordinator', contact: coord.contact, vector: coord.vector }, 
          config.jwtSecret, 
          { expiresIn: '7d' }
        );
        return res.json({ 
          token, 
          user: { id: coord.id, contact: coord.contact, role: 'coordinator', vector: coord.vector } 
        });
      }
    }

    // Fallback for legacy hardcoded coordinators (to not break anything temporarily, though not strictly needed anymore)
    const COORDS_LEGACY = {
      'coord_events': { pass: 'events123', vector: 'events' },
      'coord_partners': { pass: 'partners123', vector: 'partners' },
      'coord_media': { pass: 'media123', vector: 'media' },
      'coord_hr': { pass: 'hr123', vector: 'hr' },
      'coord_komek': { pass: 'komek123', vector: 'komek' },
      'coord_it': { pass: 'it123', vector: 'it' },
      'coord_edu': { pass: 'edu123', vector: 'edu' },
      'coord_pr': { pass: 'pr123', vector: 'pr' },
    };
    if (COORDS_LEGACY[normalizedContact] && COORDS_LEGACY[normalizedContact].pass === password) {
      const legacyCoord = COORDS_LEGACY[normalizedContact];
      const token = jwt.sign(
        { id: 2, role: 'coordinator', contact: normalizedContact, vector: legacyCoord.vector }, 
        config.jwtSecret, 
        { expiresIn: '7d' }
      );
      return res.json({ token, user: { id: 2, contact: normalizedContact, role: 'coordinator', vector: legacyCoord.vector } });
    }

    throw new Error('Неверный логин или пароль');
  })
);
