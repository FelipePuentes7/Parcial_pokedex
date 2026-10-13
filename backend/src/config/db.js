const Database = require('better-sqlite3');
const path = require('path');

// Ruta del archivo SQLite en la raíz del backend
const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new Database(dbPath);

// Habilitar modo WAL para mejor rendimiento de lectura/escritura
db.pragma('journal_mode = WAL');

// Inicialización de la tabla pokemons con estadísticas de combate (HU-00 / Sprint 2)
const initDb = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS pokemons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedexId INTEGER UNIQUE,
      name TEXT NOT NULL,
      types TEXT NOT NULL,
      height REAL,
      weight REAL,
      sprite TEXT,
      abilities TEXT,
      hp INTEGER DEFAULT 0,
      attack INTEGER DEFAULT 0,
      defense INTEGER DEFAULT 0,
      special_attack INTEGER DEFAULT 0,
      special_defense INTEGER DEFAULT 0,
      speed INTEGER DEFAULT 0
    );
  `;
  db.exec(createTableQuery);

  // Migración automática de columnas para bases de datos existentes
  const columns = db.pragma('table_info(pokemons)').map((col) => col.name);
  const statColumns = [
    'hp',
    'attack',
    'defense',
    'special_attack',
    'special_defense',
    'speed',
  ];

  for (const col of statColumns) {
    if (!columns.includes(col)) {
      db.exec(`ALTER TABLE pokemons ADD COLUMN ${col} INTEGER DEFAULT 0;`);
    }
  }
};

initDb();

module.exports = db;

