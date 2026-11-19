const request = require('supertest');
const { setup, futureDate, validItem, auth } = require('./helpers');

let ctx;
beforeAll(async () => {
  ctx = await setup();
});

const createItem = (overrides = {}) =>
  request(ctx.app)
    .post('/api/items')
    .set(auth(ctx.adminToken))
    .send({ ...validItem, ...overrides });

describe('Керування товарами', () => {
  test('[ФВ-07] без токена -> 401', async () => {
    const res = await request(ctx.app).post('/api/items').send(validItem);
    expect(res.status).toBe(401);
  });

  test('[ФВ-04] токен клієнта -> 403', async () => {
    const res = await request(ctx.app).post('/api/items').set(auth(ctx.clientToken)).send(validItem);
    expect(res.status).toBe(403);
  });

  test('[ФВ-07] без назви -> 400', async () => {
    const res = await createItem({ title: '' });
    expect(res.status).toBe(400);
  });

  test('[ФВ-07] відʼємна ціна -> 400', async () => {
    const res = await createItem({ price_per_day: -5 });
    expect(res.status).toBe(400);
  });

  test('[ФВ-07] невідома категорія -> 400', async () => {
    const res = await createItem({ category: 'Хмарочос' });
    expect(res.status).toBe(400);
  });

  test('[ФВ-07] адмін створює, змінює і читає товар', async () => {
    const created = await createItem({ title: 'Піддослідна сукня' });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const updated = await request(ctx.app)
      .put(`/api/items/${id}`)
      .set(auth(ctx.adminToken))
      .send({ ...validItem, title: 'Піддослідна сукня', price_per_day: 650 });
    expect(updated.status).toBe(200);

    const read = await request(ctx.app).get(`/api/items/${id}`);
    expect(read.status).toBe(200);
    expect(read.body.price_per_day).toBe(650);
  });

  test('[ФВ-07] зміна неіснуючого товару -> 404', async () => {
    const res = await request(ctx.app)
      .put('/api/items/9999')
      .set(auth(ctx.adminToken))
      .send(validItem);
    expect(res.status).toBe(404);
  });

  test('[ФВ-06] неіснуючий товар -> 404', async () => {
    const res = await request(ctx.app).get('/api/items/9999');
    expect(res.status).toBe(404);
  });

  test('[ФВ-08] товар з орендою видалити неможливо -> 409', async () => {
    const rental = await request(ctx.app)
      .post('/api/rentals')
      .set(auth(ctx.clientToken))
      .send({ item_id: ctx.itemId, start_date: futureDate(5), end_date: futureDate(6) });
    expect(rental.status).toBe(201);

    const res = await request(ctx.app).delete(`/api/items/${ctx.itemId}`).set(auth(ctx.adminToken));
    expect(res.status).toBe(409);
  });

  test('[ФВ-07] товар без оренд видаляється, потім 404', async () => {
    const created = await createItem({ title: 'На видалення' });
    const id = created.body.id;
    const del = await request(ctx.app).delete(`/api/items/${id}`).set(auth(ctx.adminToken));
    expect(del.status).toBe(200);
    const read = await request(ctx.app).get(`/api/items/${id}`);
    expect(read.status).toBe(404);
  });
});

describe('Каталог: фільтри, пошук, пагінація', () => {
  beforeAll(async () => {
    await createItem({ title: 'Вечірня сукня Аврора' });
    await createItem({ title: 'Класичний піджак', category: 'Піджаки', size: 'S', price_per_day: 80 });
    await createItem({ title: 'Додатковий товар 1' });
    await createItem({ title: 'Додатковий товар 2' });
    await createItem({ title: 'Додатковий товар 3' });
  });

  test('[ФВ-05] відповідь містить items, total, page, limit, pages', async () => {
    const res = await request(ctx.app).get('/api/items');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    for (const key of ['total', 'page', 'limit', 'pages']) {
      expect(res.body).toHaveProperty(key);
    }
  });

  test('[ФВ-05] фільтр за категорією', async () => {
    const res = await request(ctx.app).get('/api/items').query({ category: 'Піджаки' });
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i) => i.category === 'Піджаки')).toBe(true);
  });

  test('[ФВ-05] фільтр за максимальною ціною', async () => {
    const res = await request(ctx.app).get('/api/items').query({ max_price: 100 });
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((i) => i.price_per_day <= 100)).toBe(true);
  });

  test('[ФВ-05] max_price не число -> 400', async () => {
    const res = await request(ctx.app).get('/api/items').query({ max_price: 'abc' });
    expect(res.status).toBe(400);
  });

  test('[ФВ-10] пошук не залежить від регістру (кирилиця)', async () => {
    const lower = await request(ctx.app).get('/api/items').query({ search: 'сукн' });
    const upper = await request(ctx.app).get('/api/items').query({ search: 'СУКН' });
    expect(lower.body.total).toBeGreaterThan(0);
    expect(upper.body.total).toBe(lower.body.total);
  });

  test('[ФВ-10] пошук без збігів повертає порожній список', async () => {
    const res = await request(ctx.app).get('/api/items').query({ search: 'zzzzzz' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  test('[ФВ-10] символ % шукається буквально', async () => {
    const res = await request(ctx.app).get('/api/items').query({ search: '%' });
    expect(res.body.total).toBe(0);
  });

  test('[ФВ-10] пагінація: сторінки не перетинаються', async () => {
    const p1 = await request(ctx.app).get('/api/items').query({ page: 1, limit: 2 });
    const p2 = await request(ctx.app).get('/api/items').query({ page: 2, limit: 2 });
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.pages).toBeGreaterThanOrEqual(2);
    const ids1 = p1.body.items.map((i) => i.id);
    const ids2 = p2.body.items.map((i) => i.id);
    expect(ids2.length).toBeGreaterThan(0);
    expect(ids2.some((id) => ids1.includes(id))).toBe(false);
  });

  test('[ФВ-10] page=0, page=abc і limit=1000 -> 400', async () => {
    const a = await request(ctx.app).get('/api/items').query({ page: 0 });
    const b = await request(ctx.app).get('/api/items').query({ page: 'abc' });
    const c = await request(ctx.app).get('/api/items').query({ limit: 1000 });
    expect([a.status, b.status, c.status]).toEqual([400, 400, 400]);
  });
});