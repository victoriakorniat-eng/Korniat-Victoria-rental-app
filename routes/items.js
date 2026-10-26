const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/items?category=Сукні&size=M&max_price=700
router.get('/', (req, res) => {
  const { category, size, designer, max_price } = req.query;
  let sql = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (size) { sql += ' AND size = ?'; params.push(size); }
  if (designer) { sql += ' AND designer = ?'; params.push(designer); }
  if (max_price) { sql += ' AND price_per_day <= ?'; params.push(Number(max_price)); }
  res.json(db.prepare(sql).all(...params));
});

// GET /api/items/:id
router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Товар не знайдено' });
  res.json(item);
});

// POST /api/items  (тільки адмін)
router.post('/', auth, adminOnly, (req, res) => {
  const { title, designer, category, size, description, price_per_day, deposit, image_url } = req.body;
  if (!title || !price_per_day) {
    return res.status(400).json({ error: 'Потрібні назва і ціна за день' });
  }
  const result = db
    .prepare(
      'INSERT INTO items (title, designer, category, size, description, price_per_day, deposit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(title, designer, category, size, description, price_per_day, deposit || 0, image_url || '');
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/items/:id  (тільки адмін)
router.put('/:id', auth, adminOnly, (req, res) => {
  const { title, designer, category, size, description, price_per_day, deposit, image_url } = req.body;
  const result = db
    .prepare(
      'UPDATE items SET title=?, designer=?, category=?, size=?, description=?, price_per_day=?, deposit=?, image_url=? WHERE id=?'
    )
    .run(title, designer, category, size, description, price_per_day, deposit || 0, image_url || '', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Товар не знайдено' });
  res.json({ ok: true });
});

// DELETE /api/items/:id  (тільки адмін)
router.delete('/:id', auth, adminOnly, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Товар не знайдено' });
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'Не можна видалити товар, який має оренди' });
  }
});

module.exports = router;