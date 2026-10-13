import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, forkJoin, catchError, map, switchMap } from 'rxjs';

export interface Pokemon {
  id: number;
  pokedexId: number;
  name: string;
  types: string[];
  height: number;
  weight: number;
  sprite: string;
  abilities: string[];
  // 6 Estadísticas base oficiales (Sprint 2)
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
}

export interface PokemonListResponse {
  data: Pokemon[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable({
  providedIn: 'root',
})
export class PokemonService {
  private readonly backendUrl = 'http://localhost:3000/pokemon';
  private readonly pokeApiUrl = 'https://pokeapi.co/api/v2/pokemon';

  constructor(private http: HttpClient) {}

  /**
   * Obtiene la URL de la imagen en alta definición oficial de PokéAPI
   */
  getOfficialArtwork(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  /**
   * HU-02: Obtener lista paginada de Pokémon
   */
  getPokemons(page: number = 1, limit: number = 20): Observable<PokemonListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PokemonListResponse>(this.backendUrl, { params }).pipe(
      map((response) => ({
        ...response,
        data: response.data.map((p) => ({
          ...p,
          sprite: p.sprite || this.getOfficialArtwork(p.pokedexId || p.id),
        })),
      })),
      catchError((error) => {
        console.warn('Backend local no disponible, consumiendo PokéAPI directamente:', error);
        return this.fetchFromPokeApi(page, limit);
      })
    );
  }

  /**
   * HU-03: Obtener información detallada de un Pokémon por su ID o pokedexId
   */
  getPokemonById(id: number | string): Observable<Pokemon> {
    return this.http.get<Pokemon>(`${this.backendUrl}/${id}`).pipe(
      map((p) => ({
        ...p,
        sprite: p.sprite || this.getOfficialArtwork(p.pokedexId || p.id),
      })),
      catchError((error) => {
        console.warn(`Backend local falló para ID ${id}, consultando PokéAPI directamente:`, error);
        return this.fetchDetailFromPokeApi(id);
      })
    );
  }

  /**
   * HU-04: Búsqueda y filtrado por nombre y/o tipo
   * GET /pokemon/search?name=...&type=...
   */
  searchPokemons(query: string = '', type: string = ''): Observable<Pokemon[]> {
    let params = new HttpParams();
    if (query && query.trim() !== '') {
      params = params.set('name', query.trim());
    }
    if (type && type.trim() !== '' && type !== 'all') {
      params = params.set('type', type.trim());
    }

    return this.http.get<Pokemon[]>(`${this.backendUrl}/search`, { params }).pipe(
      map((results) =>
        results.map((p) => ({
          ...p,
          sprite: p.sprite || this.getOfficialArtwork(p.pokedexId || p.id),
        }))
      ),
      catchError((error) => {
        console.warn('Error en búsqueda backend, filtrando con fallback:', error);
        return of([]);
      })
    );
  }

  /**
   * HU-05: Importar Pokémon desde PokéAPI al backend local
   * POST /pokemon
   */
  importPokemon(identifier: string | number): Observable<{ message: string; pokemon: Pokemon }> {
    return this.http.post<{ message: string; pokemon: Pokemon }>(this.backendUrl, {
      pokemon: identifier,
    });
  }

  /**
   * Vista previa directa desde PokéAPI antes de confirmar importación
   */
  peekPokeApi(identifier: string | number): Observable<Pokemon> {
    const cleanId = String(identifier).trim().toLowerCase();
    return this.http.get<any>(`${this.pokeApiUrl}/${cleanId}`).pipe(
      map((raw) => this.mapPokeApiPokemon(raw))
    );
  }

  /**
   * HU-06: Edición de estadísticas y datos
   * PUT /pokemon/:id
   */
  updatePokemon(id: number | string, data: Partial<Pokemon>): Observable<{ message: string; pokemon: Pokemon }> {
    return this.http.put<{ message: string; pokemon: Pokemon }>(`${this.backendUrl}/${id}`, data);
  }

  /**
   * HU-07: Eliminación de Pokémon
   * DELETE /pokemon/:id
   */
  deletePokemon(id: number | string): Observable<{ message: string; id: number; pokedexId: number }> {
    return this.http.delete<{ message: string; id: number; pokedexId: number }>(`${this.backendUrl}/${id}`);
  }

  /**
   * Consulta paginada directa a PokéAPI (fallback)
   */
  private fetchFromPokeApi(page: number, limit: number): Observable<PokemonListResponse> {
    const offset = (page - 1) * limit;
    return this.http.get<any>(`${this.pokeApiUrl}?offset=${offset}&limit=${limit}`).pipe(
      switchMap((res) => {
        const total = 151;
        const totalPages = Math.ceil(total / limit);

        if (!res.results || res.results.length === 0) {
          return of({ data: [], page, limit, total, totalPages });
        }

        const detailRequests: Observable<Pokemon>[] = res.results.map((item: { name: string; url: string }) =>
          this.http.get<any>(item.url).pipe(
            map((raw) => this.mapPokeApiPokemon(raw)),
            catchError(() => of(this.mapBasicPokemon(item, offset)))
          )
        );

        return forkJoin(detailRequests).pipe(
          map((data) => ({
            data,
            page,
            limit,
            total,
            totalPages,
          }))
        );
      })
    );
  }

  /**
   * Consulta directa del detalle a PokéAPI (fallback)
   */
  private fetchDetailFromPokeApi(id: number | string): Observable<Pokemon> {
    return this.http.get<any>(`${this.pokeApiUrl}/${id}`).pipe(
      map((raw) => this.mapPokeApiPokemon(raw))
    );
  }

  /**
   * Mapea el objeto crudo de PokéAPI al formato estandarizado con 6 estadísticas
   */
  private mapPokeApiPokemon(raw: any): Pokemon {
    const pokedexId = raw.id;

    let hp = 45;
    let attack = 49;
    let defense = 49;
    let special_attack = 65;
    let special_defense = 65;
    let speed = 45;

    if (Array.isArray(raw.stats)) {
      for (const s of raw.stats) {
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

    return {
      id: raw.id,
      pokedexId,
      name: raw.name,
      types: raw.types.map((t: any) => t.type.name),
      height: +(raw.height / 10).toFixed(1),
      weight: +(raw.weight / 10).toFixed(1),
      sprite:
        raw.sprites?.other?.['official-artwork']?.front_default ||
        raw.sprites?.other?.home?.front_default ||
        raw.sprites?.front_default ||
        this.getOfficialArtwork(pokedexId),
      abilities: raw.abilities.map((a: any) => a.ability.name),
      hp,
      attack,
      defense,
      special_attack,
      special_defense,
      speed,
    };
  }

  private mapBasicPokemon(item: { name: string; url: string }, fallbackOffset: number): Pokemon {
    const parts = item.url.split('/').filter(Boolean);
    const id = parseInt(parts[parts.length - 1], 10) || fallbackOffset + 1;
    return {
      id,
      pokedexId: id,
      name: item.name,
      types: ['normal'],
      height: 1,
      weight: 10,
      sprite: this.getOfficialArtwork(id),
      abilities: ['desconocida'],
      hp: 50,
      attack: 50,
      defense: 50,
      special_attack: 50,
      special_defense: 50,
      speed: 50,
    };
  }
}
