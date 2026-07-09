// On-device API. Formerly a fetch wrapper around a REST server; now every
// method reads/writes the phone's own IndexedDB (see localdb.js), so the app
// is fully standalone — no server, no network, no PC. Method names and return
// shapes are unchanged, so the pages/components need no edits.

import * as XLSX from 'xlsx';
import { get, getAll, getAllByIndex, put, add, del, clear } from './localdb.js';

// ---- session (local "login" that doubles as a privacy lock) ----------------
let token = localStorage.getItem('ft_token') || null;

export function setToken(t) {
  token = t || null;
  if (t) localStorage.setItem('ft_token', t);
  else localStorage.removeItem('ft_token');
}
export const getToken = () => token;

// ---- small helpers ---------------------------------------------------------
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const num = (v) => (v === '' || v == null ? null : Number(v));
const normEmail = (e) => String(e ?? '').trim().toLowerCase();

const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const round = (n, p = 0) => (n == null ? null : Number(n.toFixed(p)));
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const randHex = (n = 16) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The single local account record (id = 1), or null before signup.
const getAccount = () => get('account', 1);

async function requireAccount() {
  const acct = await getAccount();
  if (!token || !acct) throw new Error('Not signed in.');
  return acct;
}

// ---- Excel import helpers (ported from the old server plan.js) -------------
const norm = (s) => String(s ?? '').trim().toLowerCase();

function firstNumber(row) {
  for (let i = 1; i < row.length; i++) {
    const raw = row[i];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const s = String(raw ?? '').replace(/[^0-9.\-]/g, '');
    if (s !== '' && Number.isFinite(parseFloat(s))) return parseFloat(s);
  }
  return null;
}

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

// Map a date to the program's (week, day) via the account's start Monday.
function planKeyForDate(programStart, iso) {
  if (!programStart) return null;
  const diff = Math.floor((fromISO(iso) - fromISO(programStart)) / 86400000);
  if (diff < 0) return null;
  return { week: Math.floor(diff / 7) + 1, day: DAYS[diff % 7] };
}

