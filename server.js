const express = require('express');
const helmet = require('helmet');
const path = require('path');
require('./db');

const app = express();

// Захисні HTTP-заголовки; дозволяємо картинки з https та data:
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:'],
        'upgrade-insecure-requests': null,
      },
    },
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/rentals', require('./routes/rentals'));
app.use('/api/upload', require('./routes/upload'));

// Невідомий маршрут API: відповідь JSON, а не HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Маршрут не знайдено' });
});

// Єдиний обробник помилок (має мати рівно 4 параметри)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некоректний JSON у тілі запиту' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Тіло запиту завелике' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Внутрішня помилка сервера' : err.message,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});