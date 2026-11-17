const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { SECRET } = require('../middleware/auth');
const { validateRegistration } = require('../validators');

const router = express.Router();

// Не більше 10 невдалих спроб входу за 15 хвилин з однієї адреси.
// Успішні входи не рахуються.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Забагато невдалих спроб входу. Спробуйте через 15 хвилин' },
});

// POST /api/auth/register
router.post('/register', (req, res) => {
  const body = req.body || {};
  const error = validateRegistration(body);
  if (error) return res.status(400).json({ error });

  const name = body.name.trim();
  const email = body.email.trim().toLowerCase();

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Користувач з таким email вже існує' });

  const hash = bcrypt.hashSync(body.password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'client')")
    .run(name, email, hash);
  res.status(201).json({ id: result.lastInsertRowid, name, email });
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Вкажіть email і пароль' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, {
    expiresIn: '2h',
  });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

module.exports = router;