// ===========================================================================
export const api = {
  // ---- auth (fully local) --------------------------------------------------
  async signup(email, password) {
    email = normEmail(email);
    password = String(password ?? '');
    if (!EMAIL_RE.test(email)) throw new Error('Enter a valid email address.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters.');
    if (await getAccount()) throw new Error('An account already exists on this device.');

    const salt = randHex(8);
    const password_hash = await hashPassword(password, salt);
    await put('account', {
      id: 1, email, salt, password_hash,
      units_weight: 'kg', units_length: 'cm',
      program_start: null, calorie_goal: null, protein_goal: null, carbs_goal: null, fat_goal: null,
      created_at: new Date().toISOString(),
    });
    const t = randHex();
    setToken(t);
    return { token: t, email };
  },

  async login(email, password) {
    email = normEmail(email);
    password = String(password ?? '');
    const acct = await getAccount();
    if (!acct || acct.email !== email || (await hashPassword(password, acct.salt)) !== acct.password_hash) {
      throw new Error('Incorrect email or password.');
    }
    const t = randHex();
    setToken(t);
    return { token: t, email: acct.email };
  },

  async me() {
    const acct = await requireAccount();
    return { id: acct.id, email: acct.email };
  },

  async changePassword(currentPassword, newPassword) {
    const acct = await requireAccount();
    if ((await hashPassword(String(currentPassword ?? ''), acct.salt)) !== acct.password_hash) {
      throw new Error('Current password is incorrect.');
    }
    if (String(newPassword ?? '').length < 6) throw new Error('New password must be at least 6 characters.');
    const salt = randHex(8);
    await put('account', { ...acct, salt, password_hash: await hashPassword(newPassword, salt) });
    return { ok: true };
  },

  // ---- settings ------------------------------------------------------------
  async getSettings() {
    const a = await requireAccount();
    const { units_weight, units_length, program_start, calorie_goal, protein_goal, carbs_goal, fat_goal } = a;
    return { units_weight, units_length, program_start, calorie_goal, protein_goal, carbs_goal, fat_goal };
  },

  async saveSettings(s) {
    const a = await requireAccount();
    const b = s ?? {};
    const start = DATE_RE.test(b.program_start ?? '') ? b.program_start : a.program_start;
    const goal = (key) => {
      const v = b[key];
      if (v === undefined) return a[key];
      if (v === '' || v === null) return null;
      return Number.isFinite(Number(v)) ? Number(v) : a[key];
    };
    await put('account', {
      ...a,
      units_weight: b.units_weight === 'lb' ? 'lb' : 'kg',
      units_length: b.units_length === 'in' ? 'in' : 'cm',
      program_start: start,
      calorie_goal: goal('calorie_goal'),
      protein_goal: goal('protein_goal'),
      carbs_goal: goal('carbs_goal'),
      fat_goal: goal('fat_goal'),
    });
    return { ok: true };
  },

  // ---- plan / Excel import -------------------------------------------------
  async importPlan(file) {
    const acct = await requireAccount();
    let wb;
    try {
      wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    } catch {
      throw new Error('Could not read the Excel file.');
    }

    // Find a sheet with a header row containing Week / Day / Workout.
    let cols = null, aoa = null;
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
    if (!cols) throw new Error('No sheet found with Week, Day and Workout columns.');

    const cell = (row, idx) => (idx > -1 ? String(row[idx] ?? '').trim() : '');
    const parsed = [];
    for (let r = cols.headerRow + 1; r < aoa.length; r++) {
      const row = aoa[r];
      const week = parseInt(cell(row, cols.week), 10);
      const day = cell(row, cols.day).slice(0, 3);
      const dayCap = day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
      if (!Number.isInteger(week) || !DAYS.includes(dayCap)) continue;
      parsed.push({ week, day: dayCap, workout: cell(row, cols.workout), exercises: parseExercises(cell(row, cols.exercises)) });
    }
    if (!parsed.length) throw new Error('No valid Week/Day rows found.');

    // Replace this device's plan (exercise_log rows key off exercise ids, so reset them too).
    await clear('plan_day');
    await clear('exercise');
    await clear('exercise_log');
    for (const it of parsed) {
      const planDayId = await add('plan_day', { week: it.week, day: it.day, workout_label: it.workout });
      for (let i = 0; i < it.exercises.length; i++) {
        const ex = it.exercises[i];
        await add('exercise', { plan_day_id: planDayId, position: i, text: ex.text, name: ex.name, sets: ex.sets, reps: ex.reps });
      }
    }

    // Anchor the program to the Monday of the current week if not set.
    const patch = { ...(await getAccount()) };
    if (!patch.program_start) {
      const now = new Date();
      const dow = (now.getDay() + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - dow);
      patch.program_start = monday.toISOString().slice(0, 10);
    }
    // Adopt Macro Calculator goals if present (only fill blanks).
    const macros = extractMacros(wb);
    if (macros) {
      for (const k of ['calorie_goal', 'protein_goal', 'carbs_goal', 'fat_goal']) {
        if (macros[k] != null) patch[k] = macros[k];
      }
    }
    await put('account', patch);

    const weeks = new Set(parsed.map((p) => p.week)).size;
    const exercises = parsed.reduce((t, p) => t + p.exercises.length, 0);
    return { imported: parsed.length, weeks, exercises, macros: macros ?? null };
  },

  async getWeeks() {
    await requireAccount();
    const days = await getAll('plan_day');
    return [...new Set(days.map((d) => d.week))].sort((a, b) => a - b);
  },

  async getWeek(week) {
    await requireAccount();
    let days = await getAll('plan_day');
    if (week != null && week !== '') days = days.filter((d) => d.week === Number(week));
    days.sort((a, b) => a.week - b.week || DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    return days;
  },

  // ---- daily log -----------------------------------------------------------
  async getLog(date) {
    await requireAccount();
    if (!DATE_RE.test(date)) throw new Error('Date must be YYYY-MM-DD.');
    const log = await get('daily_log', date);
    if (log) return { ...log, workout_done: Boolean(log.workout_done), core_done: Boolean(log.core_done) };
    return { date, workout_done: false, core_done: false, steps: null, water_l: null, protein_g: null, sleep_hrs: null, notes: '' };
  },

  async saveLog(date, log) {
    await requireAccount();
    if (!DATE_RE.test(date)) throw new Error('Date must be YYYY-MM-DD.');
    const b = log ?? {};
    const row = {
      date,
      plan_day_id: b.plan_day_id ?? null,
      workout_done: b.workout_done ? 1 : 0,
      core_done: b.core_done ? 1 : 0,
      steps: num(b.steps),
      water_l: num(b.water_l),
      protein_g: num(b.protein_g),
      sleep_hrs: num(b.sleep_hrs),
      notes: b.notes ?? '',
    };
    await put('daily_log', row);
    return { ...row, workout_done: Boolean(row.workout_done), core_done: Boolean(row.core_done) };
  },

  // ---- exercises (per-day checklist with weights) --------------------------
  async getExercises(date) {
    const acct = await requireAccount();
    if (!DATE_RE.test(date)) throw new Error('Date must be YYYY-MM-DD.');
    const key = planKeyForDate(acct.program_start, date);
    if (!key) return { workout_label: null, exercises: [] };

    const days = await getAll('plan_day');
    const planDay = days.find((d) => d.week === key.week && d.day === key.day);
    if (!planDay) return { workout_label: null, exercises: [] };

    const rows = (await getAllByIndex('exercise', 'plan_day_id', planDay.id)).sort((a, b) => a.position - b.position);
    const exercises = [];
    for (const e of rows) {
      const log = await get('exercise_log', `${date}|${e.id}`);
      exercises.push({
        id: e.id, name: e.name, text: e.text, sets: e.sets, reps: e.reps,
        done: Boolean(log?.done),
        weight: log?.weight ?? '',
        reps_done: log?.reps_done ?? '',
        notes: log?.notes ?? '',
      });
    }
    return { workout_label: planDay.workout_label, exercises };
  },

  async saveExercises(date, items) {
    await requireAccount();
    if (!DATE_RE.test(date)) throw new Error('Date must be YYYY-MM-DD.');
    const list = Array.isArray(items) ? items : [];
    // Only log against exercises that exist on this device.
    const owned = new Set((await getAll('exercise')).map((e) => e.id));
    for (const it of list) {
      const exId = Number(it.exercise_id);
      if (!owned.has(exId)) continue;
      await put('exercise_log', {
        key: `${date}|${exId}`,
        date,
        exercise_id: exId,
        done: it.done ? 1 : 0,
        weight: num(it.weight),
        reps_done: it.reps_done ?? null,
        notes: it.notes ?? null,
      });
    }
    return { ok: true, saved: list.length };
  },

  // ---- body ----------------------------------------------------------------
  async getBody() {
    await requireAccount();
    const rows = await getAll('body_entry');
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    return rows.map((r) => ({ ...r, measurements: r.measurements || {} }));
  },

  async addBody(entry) {
    await requireAccount();
    const b = entry ?? {};
    if (!DATE_RE.test(b.date ?? '')) throw new Error('Date must be YYYY-MM-DD.');
    const id = await add('body_entry', {
      date: b.date,
      weight: num(b.weight),
      muscle_mass: num(b.muscle_mass),
      body_fat_pct: num(b.body_fat_pct),
      water_pct: num(b.water_pct),
      measurements: b.measurements && Object.keys(b.measurements).length ? b.measurements : null,
    });
    return { id };
  },

  async deleteBody(id) {
    await requireAccount();
    await del('body_entry', Number(id));
    return { ok: true };
  },

  // ---- meals ---------------------------------------------------------------
  async getMeals(date) {
    await requireAccount();
    if (!DATE_RE.test(date)) throw new Error('Date must be YYYY-MM-DD.');
    const meals = (await getAllByIndex('meal', 'date', date)).sort((a, b) => a.id - b.id);
    const sum = (key) => meals.reduce((t, r) => t + (r[key] ?? 0), 0);
    return {
      meals,
      totals: { calories: sum('calories'), protein_g: sum('protein_g'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g') },
    };
  },

  async addMeal(meal) {
    await requireAccount();
    const b = meal ?? {};
    if (!DATE_RE.test(b.date ?? '')) throw new Error('Date must be YYYY-MM-DD.');
    if (!String(b.name ?? '').trim()) throw new Error('Meal name is required.');
    const id = await add('meal', {
      date: b.date,
      name: String(b.name).trim(),
      meal_type: b.meal_type ?? null,
      calories: num(b.calories),
      protein_g: num(b.protein_g),
      carbs_g: num(b.carbs_g),
      fat_g: num(b.fat_g),
    });
    return { id };
  },

  async deleteMeal(id) {
    await requireAccount();
    await del('meal', Number(id));
    return { ok: true };
  },

  // ---- photos (stored as blobs on the device) ------------------------------
  async getPhotos() {
    await requireAccount();
    const rows = await getAll('photo');
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    return rows.map((r) => ({
      id: r.id, date: r.date, pose: r.pose, note: r.note,
      url: URL.createObjectURL(r.blob),
    }));
  },

  async addPhoto({ file, date, pose, note }) {
    await requireAccount();
    if (!file) throw new Error('An image file is required.');
    const POSES = ['front', 'side', 'back', 'other'];
    const safeDate = DATE_RE.test(date ?? '') ? date : new Date().toISOString().slice(0, 10);
    const safePose = POSES.includes(pose) ? pose : 'other';
    const id = await add('photo', { date: safeDate, pose: safePose, note: note ?? '', blob: file });
    return { id, url: URL.createObjectURL(file) };
  },

  async deletePhoto(id) {
    await requireAccount();
    await del('photo', Number(id));
    return { ok: true };
  },

  // Photos are already local object URLs — nothing to append.
  photoSrc: (url) => url,

  // ---- insights (aggregation ported from server insights.js) ---------------
  async getInsights(from, to) {
    const account = await requireAccount();
    if (!DATE_RE.test(to ?? '')) to = toISO(new Date());
    if (!DATE_RE.test(from ?? '')) from = addDays(to, -6);
    if (fromISO(from) > fromISO(to)) [from, to] = [to, from];

    const inRange = (d) => d >= from && d <= to;
    const dates = [];
    for (let d = from; fromISO(d) <= fromISO(to); d = addDays(d, 1)) dates.push(d);

    const planRows = await getAll('plan_day');
    const planByKey = new Map(planRows.map((p) => [`${p.week}|${p.day}`, p.workout_label]));

    const logs = (await getAll('daily_log')).filter((l) => inRange(l.date));
    const logByDate = new Map(logs.map((l) => [l.date, l]));

    let planned = 0, done = 0;
    for (const date of dates) {
      const key = planKeyForDate(account.program_start, date);
      const label = key ? planByKey.get(`${key.week}|${key.day}`) : null;
      if (label && !/rest/i.test(label)) planned += 1;
      if (logByDate.get(date)?.workout_done) done += 1;
    }

    const steps = logs.map((l) => l.steps).filter((v) => v != null);
    const sleep = logs.map((l) => l.sleep_hrs).filter((v) => v != null);
    const water = logs.map((l) => l.water_l).filter((v) => v != null);
    const protein = logs.map((l) => l.protein_g).filter((v) => v != null);

    const meals = (await getAll('meal')).filter((m) => inRange(m.date));
    const calByDate = {};
    for (const m of meals) calByDate[m.date] = (calByDate[m.date] ?? 0) + (m.calories ?? 0);
    const calDays = Object.values(calByDate);

    const bodyRows = (await getAll('body_entry')).filter((b) => inRange(b.date))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
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
      highlights.push(sleepAvg >= 7 ? `Averaging ${sleepAvg}h sleep — nicely rested. 😴` : `Averaging ${sleepAvg}h sleep — aim for 7h+.`);
    }
    if (stepsAvg != null) highlights.push(`Averaging ${stepsAvg.toLocaleString()} steps/day. 👟`);
    if (calAvg != null && account.calorie_goal) {
      highlights.push(calAvg <= account.calorie_goal
        ? `Avg ${calAvg} kcal/day — within your ${account.calorie_goal} goal. ✅`
        : `Avg ${calAvg} kcal/day — over your ${account.calorie_goal} goal.`);
    }
    if (!logs.length && !meals.length && !bodyRows.length) {
      highlights.push('No data logged this week yet — start logging to see insights.');
    }

    return {
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
    };
  },
};
