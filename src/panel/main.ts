import { randomName } from '../common/names';
import {
  PokemonSize,
  PokemonColor,
  PokemonType,
  Theme,
  ColorThemeKind,
  WebviewMessage,
} from '../common/types';
import { IPokemonType } from './states';
import {
  createPokemon,
  PokemonCollection,
  PokemonElement,
  IPokemonCollection,
  availableColors,
  InvalidPokemonException,
} from './pokemon-collection';
import { PokemonElementState, PokemonPanelState } from './states';
import { getRandomPokemonConfig } from '../common/pokemon-data';

/* This is how the VS Code API can be invoked from the panel */
declare global {
  interface VscodeStateApi {
    getState(): PokemonPanelState | undefined; // API is actually Any, but we want it to be typed.
    setState(state: PokemonPanelState): void;
    postMessage(message: WebviewMessage): void;
  }
  function acquireVsCodeApi(): VscodeStateApi;
}

export interface PokemonPanelOptions {
  debug?: boolean;
  maxPokemon?: number;
  motion?: 'system' | 'always' | 'reduced';
}

const TICK_MS = 100;
const FRIEND_SCAN_TICKS = 5; // run the O(n²) friend scan every 5th tick
const POSITION_SAVE_MS = 30_000; // safety-net persistence cadence

export const allPokemon: IPokemonCollection = new PokemonCollection();
let pokemonCounter: number;

/* ------------------------------------------------------------------ */
/* Debug logging (Item 5)                                              */
/* ------------------------------------------------------------------ */
let debugEnabled = false;

function log(...args: unknown[]): void {
  if (debugEnabled) {
    console.log('[vscode-pokemon]', ...args);
  }
}

/* ------------------------------------------------------------------ */
/* Single global animation loop (Items 1–4)                            */
/*                                                                     */
/* One timer advances every Pokémon. Timers are never created per      */
/* Pokémon, so removing a Pokémon cannot leak an interval, and         */
/* pause/resume just clears/creates the single handle.                 */
/* ------------------------------------------------------------------ */
let loopTimer: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;
let lastPositionSave = 0;
let motionReduced = false;
let activeStateApi: VscodeStateApi | undefined;

