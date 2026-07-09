import { Router } from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import db from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PHOTO_DIR = process.env.PHOTO_DIR || join(__dirname, '..', 'data', 'photos');
if (!existsSync(PHOTO_DIR)) mkdirSync(PHOTO_DIR, { recursive: true });

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const POSES = ['front', 'side', 'back', 'other'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTO_DIR),
  filename: (req, file, cb) => {
    const ext = (extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// GET /api/photos -> this account's photos, newest first
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM photo WHERE account_id = ? ORDER BY date DESC, id DESC')
    .all(req.accountId);
  res.json(rows.map((r) => ({ ...r, url: `/api/photos/file/${r.id}` })));
});

// GET /api/photos/file/:id -> serve the image, only if it's this account's
router.get('/file/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM photo WHERE id = ? AND account_id = ?').get(Number(req.params.id), req.accountId);
  if (!row) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(join(PHOTO_DIR, row.filename));
});

// POST /api/photos (multipart: file, date, pose, note)
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'An image file is required.' });
  const { date, pose, note } = req.body ?? {};
  const safeDate = DATE_RE.test(date ?? '') ? date : new Date().toISOString().slice(0, 10);
  const safePose = POSES.includes(pose) ? pose : 'other';
  const info = db
    .prepare('INSERT INTO photo (account_id, date, pose, filename, note) VALUES (?, ?, ?, ?, ?)')
    .run(req.accountId, safeDate, safePose, req.file.filename, note ?? '');
  res.status(201).json({ id: info.lastInsertRowid, url: `/api/photos/file/${info.lastInsertRowid}` });
});

// DELETE /api/photos/:id -> remove row and file (only if this account's)
router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM photo WHERE id = ? AND account_id = ?').get(Number(req.params.id), req.accountId);
  if (row) {
    db.prepare('DELETE FROM photo WHERE id = ?').run(row.id);
    try {
      unlinkSync(join(PHOTO_DIR, row.filename));
    } catch {
      /* file already gone — ignore */
    }
  }
  res.json({ ok: true });
});

export default router;
