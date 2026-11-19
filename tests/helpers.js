const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../db');
const app = require('../application');

// Дата РРРР-ММ-ДД через N днів від сьогодні (локальний час, як на сервері)
function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const validItem = {
  title: 'Тестова сукня',
  designer: 'Test Studio',
  category: 'Сукні',
  size: 'M',
  description: 'Товар для автотестів',
  price_per_day: 500,
  deposit: 1000,
  image_url: '',
};

const auth = (token) => ({ Authorization: 'Bearer ' + token });

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

// Створює адміністратора, двох клієнтів і один товар; повертає токени
async function setup() {
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(
    'Адміністратор',
    'admin@test.com',
    bcrypt.hashSync('admin123', 4)
  );
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Марія', email: 'maria@test.com', password: '123456' });
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'Ольга', email: 'olha@test.com', password: '123456' });

  const adminToken = await login('admin@test.com', 'admin123');
  const clientToken = await login('maria@test.com', '123456');
  const client2Token = await login('olha@test.com', '123456');

  const res = await request(app).post('/api/items').set(auth(adminToken)).send(validItem);
  return { app, db, adminToken, clientToken, client2Token, itemId: res.body.id };
}

module.exports = { setup, futureDate, validItem, auth };