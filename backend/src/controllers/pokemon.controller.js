const db = require('../config/db');

const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2/pokemon';

/**
 * Función auxiliar para parsear y normalizar los campos JSON (types y abilities)
 */
const formatPokemon = (pokemon) => {
  if (!pokemon) return null;

  let types = [];
  let abilities = [];

  try {
    types = typeof pokemon.types === 'string' ? JSON.parse(pokemon.types) : pokemon.types;
  } catch {
    types = pokemon.types ? String(pokemon.types).split(',').map((t) => t.trim()) : [];
  }

  try {
    abilities = typeof pokemon.abilities === 'string' ? JSON.parse(pokemon.abilities) : pokemon.abilities;
  } catch {
    abilities = pokemon.abilities ? String(pokemon.abilities).split(',').map((a) => a.trim()) : [];
  }

  return {
    id: pokemon.id,
    pokedexId: pokemon.pokedexId,
    name: pokemon.name,
    types: Array.isArray(types) ? types : [types],
    height: Number(pokemon.height) || 0,
    weight: Number(pokemon.weight) || 0,
    sprite: pokemon.sprite || '',
    abilities: Array.isArray(abilities) ? abilities : [abilities],
    hp: Number(pokemon.hp) || 0,
    attack: Number(pokemon.attack) || 0,
    defense: Number(pokemon.defense) || 0,
    special_attack: Number(pokemon.special_attack) || 0,
    special_defense: Number(pokemon.special_defense) || 0,
    speed: Number(pokemon.speed) || 0,
  };
};

/**
 * Extrae las 6 estadísticas oficiales desde el array de stats de PokéAPI
 */
const extractStatsFromPokeApi = (statsArray = []) => {
  const stats = {
    hp: 0,
    attack: 0,
    defense: 0,
    special_attack: 0,
    special_defense: 0,
    speed: 0,
  };

  if (Array.isArray(statsArray)) {
    for (const item of statsArray) {
      const statName = item.stat?.name;
      const statVal = item.base_stat || 0;
      if (statName === 'hp') stats.hp = statVal;
      else if (statName === 'attack') stats.attack = statVal;
      else if (statName === 'defense') stats.defense = statVal;
      else if (statName === 'special-attack') stats.special_attack = statVal;
      else if (statName === 'special-defense') stats.special_defense = statVal;
      else if (statName === 'speed') stats.speed = statVal;
    }
  }

  return stats;
};

/**
 * HU-02: Obtener listado de Pokémon con soporte de paginación
 * GET /pokemon?page=1&limit=20
 */
