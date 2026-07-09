import { Router } from 'express';
import db from '../db.js';

const router = Router();
const num = (v) => (v === '' || v == null ? null : Number(v));

// GET /api/body -> this account's entries, oldest first (ready for charts)
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM body_entry WHERE account_id = ? ORDER BY date ASC, id ASC')
    .all(req.accountId);
  res.json(rows.map((r) => ({ ...r, measurements: r.measurements ? JSON.parse(r.measurements) : {} })));
});

// POST /api/body -> add an entry
router.post('/', (req, res) => {
  const b = req.body ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? '')) {
    return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
  }
  const info = db
    .prepare(
      `INSERT INTO body_entry (account_id, date, weight, muscle_mass, body_fat_pct, water_pct, measurements)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.accountId,
      b.date,
      num(b.weight),
      num(b.muscle_mass),
      num(b.body_fat_pct),
      num(b.water_pct),
      b.measurements ? JSON.stringify(b.measurements) : null
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

// DELETE /api/body/:id -> only if it belongs to this account
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM body_entry WHERE id = ? AND account_id = ?').run(Number(req.params.id), req.accountId);
  res.json({ ok: true });
});

export default router;
