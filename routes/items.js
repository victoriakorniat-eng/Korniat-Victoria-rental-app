const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { validateItem } = require('../validators');

const router = express.Router();

// Беремо параметр лише якщо це непорожній рядок (захист від ?category=a&category=b)
const str = (v) => (typeof v === 'string' && v !== '' ? v : null);

// GET /api/items?category=Сукні&size=M&designer=...&max_price=700
router.get('/', (req, res) => {
  const category = str(req.query.category);
  const size = str(req.query.size);
  const designer = str(req.query.designer);
  const { max_price } = req.query;

  let sql = 'SELECT * FROM items WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (size) { sql += ' AND size = ?'; params.push(size); }
  if (designer) { sql += ' AND designer = ?'; params.push(designer); }
  if (max_price !== undefined && max_price !== '') {
    const n = Number(max_price);
    if (!Number.isFinite(n)) {
      return res.status(400).json({ error: 'max_price має бути числом' });
    }
    sql += ' AND price_per_day <= ?';
    params.push(n);
  }
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
  const b = req.body || {};
  const error = validateItem(b);
  if (error) return res.status(400).json({ error });

  const result = db
    .prepare(
      'INSERT INTO items (title, designer, category, size, description, price_per_day, deposit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(b.title.trim(), b.designer || '', b.category, b.size, b.description || '', b.price_per_day, b.deposit ?? 0, b.image_url || '');
  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/items/:id  (тільки адмін)
router.put('/:id', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  const error = validateItem(b);
  if (error) return res.status(400).json({ error });

  const result = db
    .prepare(
      'UPDATE items SET title=?, designer=?, category=?, size=?, description=?, price_per_day=?, deposit=?, image_url=? WHERE id=?'
    )
    .run(b.title.trim(), b.designer || '', b.category, b.size, b.description || '', b.price_per_day, b.deposit ?? 0, b.image_url || '', req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Товар не знайдено' });
  res.json({ ok: true });
});

// DELETE /api/items/:id  (тільки адмін)
router.delete('/:id', auth, adminOnly, (req, res) => {
  const used = db
    .prepare('SELECT COUNT(*) AS c FROM rentals WHERE item_id = ?')
    .get(req.params.id).c;
  if (used > 0) {
    return res.status(409).json({ error: 'Не можна видалити товар, який має оренди' });
  }
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Товар не знайдено' });
  res.json({ ok: true });
});

module.exports = router;