const getAllPokemons = (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const offset = (page - 1) * limit;

    // Obtener total de registros
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM pokemons');
    const { total } = totalStmt.get();

    const totalPages = Math.ceil(total / limit) || 1;

    // Obtener registros paginados ordenados por pokedexId
    const pokemonsStmt = db.prepare(`
      SELECT * FROM pokemons
      ORDER BY pokedexId ASC
      LIMIT ? OFFSET ?
    `);
    const rows = pokemonsStmt.all(limit, offset);

    const data = rows.map(formatPokemon);

    return res.status(200).json({
      data,
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    console.error('Error al listar Pokémon:', error);
    return res.status(500).json({ message: 'Error interno del servidor al obtener Pokémon' });
  }
};

/**
 * HU-04: Búsqueda por coincidencia parcial de nombre o coincidencia exacta de ID, y filtro por tipo
 * GET /pokemon/search?name=pik&type=electric
 * GET /pokemon/search?name=25
 */
const searchPokemons = (req, res) => {
  try {
    const { name, q, type, types, id } = req.query;
    const searchTerm = (name || q || id || '').trim();
    const typeFilter = type || types || '';

    let querySql = 'SELECT * FROM pokemons WHERE 1=1';
    const params = [];

    // Si el parámetro recibido es un número entero, buscar coincidencia exacta por ID / pokedexId.
    // Si es texto, mantener búsqueda parcial por coincidencia (LIKE %nombre%).
    if (searchTerm) {
      const cleanNumeric = searchTerm.replace(/^#/, '').trim();
      const isInteger = /^\d+$/.test(cleanNumeric);

      if (isInteger) {
        const numericId = parseInt(cleanNumeric, 10);
        querySql += ' AND (pokedexId = ? OR id = ?)';
        params.push(numericId, numericId);
      } else {
        querySql += ' AND LOWER(name) LIKE LOWER(?)';
        params.push(`%${searchTerm}%`);
      }
    }

    // Filtro por tipo(s) (soporta múltiples tipos separados por coma o individuales)
    if (typeFilter) {
      const typeList = String(typeFilter)
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      for (const t of typeList) {
        querySql += ' AND LOWER(types) LIKE LOWER(?)';
        params.push(`%${t}%`);
      }
    }

    querySql += ' ORDER BY pokedexId ASC';

    const stmt = db.prepare(querySql);
    const rows = stmt.all(...params);

    const formattedResults = rows.map(formatPokemon);

    // Retorna [] con código 200 si no hay resultados
    return res.status(200).json(formattedResults);
  } catch (error) {
    console.error('Error en búsqueda y filtrado de Pokémon:', error);
    return res.status(500).json({ message: 'Error interno al buscar Pokémon' });
  }
};

/**
 * HU-03: Obtener detalle de Pokémon por ID o pokedexId o nombre
 * GET /pokemon/:id
 */
const getPokemonById = (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Parámetro de identificación requerido' });
    }

    let row = null;

    if (!isNaN(id)) {
      const numericId = parseInt(id, 10);
      const stmt = db.prepare(`
        SELECT * FROM pokemons
        WHERE id = ? OR pokedexId = ?
        LIMIT 1
      `);
      row = stmt.get(numericId, numericId);
    } else {
      const nameStmt = db.prepare('SELECT * FROM pokemons WHERE LOWER(name) = LOWER(?) LIMIT 1');
      row = nameStmt.get(id.trim());
    }

    if (!row) {
      return res.status(404).json({ message: 'Pokémon no encontrado' });
    }

    return res.status(200).json(formatPokemon(row));
  } catch (error) {
    console.error('Error al obtener detalle de Pokémon:', error);
    return res.status(500).json({ message: 'Error interno del servidor al obtener detalle del Pokémon' });
  }
};

/**
 * HU-05: Creación e importación de Pokémon desde PokéAPI
 * POST /pokemon
 * Body: { "pokemon": "mewtwo" } o { "pokedexId": 150 } o { "name": "mewtwo" }
 */
