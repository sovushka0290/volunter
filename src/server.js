import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './config.js';
import { authRouter } from './routes/auth.routes.js';
import { profileRouter } from './routes/profile.routes.js';
import { applicationsRouter } from './routes/applications.routes.js';
import { eventsRouter } from './routes/events.routes.js';
import { coordinatorRouter } from './routes/coordinator.routes.js';
import { volunteersRouter } from './routes/volunteers.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { dictionariesRouter } from './routes/dictionaries.routes.js';

const app = express();
export default app;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(config.publicDir));

import { setupDb } from './setup_db.js';

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.get('/api/env', (_req, res) => res.json({ keys: Object.keys(process.env) }));

app.get('/api/setup', async (_req, res) => {
  try {
    await setupDb();
    res.send('<h1>База данных успешно инициализирована!</h1><p>Теперь вы можете вернуться на сайт и войти.</p><a href="/">На главную</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send(`<h1>Ошибка при создании базы</h1><pre>${err.message}</pre>`);
  }
});

import { publicRouter } from './routes/public.routes.js';
import { adminRouter } from './routes/admin.routes.js';

app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profile', profileRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/coordinator', coordinatorRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/users', usersRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/dictionaries', dictionariesRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Метод не найден' }));

// SPA: любой не-API маршрут отдает индексную страницу.
app.get('*', (_req, res) => res.sendFile(path.join(config.publicDir, 'index.html')));

// Общий обработчик ошибок.
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Внутренняя ошибка', details: err.details });
});

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  app.listen(config.port, () => {
    console.log(`Платформа волонтеров: http://localhost:${config.port}`);
  });
}
