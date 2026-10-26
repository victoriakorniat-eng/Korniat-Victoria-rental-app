const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// POST /api/rentals  { item_id, start_date, end_date }  (дати у форматі 2026-11-05)
router.post('/', auth, (req, res) => {
  const { item_id, start_date, end_date } = req.body;
  if (!item_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'Потрібні item_id, start_date, end_date' });
  }
  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start) || isNaN(end) || end < start) {
    return res.status(400).json({ error: 'Некоректні дати' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Товар не знайдено' });

  // перевірка: чи перетинаються дати з уже наявними орендами
  const busy = db
    .prepare(
      "SELECT COUNT(*) AS c FROM rentals WHERE item_id = ? AND status != 'cancelled' AND start_date <= ? AND end_date >= ?"
    )
    .get(item_id, end_date, start_date).c;
  if (busy > 0) {
    return res.status(409).json({ error: 'Ці дати вже заброньовано' });
  }

  const days = Math.round((end - start) / 86400000) + 1;
  const total = days * item.price_per_day + (item.deposit || 0);

  const result = db
    .prepare('INSERT INTO rentals (user_id, item_id, start_date, end_date, total_price) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, item_id, start_date, end_date, total);

  res.status(201).json({ id: result.lastInsertRowid, days, total_price: total, status: 'created' });
});

// GET /api/rentals/my  (мої оренди)
router.get('/my', auth, (req, res) => {
  const rows = db
    .prepare(
      'SELECT r.*, i.title FROM rentals r JOIN items i ON i.id = r.item_id WHERE r.user_id = ? ORDER BY r.id DESC'
    )
    .all(req.user.id);
  res.json(rows);
});

// GET /api/rentals  (усі оренди, адмін)
router.get('/', auth, adminOnly, (req, res) => {
  const rows = db
    .prepare(
      'SELECT r.*, i.title, u.name AS user_name FROM rentals r JOIN items i ON i.id = r.item_id JOIN users u ON u.id = r.user_id ORDER BY r.id DESC'
    )
    .all();
  res.json(rows);
});

// PATCH /api/rentals/:id/status  { status }  (адмін)
router.patch('/:id/status', auth, adminOnly, (req, res) => {
  const allowed = ['created', 'confirmed', 'issued', 'returned', 'cancelled'];
  const { status } = req.body;
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Недопустимий статус' });
  }
  const result = db.prepare('UPDATE rentals SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Оренду не знайдено' });
  res.json({ ok: true });
});

module.exports = router;