const importPokemon = async (req, res) => {
  try {
    const { pokemon, name, pokedexId, id } = req.body;
    const identifier = pokemon || name || pokedexId || id;

    if (!identifier) {
      return res.status(400).json({
        message: 'Debes proporcionar el nombre o pokedexId del Pokémon a importar (ej: { "pokemon": "mewtwo" } o { "pokedexId": 150 })',
      });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();

    // 1. Verificar si ya existe en la base de datos local SQLite
    const existingStmt = db.prepare(`
      SELECT * FROM pokemons
      WHERE LOWER(name) = LOWER(?) OR pokedexId = ?
      LIMIT 1
    `);
    const existing = existingStmt.get(cleanIdentifier, !isNaN(cleanIdentifier) ? parseInt(cleanIdentifier, 10) : -1);

    if (existing) {
      return res.status(409).json({
        message: `El Pokémon "${existing.name}" ya existe en la Pokédex local con el ID #${existing.pokedexId}`,
        pokemon: formatPokemon(existing),
      });
    }

    // 2. Consultar PokéAPI
    let pokeApiResponse;
    try {
      pokeApiResponse = await fetch(`${POKEAPI_BASE_URL}/${encodeURIComponent(cleanIdentifier)}`);
    } catch (networkError) {
      console.error('Error de conexión con PokéAPI:', networkError);
      return res.status(502).json({ message: 'No se pudo contactar con el servicio externo PokéAPI' });
    }

    if (!pokeApiResponse.ok) {
      if (pokeApiResponse.status === 404) {
        return res.status(404).json({ message: `Pokémon "${identifier}" no encontrado en PokéAPI` });
      }
      return res.status(pokeApiResponse.status).json({
        message: `Error al consultar PokéAPI: ${pokeApiResponse.statusText}`,
      });
    }

    const rawData = await pokeApiResponse.json();

    // 3. Extraer y formatear datos
    const targetPokedexId = rawData.id;
    const targetName = rawData.name;
    const typesJson = JSON.stringify(rawData.types.map((t) => t.type.name));
    const height = +(rawData.height / 10).toFixed(1);
    const weight = +(rawData.weight / 10).toFixed(1);
    const sprite =
      rawData.sprites.other?.['official-artwork']?.front_default ||
      rawData.sprites.other?.home?.front_default ||
      rawData.sprites.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${targetPokedexId}.png`;
    const abilitiesJson = JSON.stringify(rawData.abilities.map((a) => a.ability.name));

    const stats = extractStatsFromPokeApi(rawData.stats);

    // 4. Doble verificación por si el pokedexId devuelto ya existía con otro nombre
    const doubleCheck = db.prepare('SELECT * FROM pokemons WHERE pokedexId = ?').get(targetPokedexId);
    if (doubleCheck) {
      return res.status(409).json({
        message: `El Pokémon #${targetPokedexId} (${doubleCheck.name}) ya existe en la Pokédex local`,
        pokemon: formatPokemon(doubleCheck),
      });
    }

    // 5. Insertar en SQLite
    const insertStmt = db.prepare(`
      INSERT INTO pokemons (
        pokedexId, name, types, height, weight, sprite, abilities,
        hp, attack, defense, special_attack, special_defense, speed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      targetPokedexId,
      targetName,
      typesJson,
      height,
      weight,
      sprite,
      abilitiesJson,
      stats.hp,
      stats.attack,
      stats.defense,
      stats.special_attack,
      stats.special_defense,
      stats.speed
    );

    const insertedRow = db.prepare('SELECT * FROM pokemons WHERE id = ?').get(result.lastInsertRowid);
    const formattedPokemon = formatPokemon(insertedRow);

    return res.status(201).json({
      message: `¡Pokémon ${formattedPokemon.name} (#${formattedPokemon.pokedexId}) importado exitosamente!`,
      pokemon: formattedPokemon,
    });
  } catch (error) {
    console.error('Error al importar Pokémon:', error);
    return res.status(500).json({ message: 'Error interno del servidor al importar el Pokémon' });
  }
};

/**
 * HU-06: Edición de estadísticas y atributos de Pokémon
 * PUT /pokemon/:id
 */
