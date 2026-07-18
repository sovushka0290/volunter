import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { wrap } from '../utils/helpers.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  wrap(async (req, res) => {
    const { contact, password } = req.body;
    if (!contact || !password) throw new Error('Заполните все поля');

    if (contact === 'admin' && password === '18273645') {
      const token = jwt.sign({ id: 1, role: 'admin' }, config.jwtSecret, { expiresIn: '7d' });
      return res.json({ token, user: { id: 1, contact: 'admin', role: 'admin' } });
    }

    throw new Error('Неверный логин или пароль');
  })
);
