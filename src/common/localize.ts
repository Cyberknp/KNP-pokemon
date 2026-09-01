import { POKEMON_DATA } from './pokemon-data';
import { PokemonType } from './types';

/**
 * Gets the English name of a Pokemon.
 *
 * The extension uses English as its primary language, so no translation
 * lookup layer is required.
 *
 * @param pokemonType The Pokemon type (e.g., 'pikachu', 'charizard')
 * @returns The English name, or the type key if not found
 */
export function getLocalizedPokemonName(pokemonType: PokemonType): string {
  return POKEMON_DATA[pokemonType]?.name || pokemonType;
}
