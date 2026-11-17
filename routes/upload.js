const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Розширення визначаємо за типом, а не за іменем, яке надіслав клієнт
const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT_BY_MIME[file.mimetype]),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) return cb(null, true);
    const err = new Error('Дозволені лише зображення JPEG, PNG або WebP');
    err.status = 400;
    cb(err);
  },
});

// POST /api/upload  (form-data, поле "image")  (тільки адмін)
router.post('/', auth, adminOnly, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Файл завеликий (максимум 2 МБ)';
      else if (err instanceof multer.MulterError) err.message = 'Помилка завантаження файлу';
      err.status = err.status || 400;
      return next(err);
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не передано (поле «image»)' });
    }
    res.status(201).json({ url: '/uploads/' + req.file.filename });
  });
});

module.exports = router;