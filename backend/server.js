const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(` PokéAPI Backend Server`);
  console.log(` Corriendo en: http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(` Pokémon API:  http://localhost:${PORT}/pokemon`);
  console.log(`=============================================`);
});
