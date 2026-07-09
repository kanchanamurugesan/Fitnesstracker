import { Router } from 'express';
import db from '../db.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };

// Map a date to this account's program (week, day) via its program start Monday.
function planDayForDate(accountId, iso) {
  const acct = db.prepare('SELECT program_start FROM account WHERE id = ?').get(accountId);
  if (!acct?.program_start) return null;
  const diff = Math.floor((fromISO(iso) - fromISO(acct.program_start)) / 86400000);
  if (diff < 0) return null;
  const week = Math.floor(diff / 7) + 1;
  const day = DAYS[diff % 7];
  return db.prepare('SELECT * FROM plan_day WHERE account_id = ? AND week = ? AND day = ?').get(accountId, week, day) ?? null;
}

// GET /api/exercises/:date -> the day's exercises merged with any logged progress
router.get('/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });

  const planDay = planDayForDate(req.accountId, date);
  if (!planDay) return res.json({ workout_label: null, exercises: [] });

  const rows = db.prepare(
    `SELECT e.id, e.position, e.text, e.name, e.sets, e.reps,
            l.done, l.weight, l.reps_done, l.notes
       FROM exercise e
       LEFT JOIN exercise_log l ON l.exercise_id = e.id AND l.date = ?
      WHERE e.plan_day_id = ? AND e.account_id = ?
      ORDER BY e.position ASC`
  ).all(date, planDay.id, req.accountId);

  res.json({
    workout_label: planDay.workout_label,
    exercises: rows.map((r) => ({
      id: r.id,
      name: r.name,
      text: r.text,
      sets: r.sets,
      reps: r.reps,
      done: Boolean(r.done),
      weight: r.weight ?? '',
      reps_done: r.reps_done ?? '',
      notes: r.notes ?? '',
    })),
  });
});

// PUT /api/exercises/:date  body: { items: [{ exercise_id, done, weight, reps_done, notes }] }
router.put('/:date', (req, res) => {
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const num = (v) => (v === '' || v == null ? null : Number(v));

  // Only allow logging against exercises this account owns.
  const owns = db.prepare('SELECT 1 FROM exercise WHERE id = ? AND account_id = ?');
  const upsert = db.prepare(
    `INSERT INTO exercise_log (account_id, date, exercise_id, done, weight, reps_done, notes)
     VALUES (@account_id, @date, @exercise_id, @done, @weight, @reps_done, @notes)
     ON CONFLICT(date, exercise_id) DO UPDATE SET
       done = excluded.done, weight = excluded.weight,
       reps_done = excluded.reps_done, notes = excluded.notes`
  );
  const tx = db.transaction((list) => {
    for (const it of list) {
      if (!owns.get(Number(it.exercise_id), req.accountId)) continue;
      upsert.run({
        account_id: req.accountId,
        date,
        exercise_id: Number(it.exercise_id),
        done: it.done ? 1 : 0,
        weight: num(it.weight),
        reps_done: it.reps_done ?? null,
        notes: it.notes ?? null,
      });
    }
  });
  tx(items);
  res.json({ ok: true, saved: items.length });
});

export default router;
