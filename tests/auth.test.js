const request = require('supertest');
const { setup, auth } = require('./helpers');

let ctx;
beforeAll(async () => {
  ctx = await setup();
});

describe('Реєстрація', () => {
  test('[ФВ-01] коректна реєстрація повертає 201, email у нижньому регістрі', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Анна', email: 'ANNA@Test.com', password: '123456' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe('anna@test.com');
    expect(res.body.password_hash).toBeUndefined();
  });

  test('[ФВ-01] повторний email -> 409', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Марія', email: 'maria@test.com', password: '123456' });
    expect(res.status).toBe(409);
  });

  test('[ФВ-01] некоректний email -> 400', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Тест', email: 'abc', password: '123456' });
    expect(res.status).toBe(400);
  });

  test('[ФВ-01] короткий пароль -> 400', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Тест', email: 't@test.com', password: '123' });
    expect(res.status).toBe(400);
  });

  test('[ФВ-01, НВ-01] імʼя неправильного типу -> 400, а не 500', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: { a: 1 }, email: 't@test.com', password: '123456' });
    expect(res.status).toBe(400);
  });

  test('[ФВ-03] пароль зберігається у вигляді bcrypt-хешу', () => {
    const row = ctx.db
      .prepare('SELECT password_hash FROM users WHERE email = ?')
      .get('maria@test.com');
    expect(row.password_hash).not.toBe('123456');
    expect(row.password_hash.startsWith('$2')).toBe(true);
  });
});

describe('Вхід і токени', () => {
  test('[ФВ-02] правильні дані -> 200 і токен', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'maria@test.com', password: '123456' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.role).toBe('client');
  });

  test('[ФВ-02] хибний пароль -> 401', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'maria@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('[ФВ-02] неіснуючий користувач -> 401', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: '123456' });
    expect(res.status).toBe(401);
  });

  test('[ФВ-04] захищений маршрут без токена -> 401', async () => {
    const res = await request(ctx.app).get('/api/rentals/my');
    expect(res.status).toBe(401);
  });

  test('[ФВ-04] підроблений токен -> 401', async () => {
    const res = await request(ctx.app).get('/api/rentals/my').set(auth('abc.def.ghi'));
    expect(res.status).toBe(401);
  });
});

describe('Обробка помилок', () => {
  test('[ФВ-17] зламаний JSON -> 400 з повідомленням у JSON', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ "email": }');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('[ФВ-17] невідомий маршрут API -> 404 у форматі JSON', async () => {
    const res = await request(ctx.app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});