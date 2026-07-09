export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Local YYYY-MM-DD (avoids UTC off-by-one from toISOString).
export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

// Map a program (week, dayName) to a real calendar date given the start Monday.
export function planDayToISO(programStart, week, dayName) {
  if (!programStart) return null;
  const start = fromISO(programStart);
  const offset = (week - 1) * 7 + DAYS.indexOf(dayName);
  const d = new Date(start);
  d.setDate(start.getDate() + offset);
  return toISO(d);
}

// Which program week does `todayISO` fall in? Returns 1..N or null.
export function currentWeek(programStart, weeks) {
  if (!programStart || !weeks.length) return weeks[0] ?? null;
  const start = fromISO(programStart);
  const today = fromISO(todayISO());
  const diffDays = Math.floor((today - start) / 86400000);
  const wk = Math.floor(diffDays / 7) + 1;
  if (wk < weeks[0]) return weeks[0];
  if (wk > weeks[weeks.length - 1]) return weeks[weeks.length - 1];
  return wk;
}

// Reverse map: a calendar date -> { week, day } within the program (or null).
export function isoToPlanDay(programStart, iso) {
  if (!programStart) return null;
  const diff = Math.floor((fromISO(iso) - fromISO(programStart)) / 86400000);
  if (diff < 0) return null;
  return { week: Math.floor(diff / 7) + 1, day: DAYS[diff % 7] };
}

export function prettyDate(iso) {
  return fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Short date without weekday, e.g. "Jul 6".
export function shortDate(iso) {
  return fromISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function addDaysISO(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

// The Monday (start) of the week containing `iso`.
export function mondayOf(iso) {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dow);
  return toISO(d);
}
