import { Router } from 'express';
import db from '../db.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (v === '' || v == null ? null : Number(v));

const sum = (rows, key) => rows.reduce((t, r) => t + (r[key] ?? 0), 0);

// GET /api/meals/:date -> this account's meals for a day + totals
router.get('/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  const meals = db
    .prepare('SELECT * FROM meal WHERE account_id = ? AND date = ? ORDER BY id ASC')
    .all(req.accountId, date);
  res.json({
    meals,
    totals: {
      calories: sum(meals, 'calories'),
      protein_g: sum(meals, 'protein_g'),
      carbs_g: sum(meals, 'carbs_g'),
      fat_g: sum(meals, 'fat_g'),
    },
  });
});

// POST /api/meals -> add a meal
router.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!DATE_RE.test(b.date ?? '')) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  if (!String(b.name ?? '').trim()) return res.status(400).json({ error: 'Meal name is required.' });
  const info = db
    .prepare(
      `INSERT INTO meal (account_id, date, name, meal_type, calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.accountId,
      b.date,
      String(b.name).trim(),
      b.meal_type ?? null,
      num(b.calories),
      num(b.protein_g),
      num(b.carbs_g),
      num(b.fat_g)
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

// DELETE /api/meals/:id -> only if it belongs to this account
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM meal WHERE id = ? AND account_id = ?').run(Number(req.params.id), req.accountId);
  res.json({ ok: true });
});

export default router;
