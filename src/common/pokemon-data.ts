/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
// Index of the per-generation Pokémon registry slices (Improvement Item 9).
//
// The ~5,200-line monolithic dataset was split into `pokemon-gen1.ts` …
// `pokemon-gen5.ts`. This file re-assembles them and preserves the exact
// public API consumed by the extension host and the webview, so no call
// sites needed to change. Bundlers can later code-split the generation
// modules behind dynamic imports without touching call sites again.
import {
  PokemonConfig,
  PokemonGeneration,
  PokemonType,
} from './types';
import { GEN1_POKEMON } from './pokemon-gen1';
import { GEN2_POKEMON } from './pokemon-gen2';
import { GEN3_POKEMON } from './pokemon-gen3';
import { GEN4_POKEMON } from './pokemon-gen4';
import { GEN5_POKEMON } from './pokemon-gen5';

export type PokemonTypeString = string & keyof typeof POKEMON_DATA_RAW;

const POKEMON_DATA_RAW: Record<string, PokemonConfig> = {
  ...GEN1_POKEMON,
  ...GEN2_POKEMON,
  ...GEN3_POKEMON,
  ...GEN4_POKEMON,
  ...GEN5_POKEMON,
};

export const POKEMON_DATA: Record<PokemonType, PokemonConfig> =
  Object.fromEntries(
    Object.entries(POKEMON_DATA_RAW).filter(
      ([, config]) => config.possibleColors.length > 0,
    ),
  ) as Record<PokemonType, PokemonConfig>;

export function getAllPokemon(): PokemonType[] {
  return Object.keys(POKEMON_DATA) as PokemonType[];
}

export function getPokemonByGeneration(
  generation: PokemonGeneration,
): PokemonType[] {
  return Object.entries(POKEMON_DATA)
    .filter(([, config]) => config.generation === generation)
    .map(([key]) => key as PokemonType);
}

export function getDefaultPokemon(): PokemonType {
  return 'bulbasaur';
}

/**
 * Returns a random Pokemon config from a given pool.
 * @param types The keys to choose from.
 * @returns A random Pokemon config from the given pool.
 */
export function getRandomPokemonConfigFrom(
  types: PokemonType[],
): [PokemonType, PokemonConfig] {
  const randomType = types[Math.floor(Math.random() * types.length)];
  return [randomType, POKEMON_DATA[randomType]];
}

export function getRandomPokemonConfig(): [PokemonType, PokemonConfig] {
  const keys = Object.keys(POKEMON_DATA);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return [randomKey as PokemonType, POKEMON_DATA[randomKey]];
}
