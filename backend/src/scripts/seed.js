const db = require('../config/db');

const TOTAL_POKEMONS = 151;
const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2/pokemon';

async function seedDatabase() {
  console.log(`🚀 Iniciando seed de ${TOTAL_POKEMONS} Pokémon desde PokéAPI...`);

  try {
    // 1. Obtener la lista de los primeros 151 Pokémon
    const response = await fetch(`${POKEAPI_BASE_URL}?limit=${TOTAL_POKEMONS}`);
    if (!response.ok) {
      throw new Error(`Error al consultar PokéAPI: ${response.statusText}`);
    }

    const data = await response.json();
    const pokemonList = data.results;

    console.log(`📥 Lista base descargada (${pokemonList.length} registros). Obteniendo detalles individuales desde PokéAPI...`);

    // 2. Descargar detalles en lotes para velocidad y cortesía con la API
    const BATCH_SIZE = 25;
    const allDetails = [];

    for (let i = 0; i < pokemonList.length; i += BATCH_SIZE) {
      const batch = pokemonList.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (p) => {
        const detailRes = await fetch(p.url);
        if (!detailRes.ok) {
          throw new Error(`Error al obtener detalle de ${p.name}`);
        }
        return detailRes.json();
      });

      const batchResults = await Promise.all(batchPromises);
      allDetails.push(...batchResults);
      console.log(`  Procesados ${Math.min(i + BATCH_SIZE, pokemonList.length)} / ${pokemonList.length}...`);
    }

    // 3. Preparar inserción idempotente con SQLite con las 6 estadísticas base
    const insertStmt = db.prepare(`
      INSERT INTO pokemons (pokedexId, name, types, height, weight, sprite, abilities, hp, attack, defense, special_attack, special_defense, speed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(pokedexId) DO UPDATE SET
        name = excluded.name,
        types = excluded.types,
        height = excluded.height,
        weight = excluded.weight,
        sprite = excluded.sprite,
        abilities = excluded.abilities,
        hp = excluded.hp,
        attack = excluded.attack,
        defense = excluded.defense,
        special_attack = excluded.special_attack,
        special_defense = excluded.special_defense,
        speed = excluded.speed
    `);

    // 4. Ejecutar inserción dentro de una transacción
    const insertTransaction = db.transaction((pokemons) => {
      let count = 0;
      for (const p of pokemons) {
        const pokedexId = p.id;
        const name = p.name;
        const types = JSON.stringify(p.types.map((t) => t.type.name));
        // PokeAPI: height en decímetros (dm -> m), weight en hectogramos (hg -> kg)
        const height = +(p.height / 10).toFixed(1);
        const weight = +(p.weight / 10).toFixed(1);
        
        // Priorizar el artwork oficial en alta resolución de PokéAPI, con fallback a front_default
        const sprite =
          p.sprites.other?.['official-artwork']?.front_default ||
          p.sprites.other?.home?.front_default ||
          p.sprites.front_default ||
          `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokedexId}.png`;
        
        const abilities = JSON.stringify(p.abilities.map((a) => a.ability.name));

        // Extraer las 6 estadísticas oficiales
        let hp = 0;
        let attack = 0;
        let defense = 0;
        let special_attack = 0;
        let special_defense = 0;
        let speed = 0;

        if (Array.isArray(p.stats)) {
          for (const s of p.stats) {
            const statName = s.stat?.name;
            const statVal = s.base_stat || 0;
            if (statName === 'hp') hp = statVal;
            else if (statName === 'attack') attack = statVal;
            else if (statName === 'defense') defense = statVal;
            else if (statName === 'special-attack') special_attack = statVal;
            else if (statName === 'special-defense') special_defense = statVal;
            else if (statName === 'speed') speed = statVal;
          }
        }

        insertStmt.run(
          pokedexId,
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
          speed
        );
        count++;
      }
      return count;
    });

    const totalInserted = insertTransaction(allDetails);

    console.log(`✅ Seed completado con éxito. Se actualizaron ${totalInserted} Pokémon en database.sqlite con las imágenes y las 6 estadísticas oficiales de PokéAPI.`);
    
    const countResult = db.prepare('SELECT COUNT(*) as total FROM pokemons').get();
    console.log(`📊 Total de Pokémon en la base de datos: ${countResult.total}`);
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
    process.exit(1);
  }
}

seedDatabase();