const updatePokemon = (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    // 1. Verificar existencia
    const findStmt = db.prepare(`
      SELECT * FROM pokemons
      WHERE id = ? OR pokedexId = ?
      LIMIT 1
    `);
    const existing = isNaN(numericId)
      ? db.prepare('SELECT * FROM pokemons WHERE LOWER(name) = LOWER(?) LIMIT 1').get(id)
      : findStmt.get(numericId, numericId);

    if (!existing) {
      return res.status(404).json({ message: 'Pokémon no encontrado para actualizar' });
    }

    const {
      name,
      types,
      height,
      weight,
      sprite,
      abilities,
      hp,
      attack,
      defense,
      special_attack,
      special_defense,
      speed,
    } = req.body;

    // Normalizar tipos y habilidades si se envían como arrays o strings
    let updatedTypes = existing.types;
    if (types !== undefined) {
      updatedTypes = Array.isArray(types) ? JSON.stringify(types) : JSON.stringify(String(types).split(',').map((t) => t.trim()));
    }

    let updatedAbilities = existing.abilities;
    if (abilities !== undefined) {
      updatedAbilities = Array.isArray(abilities)
        ? JSON.stringify(abilities)
        : JSON.stringify(String(abilities).split(',').map((a) => a.trim()));
    }

    const updatedName = name !== undefined && String(name).trim() !== '' ? String(name).trim().toLowerCase() : existing.name;
    const updatedHeight = height !== undefined && !isNaN(height) ? Number(height) : existing.height;
    const updatedWeight = weight !== undefined && !isNaN(weight) ? Number(weight) : existing.weight;
    const updatedSprite = sprite !== undefined && String(sprite).trim() !== '' ? String(sprite).trim() : existing.sprite;

    const updatedHp = hp !== undefined && !isNaN(hp) ? Math.max(0, parseInt(hp, 10)) : existing.hp;
    const updatedAttack = attack !== undefined && !isNaN(attack) ? Math.max(0, parseInt(attack, 10)) : existing.attack;
    const updatedDefense = defense !== undefined && !isNaN(defense) ? Math.max(0, parseInt(defense, 10)) : existing.defense;
    const updatedSpecialAttack =
      special_attack !== undefined && !isNaN(special_attack)
        ? Math.max(0, parseInt(special_attack, 10))
        : existing.special_attack;
    const updatedSpecialDefense =
      special_defense !== undefined && !isNaN(special_defense)
        ? Math.max(0, parseInt(special_defense, 10))
        : existing.special_defense;
    const updatedSpeed = speed !== undefined && !isNaN(speed) ? Math.max(0, parseInt(speed, 10)) : existing.speed;

    const updateStmt = db.prepare(`
      UPDATE pokemons
      SET
        name = ?,
        types = ?,
        height = ?,
        weight = ?,
        sprite = ?,
        abilities = ?,
        hp = ?,
        attack = ?,
        defense = ?,
        special_attack = ?,
        special_defense = ?,
        speed = ?
      WHERE id = ?
    `);

    updateStmt.run(
      updatedName,
      updatedTypes,
      updatedHeight,
      updatedWeight,
      updatedSprite,
      updatedAbilities,
      updatedHp,
      updatedAttack,
      updatedDefense,
      updatedSpecialAttack,
      updatedSpecialDefense,
      updatedSpeed,
      existing.id
    );

    const updatedRow = db.prepare('SELECT * FROM pokemons WHERE id = ?').get(existing.id);
    const formatted = formatPokemon(updatedRow);

    return res.status(200).json({
      message: `Pokémon ${formatted.name} actualizado exitosamente`,
      pokemon: formatted,
    });
  } catch (error) {
    console.error('Error al actualizar Pokémon:', error);
    return res.status(500).json({ message: 'Error interno del servidor al actualizar el Pokémon' });
  }
};

/**
 * HU-07: Eliminación de Pokémon por ID o pokedexId
 * DELETE /pokemon/:id
 */
const deletePokemon = (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id, 10);

    const findStmt = db.prepare(`
      SELECT * FROM pokemons
      WHERE id = ? OR pokedexId = ?
      LIMIT 1
    `);
    const existing = isNaN(numericId)
      ? db.prepare('SELECT * FROM pokemons WHERE LOWER(name) = LOWER(?) LIMIT 1').get(id)
      : findStmt.get(numericId, numericId);

    if (!existing) {
      return res.status(404).json({ message: 'Pokémon no encontrado para eliminar' });
    }

    const deleteStmt = db.prepare('DELETE FROM pokemons WHERE id = ?');
    deleteStmt.run(existing.id);

    return res.status(200).json({
      message: `Pokémon "${existing.name}" (#${existing.pokedexId}) eliminado exitosamente`,
      id: existing.id,
      pokedexId: existing.pokedexId,
      name: existing.name,
    });
  } catch (error) {
    console.error('Error al eliminar Pokémon:', error);
    return res.status(500).json({ message: 'Error interno del servidor al eliminar el Pokémon' });
  }
};

module.exports = {
  getAllPokemons,
  searchPokemons,
  getPokemonById,
  importPokemon,
  updatePokemon,
  deletePokemon,
};
