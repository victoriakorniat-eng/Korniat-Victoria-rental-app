const express = require('express');
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { validateItem } = require('../validators');

const router = express.Router();

// Беремо параметр лише якщо це непорожній рядок (захист від ?category=a&category=b)
const str = (v) => (typeof v === 'string' && v !== '' ? v : null);

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 100;

// Ціле число 1...1 000 000 з рядка запиту; fallback, якщо параметра немає; null, якщо некоректний
function positiveInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= 1000000 ? n : null;
}

// GET /api/items?search=сукня&category=Сукні&size=M&designer=...&max_price=700&page=1&limit=12
router.get('/', (req, res) => {
  const category = str(req.query.category);
  const size = str(req.query.size);
  const designer = str(req.query.designer);
  const search = str(req.query.search);
  const { max_price } = req.query;

  const page = positiveInt(req.query.page, 1);
  const limit = positiveInt(req.query.limit, DEFAULT_LIMIT);
  if (page === null || limit === null || limit > MAX_LIMIT) {
    return res.status(400).json({
      error: `page і limit мають бути цілими числами від 1; limit не більше ${MAX_LIMIT}`,
    });
  }
  if (search && search.length > 100) {
    return res.status(400).json({ error: 'Пошуковий запит не довший за 100 символів' });
  }

  let where = ' WHERE 1=1';
  const params = [];
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (size) { where += ' AND size = ?'; params.push(size); }
  if (designer) { where += ' AND designer = ?'; params.push(designer); }
  if (max_price !== undefined && max_price !== '') {
    const n = Number(max_price);
    if (!Number.isFinite(n)) {
      return res.status(400).json({ error: 'max_price має бути числом' });
    }
    where += ' AND price_per_day <= ?';
    params.push(n);
  }
  if (search) {
    // екрануємо \ % _ , щоб вони шукались як звичайні символи
    const pattern = '%' + search.trim().toLowerCase().replace(/[\\%_]/g, '\\$&') + '%';
    where +=
      " AND (lower_u(title) LIKE ? ESCAPE '\\' OR lower_u(designer) LIKE ? ESCAPE '\\')";
    params.push(pattern, pattern);
  }

  const total = db.prepare('SELECT COUNT(*) AS c FROM items' + where).get(...params).c;
  const items = db
    .prepare('SELECT * FROM items' + where + ' ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(...params, limit, (page - 1) * limit);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
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