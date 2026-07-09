import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Normalise header keys so "Workout ", "workout" etc. all match.
const norm = (s) => String(s ?? '').trim().toLowerCase();

// Read a numeric value from anywhere in a row (handles "1,696", "1696 kcal", numbers).
function firstNumber(row) {
  for (let i = 1; i < row.length; i++) {
    const raw = row[i];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const s = String(raw ?? '').replace(/[^0-9.\-]/g, '');
    if (s !== '' && Number.isFinite(parseFloat(s))) return parseFloat(s);
  }
  return null;
}

// Scan all sheets for a "Daily Macro Calculator" result block and pull the goals.
function extractMacros(wb) {
  const out = {};
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    for (const row of grid) {
      const label = norm(row[0]);
      if (!label) continue;
      const val = firstNumber(row);
      if (val == null) continue;
      if (label.includes('target calorie')) out.calorie_goal = val;
      else if (label.startsWith('protein')) out.protein_goal = val;
      else if (label.startsWith('carb')) out.carbs_goal = val;
      else if (label.startsWith('fat')) out.fat_goal = val;
    }
  }
  return Object.keys(out).length ? out : null;
}

// Split an "Exercises" cell into structured items.
function parseExercises(cell) {
  return String(cell ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const m = text.match(/^(.*?)(\d+)\s*[xX]\s*(.+)$/);
      if (m && m[1].trim()) {
        return { text, name: m[1].trim(), sets: parseInt(m[2], 10), reps: m[3].trim() };
      }
      return { text, name: text, sets: null, reps: null };
    });
}

// POST /api/plan/import  (multipart form field: "file")
router.post('/import', upload.single('file'), (req, res) => {
  const acct = req.accountId;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  let wb;
  try {
    wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch {
    return res.status(400).json({ error: 'Could not read the Excel file.' });
  }

  // Scan every sheet for a header row containing Week / Day / Workout.
  let cols = null;
  let aoa = null;
  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    for (let i = 0; i < grid.length; i++) {
      const cells = grid[i].map(norm);
      const week = cells.indexOf('week');
      const day = cells.indexOf('day');
      const workout = cells.indexOf('workout');
      if (week > -1 && day > -1 && workout > -1) {
        cols = { week, day, workout, exercises: cells.findIndex((c) => c.startsWith('exercise')), headerRow: i };
        aoa = grid;
        break;
      }
    }
    if (cols) break;
  }

  if (!cols) {
    return res.status(400).json({ error: 'No sheet found with Week, Day and Workout columns.' });
  }

  const cell = (row, idx) => (idx > -1 ? String(row[idx] ?? '').trim() : '');
  const parsed = [];
  for (let r = cols.headerRow + 1; r < aoa.length; r++) {
    const row = aoa[r];
    const week = parseInt(cell(row, cols.week), 10);
    const day = cell(row, cols.day).slice(0, 3);
    const dayCap = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
    if (!Number.isInteger(week) || !DAYS.includes(dayCap)) continue;
    parsed.push({
      week,
      day: dayCap,
      workout: cell(row, cols.workout),
      exercises: parseExercises(cell(row, cols.exercises)),
    });
  }

  if (!parsed.length) {
    return res.status(400).json({ error: 'No valid Week/Day rows found.' });
  }

  // Replace this account's plan atomically.
  const replace = db.transaction((items) => {
    db.prepare('DELETE FROM plan_day WHERE account_id = ?').run(acct);
    const insertDay = db.prepare(
      'INSERT INTO plan_day (account_id, week, day, workout_label) VALUES (?, ?, ?, ?)'
    );
    const insertEx = db.prepare(
      'INSERT INTO exercise (account_id, plan_day_id, position, text, name, sets, reps) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const it of items) {
      const info = insertDay.run(acct, it.week, it.day, it.workout);
      it.exercises.forEach((ex, i) =>
        insertEx.run(acct, info.lastInsertRowid, i, ex.text, ex.name, ex.sets, ex.reps)
      );
    }
  });
  replace(parsed);

  // Anchor the program to the Monday of the current week if not already set.
  const current = db.prepare('SELECT program_start FROM account WHERE id = ?').get(acct);
  if (!current.program_start) {
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    db.prepare('UPDATE account SET program_start = ? WHERE id = ?').run(monday.toISOString().slice(0, 10), acct);
  }

  // Adopt Macro Calculator goals if present.
  const macros = extractMacros(wb);
  if (macros) {
    db.prepare(
      `UPDATE account SET
         calorie_goal = COALESCE(?, calorie_goal),
         protein_goal = COALESCE(?, protein_goal),
         carbs_goal   = COALESCE(?, carbs_goal),
         fat_goal     = COALESCE(?, fat_goal)
       WHERE id = ?`
    ).run(macros.calorie_goal ?? null, macros.protein_goal ?? null, macros.carbs_goal ?? null, macros.fat_goal ?? null, acct);
  }

  const weeks = [...new Set(parsed.map((p) => p.week))].length;
  const exercises = parsed.reduce((t, p) => t + p.exercises.length, 0);
  res.status(201).json({ imported: parsed.length, weeks, exercises, macros: macros ?? null });
});

// GET /api/plan[?week=1] -> this account's days
router.get('/', (req, res) => {
  const { week } = req.query;
  let days;
  if (week != null && week !== '') {
    days = db.prepare('SELECT * FROM plan_day WHERE account_id = ? AND week = ?').all(req.accountId, Number(week));
  } else {
    days = db.prepare('SELECT * FROM plan_day WHERE account_id = ?').all(req.accountId);
  }
  days.sort((a, b) => a.week - b.week || DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
  res.json(days);
});

// GET /api/plan/weeks -> distinct week numbers for this account
router.get('/weeks', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT week FROM plan_day WHERE account_id = ? ORDER BY week').all(req.accountId);
  res.json(rows.map((r) => r.week));
});

export default router;
