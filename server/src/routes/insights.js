import { Router } from 'express';
import db from '../db.js';

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };

const round = (n, p = 0) => (n == null ? null : Number(n.toFixed(p)));
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

function planLabelForDate(programStart, iso, planByKey) {
  if (!programStart) return null;
  const diff = Math.floor((fromISO(iso) - fromISO(programStart)) / 86400000);
  if (diff < 0) return null;
  const week = Math.floor(diff / 7) + 1;
  const day = DAYS[diff % 7];
  return planByKey.get(`${week}|${day}`) ?? null;
}

// GET /api/insights?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults to the last 7 days)
router.get('/', (req, res) => {
  const acct = req.accountId;
  let { from, to } = req.query;
  if (!DATE_RE.test(to ?? '')) to = toISO(new Date());
  if (!DATE_RE.test(from ?? '')) from = addDays(to, -6);
  if (fromISO(from) > fromISO(to)) [from, to] = [to, from];

  const account = db.prepare('SELECT program_start, calorie_goal FROM account WHERE id = ?').get(acct);

  const dates = [];
  for (let d = from; fromISO(d) <= fromISO(to); d = addDays(d, 1)) dates.push(d);

  const planRows = db.prepare('SELECT week, day, workout_label FROM plan_day WHERE account_id = ?').all(acct);
  const planByKey = new Map(planRows.map((p) => [`${p.week}|${p.day}`, p.workout_label]));

  const logs = db.prepare('SELECT * FROM daily_log WHERE account_id = ? AND date BETWEEN ? AND ?').all(acct, from, to);
  const logByDate = new Map(logs.map((l) => [l.date, l]));

  let planned = 0;
  let done = 0;
  for (const date of dates) {
    const label = planLabelForDate(account.program_start, date, planByKey);
    if (label && !/rest/i.test(label)) planned += 1;
    if (logByDate.get(date)?.workout_done) done += 1;
  }

  const steps = logs.map((l) => l.steps).filter((v) => v != null);
  const sleep = logs.map((l) => l.sleep_hrs).filter((v) => v != null);
  const water = logs.map((l) => l.water_l).filter((v) => v != null);
  const protein = logs.map((l) => l.protein_g).filter((v) => v != null);

  const mealRows = db.prepare('SELECT date, calories FROM meal WHERE account_id = ? AND date BETWEEN ? AND ?').all(acct, from, to);
  const calByDate = {};
  for (const m of mealRows) calByDate[m.date] = (calByDate[m.date] ?? 0) + (m.calories ?? 0);
  const calDays = Object.values(calByDate);

  const bodyRows = db
    .prepare('SELECT * FROM body_entry WHERE account_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC, id ASC')
    .all(acct, from, to);
  const change = (key) => {
    const vals = bodyRows.filter((b) => b[key] != null);
    if (vals.length < 1) return { start: null, end: null, change: null };
    const start = vals[0][key];
    const end = vals[vals.length - 1][key];
    return { start, end, change: vals.length >= 2 ? round(end - start, 1) : null };
  };
  const weight = change('weight');
  const bodyFat = change('body_fat_pct');

  const stepsAvg = round(avg(steps));
  const sleepAvg = round(avg(sleep), 1);
  const calAvg = round(avg(calDays));

  const highlights = [];
  if (planned > 0) {
    const pct = done / planned;
    highlights.push(
      pct >= 1 ? `Perfect week — all ${planned} planned workouts done! 🔥`
      : pct >= 0.5 ? `You completed ${done} of ${planned} planned workouts. 💪`
      : `Only ${done} of ${planned} workouts done — next week's a fresh start.`
    );
  }
  if (weight.change != null) {
    highlights.push(
      weight.change < 0 ? `Weight down ${Math.abs(weight.change)} kg this week. 📉`
      : weight.change > 0 ? `Weight up ${weight.change} kg this week.`
      : `Weight held steady this week.`
    );
  }
  if (sleepAvg != null) {
    highlights.push(sleepAvg >= 7 ? `Averaging ${sleepAvg}h sleep — nicely rested. 😴`
      : `Averaging ${sleepAvg}h sleep — aim for 7h+.`);
  }
  if (stepsAvg != null) highlights.push(`Averaging ${stepsAvg.toLocaleString()} steps/day. 👟`);
  if (calAvg != null && account.calorie_goal) {
    highlights.push(calAvg <= account.calorie_goal
      ? `Avg ${calAvg} kcal/day — within your ${account.calorie_goal} goal. ✅`
      : `Avg ${calAvg} kcal/day — over your ${account.calorie_goal} goal.`);
  }
  if (!logs.length && !mealRows.length && !bodyRows.length) {
    highlights.push('No data logged this week yet — start logging to see insights.');
  }

  res.json({
    range: { from, to, days: dates.length },
    workouts: { done, planned },
    steps: { avg: stepsAvg, total: steps.reduce((a, b) => a + b, 0), daysLogged: steps.length },
    sleep: { avg: sleepAvg, daysLogged: sleep.length },
    water: { avg: round(avg(water), 1), daysLogged: water.length },
    protein: { avg: round(avg(protein)), daysLogged: protein.length },
    calories: { avg: calAvg, goal: account.calorie_goal, daysLogged: calDays.length },
    weight,
    bodyFat,
    highlights,
  });
});

export default router;
