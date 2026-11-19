const request = require('supertest');
const { setup, futureDate, auth } = require('./helpers');

let ctx;
beforeAll(async () => {
  ctx = await setup();
});

const book = (token, from, to, itemId) =>
  request(ctx.app)
    .post('/api/rentals')
    .set(auth(token))
    .send({ item_id: itemId ?? ctx.itemId, start_date: futureDate(from), end_date: futureDate(to) });

const setStatus = (id, status, token) =>
  request(ctx.app)
    .patch(`/api/rentals/${id}/status`)
    .set(auth(token || ctx.adminToken))
    .send({ status });

const cancel = (id, token) =>
  request(ctx.app).patch(`/api/rentals/${id}/cancel`).set(auth(token));

describe('Створення оренди', () => {
  test('[ФВ-11, ФВ-13] оренда на 3 дні: 3 × 500 + застава 1000 = 2500', async () => {
    const res = await book(ctx.clientToken, 10, 12);
    expect(res.status).toBe(201);
    expect(res.body.days).toBe(3);
    expect(res.body.total_price).toBe(2500);
    expect(res.body.status).toBe('created');
  });

  test('[ФВ-12] перетин дат -> 409', async () => {
    const res = await book(ctx.client2Token, 11, 13);
    expect(res.status).toBe(409);
  });

  test('[ФВ-12] сусідні дати без перетину дозволені', async () => {
    const res = await book(ctx.client2Token, 13, 14);
    expect(res.status).toBe(201);
  });

  test('[ФВ-11] без токена -> 401', async () => {
    const res = await request(ctx.app)
      .post('/api/rentals')
      .send({ item_id: ctx.itemId, start_date: futureDate(20), end_date: futureDate(21) });
    expect(res.status).toBe(401);
  });

  test('[ФВ-11] початок у минулому -> 400', async () => {
    const res = await book(ctx.clientToken, -1, 2);
    expect(res.status).toBe(400);
  });

  test('[ФВ-11] кінець раніше за початок -> 400', async () => {
    const res = await book(ctx.clientToken, 20, 18);
    expect(res.status).toBe(400);
  });

  test('[ФВ-11] термін понад 30 днів -> 400', async () => {
    const res = await book(ctx.clientToken, 40, 80);
    expect(res.status).toBe(400);
  });

  test('[ФВ-11] item_id не число -> 400', async () => {
    const res = await request(ctx.app)
      .post('/api/rentals')
      .set(auth(ctx.clientToken))
      .send({ item_id: 'abc', start_date: futureDate(50), end_date: futureDate(51) });
    expect(res.status).toBe(400);
  });

  test('[ФВ-11] неіснуючий товар -> 404', async () => {
    const res = await book(ctx.clientToken, 50, 52, 9999);
    expect(res.status).toBe(404);
  });
});

describe('Скасування оренди клієнтом', () => {
  let rentalId;
  beforeAll(async () => {
    rentalId = (await book(ctx.clientToken, 60, 62)).body.id;
  });

  test('[ФВ-16] чужа оренда -> 403', async () => {
    const res = await cancel(rentalId, ctx.client2Token);
    expect(res.status).toBe(403);
  });

  test('[ФВ-16] неіснуюча оренда -> 404', async () => {
    const res = await cancel(9999, ctx.clientToken);
    expect(res.status).toBe(404);
  });

  test('[ФВ-16] власна оренда скасовується -> 200', async () => {
    const res = await cancel(rentalId, ctx.clientToken);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });

  test('[ФВ-16] повторне скасування -> 409', async () => {
    const res = await cancel(rentalId, ctx.clientToken);
    expect(res.status).toBe(409);
  });

  test('[ФВ-12] після скасування ті самі дати знову вільні', async () => {
    const res = await book(ctx.client2Token, 60, 62);
    expect(res.status).toBe(201);
  });

  test('[ФВ-16] видану оренду скасувати неможливо -> 409', async () => {
    const id = (await book(ctx.clientToken, 70, 71)).body.id;
    expect((await setStatus(id, 'confirmed')).status).toBe(200);
    expect((await setStatus(id, 'issued')).status).toBe(200);
    const res = await cancel(id, ctx.clientToken);
    expect(res.status).toBe(409);
  });
});

describe('Зміна статусу адміністратором', () => {
  let rentalId;
  beforeAll(async () => {
    rentalId = (await book(ctx.clientToken, 80, 81)).body.id;
  });

  test('[ФВ-04] токен клієнта -> 403', async () => {
    const res = await setStatus(rentalId, 'confirmed', ctx.clientToken);
    expect(res.status).toBe(403);
  });

  test('[ФВ-04] без токена -> 401', async () => {
    const res = await request(ctx.app).patch(`/api/rentals/${rentalId}/status`).send({ status: 'confirmed' });
    expect(res.status).toBe(401);
  });

  test('[ФВ-15] неіснуюча оренда -> 404', async () => {
    const res = await setStatus(9999, 'confirmed');
    expect(res.status).toBe(404);
  });

  test('[ФВ-15] невідомий статус -> 400', async () => {
    const res = await setStatus(rentalId, 'abc');
    expect(res.status).toBe(400);
  });

  test('[ФВ-15] created -> issued (пропуск етапу) -> 409', async () => {
    const res = await setStatus(rentalId, 'issued');
    expect(res.status).toBe(409);
  });

  test('[ФВ-15] created -> confirmed -> 200', async () => {
    const res = await setStatus(rentalId, 'confirmed');
    expect(res.status).toBe(200);
  });

  test('[ФВ-15] confirmed -> issued -> 200', async () => {
    const res = await setStatus(rentalId, 'issued');
    expect(res.status).toBe(200);
  });

  test('[ФВ-15] issued -> cancelled -> 409', async () => {
    const res = await setStatus(rentalId, 'cancelled');
    expect(res.status).toBe(409);
  });

  test('[ФВ-15] issued -> returned -> 200', async () => {
    const res = await setStatus(rentalId, 'returned');
    expect(res.status).toBe(200);
  });

  test('[ФВ-15] returned -> confirmed (кінцевий статус) -> 409', async () => {
    const res = await setStatus(rentalId, 'confirmed');
    expect(res.status).toBe(409);
  });
});

describe('Списки оренд', () => {
  test('[ФВ-14] клієнт не бачить список усіх оренд -> 403', async () => {
    const res = await request(ctx.app).get('/api/rentals').set(auth(ctx.clientToken));
    expect(res.status).toBe(403);
  });

  test('[ФВ-14] адмін бачить усі оренди з даними клієнта', async () => {
    const res = await request(ctx.app).get('/api/rentals').set(auth(ctx.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('user_email');
  });

  test('[ФВ-14] фільтр за статусом', async () => {
    const res = await request(ctx.app).get('/api/rentals').query({ status: 'returned' }).set(auth(ctx.adminToken));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((r) => r.status === 'returned')).toBe(true);
  });

  test('[ФВ-14] недопустимий статус у фільтрі -> 400', async () => {
    const res = await request(ctx.app).get('/api/rentals').query({ status: 'abc' }).set(auth(ctx.adminToken));
    expect(res.status).toBe(400);
  });

  test('[ФВ-14] «Мої оренди» містять лише оренди власника', async () => {
    const userId = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get('olha@test.com').id;
    const res = await request(ctx.app).get('/api/rentals/my').set(auth(ctx.client2Token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((r) => r.user_id === userId)).toBe(true);
  });
});