const bcrypt = require('bcryptjs');
const db = require('./db');

const adminHash = bcrypt.hashSync('admin123', 10);
db.prepare(
  "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
).run('Адміністратор', 'admin@example.com', adminHash);

const count = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO items (title, designer, category, size, description, price_per_day, deposit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  insert.run('Вечірня сукня «Аврора»', 'Atelier One', 'Сукні', 'M', 'Довга шовкова сукня для урочистих подій', 800, 3000, '');
  insert.run('Піджак oversize', 'Studio Nord', 'Піджаки', 'S', 'Вовняний піджак вільного крою', 400, 1500, '');
  insert.run('Коктейльна сукня «Іскра»', 'Atelier One', 'Сукні', 'S', 'Коротка сукня з паєтками', 600, 2000, '');
  insert.run('Пальто класичне', 'Maison Lviv', 'Верхній одяг', 'L', 'Кашемірове пальто бежевого кольору', 700, 2500, '');
}

console.log('Тестові дані додано');