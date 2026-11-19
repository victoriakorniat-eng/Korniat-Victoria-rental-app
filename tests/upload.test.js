const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { setup, auth } = require('./helpers');

let ctx;
beforeAll(async () => {
  ctx = await setup();
});

// Мінімальний валідний PNG 1×1 піксель
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const upload = (token, buffer, filename, contentType) => {
  const req = request(ctx.app).post('/api/upload');
  if (token) req.set(auth(token));
  if (buffer) req.attach('image', buffer, { filename, contentType });
  return req;
};

test('[ФВ-09] без токена -> 401', async () => {
  const res = await upload(null, PNG, 'a.png', 'image/png');
  expect(res.status).toBe(401);
});

test('[ФВ-09] токен клієнта -> 403', async () => {
  const res = await upload(ctx.clientToken, PNG, 'a.png', 'image/png');
  expect(res.status).toBe(403);
});

test('[ФВ-09] файл не передано -> 400', async () => {
  const res = await upload(ctx.adminToken, null);
  expect(res.status).toBe(400);
});

test('[ФВ-09] не зображення -> 400', async () => {
  const res = await upload(ctx.adminToken, Buffer.from('hello'), 'a.txt', 'text/plain');
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/зображення/);
});

test('[ФВ-09] файл понад 2 МБ -> 400', async () => {
  const big = Buffer.alloc(2 * 1024 * 1024 + 1024);
  const res = await upload(ctx.adminToken, big, 'big.png', 'image/png');
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/завеликий/);
});

test('[ФВ-09] адмін завантажує PNG -> 201, файл зʼявляється на диску', async () => {
  const res = await upload(ctx.adminToken, PNG, 'test.png', 'image/png');
  expect(res.status).toBe(201);
  expect(res.body.url).toMatch(/^\/uploads\/[\w-]+\.png$/);
  const file = path.join(__dirname, '..', 'public', res.body.url);
  expect(fs.existsSync(file)).toBe(true);
  fs.unlinkSync(file); // прибираємо тестовий файл
});