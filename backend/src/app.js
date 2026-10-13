const express = require('express');
const cors = require('cors');
const pokemonRoutes = require('./routes/pokemon.routes');

const app = express();

// Configuración de CORS para permitir solicitudes desde Ionic (http://localhost:8100) y desarrollo local
const allowedOrigins = [
  'http://localhost:8100',
  'http://localhost:4200',
  'http://localhost:8101',
  'capacitor://localhost',
  'http://localhost'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como apps móviles, Postman o curl) o en la lista permitida
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Abierto en desarrollo para máxima compatibilidad
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware para parsear JSON
app.use(express.json());

// HU-00: Endpoint de verificación de salud del servidor
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Rutas de Pokémon
app.use('/pokemon', pokemonRoutes);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

module.exports = app;
