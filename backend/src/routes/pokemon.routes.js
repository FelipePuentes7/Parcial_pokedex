const express = require('express');
const router = express.Router();
const pokemonController = require('../controllers/pokemon.controller');

// HU-02: Listado paginado de Pokémon
router.get('/', pokemonController.getAllPokemons);

// HU-04: Búsqueda y filtrado por nombre y tipo (debe ir antes de /:id)
router.get('/search', pokemonController.searchPokemons);

// HU-03: Detalle de Pokémon por id o pokedexId
router.get('/:id', pokemonController.getPokemonById);

// HU-05: Creación e importación de Pokémon desde PokéAPI
router.post('/', pokemonController.importPokemon);

// HU-06: Edición de estadísticas y datos de Pokémon
router.put('/:id', pokemonController.updatePokemon);

// HU-07: Eliminación de Pokémon
router.delete('/:id', pokemonController.deletePokemon);

module.exports = router;
