import { Router } from 'express';
import db from '../db.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/logs/:date -> the day's log (empty defaults if none saved yet)
router.get('/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  const log = db.prepare('SELECT * FROM daily_log WHERE account_id = ? AND date = ?').get(req.accountId, date);
  if (log) {
    log.workout_done = Boolean(log.workout_done);
    log.core_done = Boolean(log.core_done);
    return res.json(log);
  }
  res.json({
    date,
    workout_done: false,
    core_done: false,
    steps: null,
    water_l: null,
    protein_g: null,
    sleep_hrs: null,
    notes: '',
  });
});

// PUT /api/logs/:date -> upsert the day's log
router.put('/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });

  const b = req.body ?? {};
  const row = {
    account_id: req.accountId,
    date,
    plan_day_id: b.plan_day_id ?? null,
    workout_done: b.workout_done ? 1 : 0,
    core_done: b.core_done ? 1 : 0,
    steps: b.steps === '' || b.steps == null ? null : Number(b.steps),
    water_l: b.water_l === '' || b.water_l == null ? null : Number(b.water_l),
    protein_g: b.protein_g === '' || b.protein_g == null ? null : Number(b.protein_g),
    sleep_hrs: b.sleep_hrs === '' || b.sleep_hrs == null ? null : Number(b.sleep_hrs),
    notes: b.notes ?? '',
  };

  db.prepare(
    `INSERT INTO daily_log
       (account_id, date, plan_day_id, workout_done, core_done, steps, water_l, protein_g, sleep_hrs, notes)
     VALUES
       (@account_id, @date, @plan_day_id, @workout_done, @core_done, @steps, @water_l, @protein_g, @sleep_hrs, @notes)
     ON CONFLICT(account_id, date) DO UPDATE SET
       plan_day_id = excluded.plan_day_id,
       workout_done = excluded.workout_done,
       core_done = excluded.core_done,
       steps = excluded.steps,
       water_l = excluded.water_l,
       protein_g = excluded.protein_g,
       sleep_hrs = excluded.sleep_hrs,
       notes = excluded.notes`
  ).run(row);

  res.json({ ...row, workout_done: Boolean(row.workout_done), core_done: Boolean(row.core_done) });
});

export default router;