function prefersReducedMotion(setting: PokemonPanelOptions['motion']): boolean {
  if (setting === 'reduced') {
    return true;
  }
  if (setting === 'always') {
    return false;
  }
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function ensureAnimationLoop(stateApi?: VscodeStateApi): void {
  if (stateApi) {
    activeStateApi = stateApi;
  }
  if (loopTimer !== null || motionReduced || !activeStateApi) {
    return;
  }
  tickCount = 0;
  lastPositionSave = Date.now();
  loopTimer = setInterval(() => {
    tickCount++;
    // Advance every Pokémon exactly once per tick (Item 1)
    allPokemon.pokemonCollection.forEach((element) => {
      element.pokemon.nextFrame();
    });
    // Friend matching does not need 10 Hz resolution (Item 1, step 4)
    if (tickCount % FRIEND_SCAN_TICKS === 0) {
      allPokemon.seekNewFriends().forEach((message) => {
        activeStateApi?.postMessage({
          text: message,
          command: 'info',
        });
      });
    }
    // Low-frequency safety net so positions survive reloads (Item 3)
    if (Date.now() - lastPositionSave >= POSITION_SAVE_MS) {
      lastPositionSave = Date.now();
      saveState(activeStateApi);
    }
  }, TICK_MS);
}

function pauseAnimationLoop(): void {
  if (loopTimer !== null) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

function stopAnimationLoop(): void {
  pauseAnimationLoop();
  activeStateApi = undefined;
}

window.addEventListener('unload', stopAnimationLoop);

function normalizePokemonCounter(counter: number | undefined): number {
  if (counter === undefined || Number.isNaN(counter)) {
    return 0;
  }

  return Math.max(0, counter);
}

/* ------------------------------------------------------------------ */
/* Floor heights per theme/size (Item 12.3)                            */
/* ------------------------------------------------------------------ */
const FLOOR_HEIGHTS: Record<Theme, Partial<Record<PokemonSize, number>>> = {
  [Theme.none]: {},
  [Theme.forest]: {
    [PokemonSize.nano]: 23,
    [PokemonSize.small]: 30,
    [PokemonSize.medium]: 40,
    [PokemonSize.large]: 65,
  },
  [Theme.castle]: {
    [PokemonSize.nano]: 45,
    [PokemonSize.small]: 60,
    [PokemonSize.medium]: 80,
    [PokemonSize.large]: 120,
  },
  [Theme.beach]: {
    [PokemonSize.nano]: 45,
    [PokemonSize.small]: 60,
    [PokemonSize.medium]: 80,
    [PokemonSize.large]: 120,
  },
};

function calculateFloor(size: PokemonSize, theme: Theme): number {
  return FLOOR_HEIGHTS[theme]?.[size] ?? 0;
}

function addPokemonToPanel(
  pokemonType: PokemonType,
  basePokemonUri: string,
  gen: string,
  originalSpriteSize: number,
  pokemonColor: PokemonColor,
  pokemonSize: PokemonSize,
  left: number,
  bottom: number,
  floor: number,
  name: string,
  stateApi?: VscodeStateApi,
  incrementCounter: boolean = true,
): PokemonElement {
  const pokemonSpriteElement: HTMLImageElement = document.createElement('img');
  pokemonSpriteElement.className = 'pokemon';
  (document.getElementById('pokemonContainer') as HTMLDivElement).appendChild(
    pokemonSpriteElement,
  );

  const collisionElement: HTMLDivElement = document.createElement('div');
  collisionElement.className = 'collision';
  (document.getElementById('pokemonContainer') as HTMLDivElement).appendChild(
    collisionElement,
  );

  const speechBubbleElement: HTMLImageElement = document.createElement('img');
  speechBubbleElement.className = `bubble bubble-${pokemonSize} b-${originalSpriteSize}`;
  speechBubbleElement.src = `${basePokemonUri}/heart.png`;
  (document.getElementById('pokemonContainer') as HTMLDivElement).appendChild(
    speechBubbleElement,
  );

  const root = `${basePokemonUri}/${gen}/${pokemonType}/${pokemonColor}`;
  log('Creating new pokemon : ', pokemonType, root, pokemonColor, pokemonSize, name);
  let newPokemon: IPokemonType;
  try {
    if (!availableColors(pokemonType).includes(pokemonColor)) {
      throw new InvalidPokemonException('Invalid color for pokemon type');
    }
    newPokemon = createPokemon(
      pokemonType,
      pokemonSpriteElement,
      collisionElement,
      speechBubbleElement,
      pokemonSize,
      left,
      bottom,
      root,
      floor,
      name,
      gen,
      originalSpriteSize,
    );
    if (incrementCounter) {
      pokemonCounter++;
    }

    // Hover-to-swipe bound to this specific Pokémon (Item 7) — no O(n) scan.
    collisionElement.addEventListener('mouseover', () => {
      if (!newPokemon.canSwipe) {
        return;
      }
      newPokemon.swipe();
    });
  } catch (e: unknown) {
    // Remove elements
    pokemonSpriteElement.remove();
    collisionElement.remove();
    speechBubbleElement.remove();
    throw e;
  }

  pokemonSpriteElement.style.opacity = '0';

  const pokeballEl = document.createElement('div');
  pokeballEl.classList.add('pokeball-sprite');

  // Position pokeball at pokemon location + pokemon center offset
  pokeballEl.style.left = `${left}px`;
  pokeballEl.style.bottom = `${bottom}px`;

  (document.getElementById('pokemonContainer') as HTMLDivElement).appendChild(
    pokeballEl,
  );

  pokeballEl.offsetHeight;
  pokeballEl.classList.add('pokeball-open');

  // show pokemon earlier while pokeball animation is still running
  const computed = window.getComputedStyle(pokeballEl);
  const durationStr = (computed.animationDuration || '0s').split(',')[0].trim();
  const durationMs = durationStr.endsWith('ms')
    ? parseFloat(durationStr)
    : parseFloat(durationStr) * 1000;

  const spawnRatio = 0.7;
  const spawnDelay = Math.max(0, durationMs * spawnRatio);

  let spawned = false;
  const showPokemon = () => {
    if (spawned) {
      return;
    }
    spawned = true;
    pokemonSpriteElement.classList.add('spawn-pop');
    pokemonSpriteElement.style.opacity = '1';

    if (pokemonColor === PokemonColor.shiny) {
      const shinyOverlay = document.createElement('img');
      // No cache-busting query param — let the browser reuse the cached asset (Item 6)
      shinyOverlay.src = `${basePokemonUri}/shiny-anim.gif`;
      shinyOverlay.className = 'shiny-overlay';
      shinyOverlay.style.left = pokemonSpriteElement.style.left;
      shinyOverlay.style.bottom = pokemonSpriteElement.style.bottom;
      shinyOverlay.style.width = pokemonSpriteElement.style.width;
      shinyOverlay.style.height = pokemonSpriteElement.style.height;
      (
        document.getElementById('pokemonContainer') as HTMLDivElement
      ).appendChild(shinyOverlay);
      const removeOverlay = () => shinyOverlay.remove();
      shinyOverlay.addEventListener('animationend', removeOverlay);
      setTimeout(removeOverlay, 1500);
    }

    saveState(stateApi);
  };

  const spawnTimeout = setTimeout(showPokemon, spawnDelay);

  pokeballEl.addEventListener('animationend', (e) => {
    if (e.animationName !== 'pokeball-open') {
      return;
    }
    pokeballEl.remove();
    clearTimeout(spawnTimeout);
    showPokemon();
  });

  return new PokemonElement(
    pokemonSpriteElement,
    collisionElement,
    speechBubbleElement,
    newPokemon,
    pokemonColor,
    pokemonType,
    gen,
    originalSpriteSize,
  );
}

function removePokemonFromPanel(
  message: { name: string },
  stateApi?: VscodeStateApi,
) {
  if (!stateApi) {
    stateApi = acquireVsCodeApi();
  }
  // Remove elements
  const pokemon = allPokemon.locate(message.name);

  if (!pokemon) {
    stateApi?.postMessage({
      command: 'error',
      text: `Could not find pokemon ${message.name}`,
    });
    return;
  }

  log('Removing pokemon ', message.name);

  // Remove from collection immediately so rapid deletes of Pokemon don't interfere with each other
  allPokemon.removeFromCollection(message.name);
  pokemon.collision.remove();
  pokemon.speech.remove();
  pokemonCounter = normalizePokemonCounter(pokemonCounter - 1);
  saveState(stateApi);

  stateApi?.postMessage({
    command: 'info',
    text: '👋 Removed pokemon ' + message.name,
  });

  // pokemon fade out
  pokemon.el.classList.add('fade-out');

  const pokeballEl = document.createElement('div');
  pokeballEl.classList.add('pokeball-sprite');

  pokeballEl.style.left = `${pokemon.pokemon.left}px`;
  pokeballEl.style.bottom = `${pokemon.pokemon.bottom}px`;

  const container = document.getElementById(
    'pokemonContainer',
  ) as HTMLDivElement;
  container.appendChild(pokeballEl);

  pokeballEl.offsetHeight;
  pokeballEl.classList.add('pokeball-close');

  pokemon.el.addEventListener(
    'animationend',
    (e) => {
      if (e.animationName !== 'pokemon-fade-out') {
        return;
      }
      pokemon.el.remove();
    },
    { once: true },
  );

  pokeballEl.addEventListener(
    'animationend',
    (e) => {
      if (e.animationName !== 'pokeball-close') {
        return;
      }
      pokeballEl.remove();
    },
    { once: true },
  );
}

export function saveState(stateApi?: VscodeStateApi) {
  if (!stateApi) {
    stateApi = acquireVsCodeApi();
  }
  const state = new PokemonPanelState();
  state.pokemonStates = [];

  allPokemon.pokemonCollection.forEach((pokemonItem) => {
    state.pokemonStates?.push({
      pokemonName: pokemonItem.pokemon.name,
      pokemonColor: pokemonItem.color,
      pokemonType: pokemonItem.type,
      pokemonState: pokemonItem.pokemon.getState(),
      pokemonGeneration: pokemonItem.generation,
      originalSpriteSize: pokemonItem.originalSpriteSize,
      pokemonFriend: pokemonItem.pokemon.friend?.name ?? undefined,
      elLeft: pokemonItem.el.style.left,
      elBottom: pokemonItem.el.style.bottom,
    });
  });
  state.pokemonCounter = normalizePokemonCounter(pokemonCounter);
  stateApi?.setState(state);
}

function recoverState(
  basePokemonUri: string,
  gen: string,
  pokemonSize: PokemonSize,
  floor: number,
  stateApi?: VscodeStateApi,
) {
  if (!stateApi) {
    stateApi = acquireVsCodeApi();
  }
  const state = stateApi?.getState();
  if (!state) {
    pokemonCounter = 0;
  } else {
    pokemonCounter = normalizePokemonCounter(state.pokemonCounter);
  }

  const recoveryMap: Map<IPokemonType, PokemonElementState> = new Map();
  log('recoverState: saved pokemon count =', state?.pokemonStates?.length ?? 0);
  state?.pokemonStates?.forEach((p) => {
    try {
      const newPokemon = addPokemonToPanel(
        p.pokemonType ?? 'bulbasaur',
        basePokemonUri,
        p.pokemonGeneration ?? 'gen1',
        p.originalSpriteSize ?? 32,
        p.pokemonColor ?? PokemonColor.default,
        pokemonSize,
        parseInt(p.elLeft ?? '0', 10),
        parseInt(p.elBottom ?? '0', 10),
        floor,
        p.pokemonName ?? randomName(),
        stateApi,
        false,
      );
      allPokemon.push(newPokemon);
      recoveryMap.set(newPokemon.pokemon, p);
    } catch (InvalidPokemonException) {
      log('State had invalid pokemon (' + p.pokemonType + '), discarding.');
    }
  });
  recoveryMap.forEach((state, pokemon) => {
    // Recover previous state.
    if (state.pokemonState !== undefined) {
      pokemon.recoverState(state.pokemonState);
    }

    // Resolve friend relationships
    if (state.pokemonFriend) {
      const friend = allPokemon.locate(state.pokemonFriend);
      if (friend) {
        pokemon.recoverFriend(friend.pokemon);
      }
    }
  });
}

function randomStartPosition(): number {
  return Math.floor(Math.random() * (window.innerWidth * 0.7));
}

let canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D;

function initCanvas() {
  canvas = document.getElementById('pokemonCanvas') as HTMLCanvasElement;
  if (!canvas) {
    log('Canvas not ready');
    return;
  }
  ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (!ctx) {
    log('Canvas context not ready');
    return;
  }
  ctx.canvas.width = window.innerWidth;
  ctx.canvas.height = window.innerHeight;
}

// It cannot access the main VS Code APIs directly.
export function pokemonPanelApp(
  basePokemonUri: string,
  theme: Theme,
  themeKind: ColorThemeKind,
  pokemonColor: PokemonColor,
  pokemonSize: PokemonSize,
  pokemonType: PokemonType,
  throwBallWithMouse: boolean,
  gen: string,
  originalSpriteSize: number,
  options: PokemonPanelOptions = {},
  stateApi?: VscodeStateApi,
) {
  let floor = 0;
  if (!stateApi) {
    stateApi = acquireVsCodeApi();
  }
  debugEnabled = options.debug === true;
  const maxPokemon =
    options.maxPokemon !== undefined && options.maxPokemon > 0
      ? Math.floor(options.maxPokemon)
      : 6;
  motionReduced = prefersReducedMotion(options.motion);

  // Apply Theme backgrounds
  const foregroundEl = document.getElementById('foreground');
  if (theme !== Theme.none) {
    let _themeKind = '';
    switch (themeKind) {
      case ColorThemeKind.dark:
        _themeKind = 'dark';
        break;
      case ColorThemeKind.light:
        _themeKind = 'light';
        break;
      case ColorThemeKind.highContrast:
      default:
        _themeKind = 'light';
        break;
    }

    document.body.style.backgroundImage = `url('${basePokemonUri}/backgrounds/${theme}/background-${_themeKind}-${pokemonSize}.png')`;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    foregroundEl!.style.backgroundImage = `url('${basePokemonUri}/backgrounds/${theme}/foreground-${_themeKind}-${pokemonSize}.png')`;

    floor = calculateFloor(pokemonSize, theme); // Themes have pokemonCollection at a specified height from the ground
  } else {
    document.body.style.backgroundImage = '';
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    foregroundEl!.style.backgroundImage = '';
  }

  log(
    'Starting pokemon session',
    pokemonColor,
    basePokemonUri,
    pokemonType,
    throwBallWithMouse,
    { maxPokemon, motionReduced },
  );

  const partyIsFull = (): boolean =>
    allPokemon.pokemonCollection.length >= maxPokemon;

  // New session
  const state = stateApi?.getState();

  const hasRecoverableState =
    state !== undefined &&
    Array.isArray(state.pokemonStates) &&
    state.pokemonStates.length > 0;

  if (hasRecoverableState) {
    log('Recovering state - ', state);
    recoverState(basePokemonUri, gen, pokemonSize, floor, stateApi);
  } else {
    log('No recoverable pokemon state, starting an empty session.');
    pokemonCounter = normalizePokemonCounter(state?.pokemonCounter);
    saveState(stateApi);
  }

  initCanvas();

  // React live to OS-level reduced-motion preference changes (Item 11)
  if (options.motion !== 'reduced' && options.motion !== 'always') {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (e: MediaQueryListEvent) => {
      motionReduced = e.matches;
      if (motionReduced) {
        saveState(stateApi);
        pauseAnimationLoop();
      } else {
        ensureAnimationLoop(stateApi);
      }
    };
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMotionChange);
    }
  }

  // Handle messages sent from the extension to the webview
  window.addEventListener('message', (event): void => {
    const message = event.data; // The json data that the extension sent
    switch (message.command) {
      case 'spawn-pokemon': {
        if (partyIsFull()) {
          stateApi?.postMessage({
            command: 'info',
            text: `Party is full (${maxPokemon}) — recall a Pokémon first.`,
          });
          break;
        }
        log('adding pokemon to panel from message', message);
        allPokemon.push(
          addPokemonToPanel(
            message.type,
            basePokemonUri,
            message.generation,
            message.originalSpriteSize,
            message.color,
            pokemonSize,
            randomStartPosition(),
            floor,
            floor,
            message.name ?? randomName(),
            stateApi,
          ),
        );
        saveState(stateApi);
        break;
      }

      case 'spawn-random-pokemon': {
        if (partyIsFull()) {
          stateApi?.postMessage({
            command: 'info',
            text: `Party is full (${maxPokemon}) — recall a Pokémon first.`,
          });
          break;
        }
        const [randomPokemonType, randomPokemonConfig] =
          getRandomPokemonConfig();
        log('adding random pokemon to panel from message');
        allPokemon.push(
          addPokemonToPanel(
            randomPokemonType,
            basePokemonUri,
            randomPokemonConfig.generation.toString(),
            randomPokemonConfig.originalSpriteSize ?? 32,
            PokemonColor.default,
            pokemonSize,
            randomStartPosition(),
            floor,
            floor,
            randomName(),
            stateApi,
          ),
        );
        saveState(stateApi);
        break;
      }

      case 'list-pokemon': {
        const pokemonCollection = allPokemon.pokemonCollection;
        stateApi?.postMessage({
          command: 'list-pokemon',
          text: pokemonCollection
            .map(
              (pokemon) =>
                `${pokemon.type},${pokemon.pokemon.name},${pokemon.color}`,
            )
            .join('\n'),
        });
        break;
      }

      case 'roll-call': {
        // go through every single pokemon and then print out their name
        allPokemon.pokemonCollection.forEach((pokemon) => {
          stateApi?.postMessage({
            command: 'info',
            text: `${pokemon.pokemon.emoji} ${pokemon.pokemon.name} (${pokemon.color} ${pokemon.type}): ${pokemon.pokemon.hello}`,
          });
        });
        break;
      }

      case 'delete-pokemon':
        removePokemonFromPanel(message, stateApi);
        break;

      case 'reset-pokemon': {
        const pokemonToRemove = [...allPokemon.pokemonCollection];
        pokemonToRemove.forEach((pokemon) => {
          removePokemonFromPanel({ name: pokemon.pokemon.name }, stateApi);
        });
        // Wait for animations to complete before resetting
        setTimeout(() => {
          allPokemon.reset();
          pokemonCounter = 0;
          saveState(stateApi);
        }, 500);
        break;
      }

      // Real pause/resume driven by panel visibility (Item 4).
      // Replaces the old handler that incorrectly set pokemonCounter = 1.
      case 'pause-pokemon':
        saveState(stateApi);
        pauseAnimationLoop();
        break;

      case 'resume-pokemon':
        ensureAnimationLoop(stateApi);
        break;
    }
  });

  // Start the single shared animation loop once, after recovery (Item 1)
  ensureAnimationLoop(stateApi);
}

window.addEventListener('resize', function () {
  initCanvas();
});
