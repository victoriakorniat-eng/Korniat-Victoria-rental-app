const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/rentals', require('./routes/rentals'));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущено: http://localhost:${PORT}`);
});