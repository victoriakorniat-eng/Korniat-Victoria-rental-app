   const app = require('./application');

   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Сервер запущено: http://localhost:${PORT}`);
   });