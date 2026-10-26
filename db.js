const Database = require('better-sqlite3');

const db = new Database('rental.db');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client'
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  designer TEXT,
  category TEXT,
  size TEXT,
  description TEXT,
  price_per_day REAL NOT NULL,
  deposit REAL DEFAULT 0,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS rentals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  total_price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'created'
);
`);

module.exports = db;