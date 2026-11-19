// Виконується перед кожним файлом тестів
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';