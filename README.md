# Fitness Tracker

A single-user, PIN-protected fitness tracker PWA. Import your Excel workout plan,
tick off **each exercise (with sets×reps) and log the weight used**, track daily
habits (steps, water, protein, sleep, notes), body progress (weight, composition,
measurements) with charts, log meals & calories, keep progress photos with
before/after compare, and get an automatic **weekly insights** report.

The Excel importer is tolerant: it scans **every sheet** in the workbook and finds
the table with `Week / Day / Workout` columns even if there are title/preamble rows
above it or extra columns beside it. If a `Exercises (Sets x Reps)` column is
present (e.g. `Hip thrust 4x10; Romanian deadlift 3x10`), each exercise is parsed
into the per-day checklist. If the workbook has a **Daily Macro Calculator** sheet,
its Target calories + Protein/Carbs/Fat results are read into your **nutrition goals**
automatically (one upload sets everything).

Runs in any browser on phone and PC, and installs to your Android home screen.

Tabs: **Schedule · Nutrition · Body · Photos · Settings** (Weekly Insights is
reached via the 📊 icon on the Schedule header).

## Stack
- **client/** — React + Vite + Material UI + Recharts (installable PWA)
- **server/** — Node + Express REST API + SQLite

## Running it (use on your phone at home)

The server serves both the app and the API on **one port (4000)**.

**Easiest:** double-click **`start-app.bat`** (builds the app the first time, then starts it).

**Or from a terminal:**
```bash
cd client && npm install && npm run build   # first time / after client changes
cd ../server && npm install && npm start
```

On startup it prints your addresses, e.g.:
```
  On this PC:    http://localhost:4000
  On your phone: http://192.168.50.195:4000   (same Wi-Fi)
```

### Put it on your phone
1. Keep this PC running and on the **same Wi-Fi** as your phone.
2. One-time: allow the port through Windows Firewall — in an **Administrator**
   PowerShell run:
   ```powershell
   New-NetFirewallRule -DisplayName "Fitness Tracker" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow -Profile Private
   ```
3. On your phone's browser, open the `http://<your-ip>:4000` address shown at startup.
4. Chrome menu (⋮) → **Add to Home screen** → it opens full-screen like an app.

Notes: your data (SQLite DB + photos) stays on this PC under `server/data/`. The
app is only reachable while the PC is running. Dev mode with hot-reload is still
available via `cd client && npm run dev` (port 5173) if you're editing the UI.

## First run
1. Create a PIN (4–8 digits).
2. Go to **Settings → Upload Excel** and pick your routine
   (columns: `Week`, `Day`, `Workout`; a `sample-plan.xlsx` is in `server/`).
3. The program anchors to the Monday of the current week — adjust under
   **Settings → Program start** if needed.
4. Tap any day on the **Schedule** to log it. Use the **Body** tab for weight/composition.

## REST API (for Playwright API tests later)
| Method | Endpoint | Purpose |
|---|---|---|
| GET  | `/api/auth/status` | is a PIN set? |
| POST | `/api/auth/setup` | create PIN |
| POST | `/api/auth/login` | verify PIN |
| POST | `/api/auth/change-pin` | change PIN |
| POST | `/api/plan/import` | upload Excel (multipart `file`) |
| GET  | `/api/plan?week=1` | days for a week |
| GET  | `/api/plan/weeks` | list of week numbers |
| GET/PUT | `/api/logs/:date` | get/save a day's log |
| GET/PUT | `/api/exercises/:date` | day's exercises + per-exercise done/weight |
| GET/POST/DELETE | `/api/body` | body entries |
| GET `/api/meals/:date`, POST/DELETE `/api/meals` | meals + daily totals |
| GET/POST/DELETE | `/api/photos` | progress photos (multipart upload) |
| GET | `/uploads/:filename` | serves an uploaded photo |
| GET | `/api/insights?from=&to=` | weekly aggregates + highlights |
| GET/PUT | `/api/settings` | units + program start + calorie goal |

## Planned
- **Garmin CSV import** — export data from Garmin Connect and import to auto-fill
  steps/sleep (chosen over the official API to avoid partner approval, and over
  unofficial login libraries to avoid sharing Garmin credentials).
- Possible later: import the workbook's remaining sheets (Measurements → body
  entries, Progressive Overload → target weights), and the official Garmin Health
  API if automatic sync becomes worth the approval.

## Data & storage notes
- SQLite db at `server/data/fitness.db`; uploaded photos at `server/data/photos/`
  (both are local and private — nothing leaves your machine).
