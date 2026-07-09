import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (e) => String(e ?? '').trim().toLowerCase();

// POST /api/auth/signup { email, password }
router.post('/signup', (req, res) => {
  const email = normEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const exists = db.prepare('SELECT 1 FROM account WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO account (email, password_hash) VALUES (?, ?)').run(email, hash);
  res.status(201).json({ token: signToken(info.lastInsertRowid), email });
});

// POST /api/auth/login { email, password }
router.post('/login', (req, res) => {
  const email = normEmail(req.body?.email);
  const password = String(req.body?.password ?? '');
  const account = db.prepare('SELECT * FROM account WHERE email = ?').get(email);
  if (!account || !bcrypt.compareSync(password, account.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  res.json({ token: signToken(account.id), email: account.email });
});

// GET /api/auth/me -> current account (protected)
router.get('/me', requireAuth, (req, res) => {
  const account = db.prepare('SELECT id, email FROM account WHERE id = ?').get(req.accountId);
  if (!account) return res.status(401).json({ error: 'Account not found.' });
  res.json(account);
});

// POST /api/auth/change-password { currentPassword, newPassword } (protected)
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const account = db.prepare('SELECT * FROM account WHERE id = ?').get(req.accountId);
  if (!account || !bcrypt.compareSync(String(currentPassword ?? ''), account.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  if (String(newPassword ?? '').length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  db.prepare('UPDATE account SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 10), req.accountId);
  res.json({ ok: true });
});

export default router;
