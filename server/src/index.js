import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import os from 'os';
import db from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import planRoutes from './routes/plan.js';
import logRoutes from './routes/logs.js';
import bodyRoutes from './routes/body.js';
import mealRoutes from './routes/meals.js';
import photoRoutes from './routes/photos.js';
import insightsRoutes from './routes/insights.js';
import exerciseRoutes from './routes/exercises.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public auth endpoints (signup/login); /me and /change-password self-protect.
app.use('/api/auth', authRoutes);

// Settings scoped to the signed-in account.
const GOAL_FIELDS = ['calorie_goal', 'protein_goal', 'carbs_goal', 'fat_goal'];
app.get('/api/settings', requireAuth, (req, res) => {
  const u = db
    .prepare(
      'SELECT units_weight, units_length, program_start, calorie_goal, protein_goal, carbs_goal, fat_goal FROM account WHERE id = ?'
    )
    .get(req.accountId);
  res.json(u);
});
app.put('/api/settings', requireAuth, (req, res) => {
  const b = req.body ?? {};
  const current = db
    .prepare('SELECT program_start, calorie_goal, protein_goal, carbs_goal, fat_goal FROM account WHERE id = ?')
    .get(req.accountId);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(b.program_start ?? '') ? b.program_start : current.program_start;
  const goal = (key) => {
    const v = b[key];
    if (v === undefined) return current[key];
    if (v === '' || v === null) return null;
    return Number.isFinite(Number(v)) ? Number(v) : current[key];
  };
  db.prepare(
    `UPDATE account SET units_weight = ?, units_length = ?, program_start = ?,
       calorie_goal = ?, protein_goal = ?, carbs_goal = ?, fat_goal = ? WHERE id = ?`
  ).run(
    b.units_weight === 'lb' ? 'lb' : 'kg',
    b.units_length === 'in' ? 'in' : 'cm',
    start,
    ...GOAL_FIELDS.map(goal),
    req.accountId
  );
  res.json({ ok: true });
});

// All data routes require a valid token and are scoped to that account.
app.use('/api/plan', requireAuth, planRoutes);
app.use('/api/logs', requireAuth, logRoutes);
app.use('/api/body', requireAuth, bodyRoutes);
app.use('/api/meals', requireAuth, mealRoutes);
app.use('/api/photos', requireAuth, photoRoutes);
app.use('/api/insights', requireAuth, insightsRoutes);
app.use('/api/exercises', requireAuth, exerciseRoutes);

// --- Serve the built client (production) so app + API share one origin/port ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  console.log('\n  Fitness Tracker is running!\n');
  console.log(`  On this PC:    http://localhost:${PORT}`);
  for (const ip of lan) console.log(`  On your phone: http://${ip}:${PORT}   (same Wi-Fi)`);
  console.log('\n  Press Ctrl+C to stop.\n');
});
