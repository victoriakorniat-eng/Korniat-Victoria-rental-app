const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Вкажіть імʼя, email і пароль (мінімум 6 символів)' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Користувач з таким email вже існує' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'client')")
    .run(name, email, hash);
  res.status(201).json({ id: result.lastInsertRowid, name, email });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }
  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, {
    expiresIn: '2h',
  });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

module.exports = router;