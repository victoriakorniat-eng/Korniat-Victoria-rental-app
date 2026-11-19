const request = require('supertest');
const app = require('../application');

test('[НВ-01] після 10 невдалих спроб входу наступна отримує 429', async () => {
  for (let i = 0; i < 10; i++) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  }
  const blocked = await request(app)
    .post('/api/auth/login')
    .send({ email: 'nobody@test.com', password: 'wrong' });
  expect(blocked.status).toBe(429);
});