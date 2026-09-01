import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  ChaseFriendState,
  ClimbWallLeftState,
  FrameResult,
  HorizontalDirection,
  IPokemonType,
  JumpDownLeftState,
  LandState,
  LieState,
  SitIdleState,
  SwipeState,
  RunRightState,
  WalkLeftState,
  WalkRightState,
  WallHangLeftState,
  resolveState,
  States,
} from '../src/panel/states';

/**
 * Minimal in-memory double for IPokemonType: records positioning calls so
 * state transitions can be asserted without a DOM.
 */
function makePokemon(overrides: Partial<IPokemonType> = {}): IPokemonType {
  const pokemon = {
    left: 50,
    bottom: 0,
    width: 32,
    floor: 0,
    speed: 2,
    isMoving: true,
    hasFriend: false,
    isPlaying: false,
    canSwipe: false,
    canChase: false,
    name: 'testmon',
    emoji: '🐛',
    hello: 'hi',
    friend: undefined,
    positionLeft: (left: number) => {
      pokemon.left = left;
    },
    positionBottom: (bottom: number) => {
      pokemon.bottom = bottom;
    },
    nextFrame: () => undefined,
    swipe: () => undefined,
    getState: () => undefined as never,
    recoverState: () => undefined,
    recoverFriend: () => undefined,
    makeFriendsWith: () => false,
    showSpeechBubble: () => undefined,
    ...overrides,
  };
  return pokemon as unknown as IPokemonType;
}

describe('static states (AbstractStaticState)', () => {
  const cases: Array<[string, () => InstanceType<any>, number]> = [
    ['SitIdleState', () => new SitIdleState(makePokemon()), 50],
    ['LieState', () => new LieState(makePokemon()), 50],
    ['WallHangLeftState', () => new WallHangLeftState(makePokemon()), 50],
    ['LandState', () => new LandState(makePokemon()), 10],
    ['SwipeState', () => new SwipeState(makePokemon()), 15],
  ];

  it.each(cases)('%s continues until holdTime then completes', (_name, make, holdTime) => {
    const state = make();
    for (let i = 0; i < holdTime; i++) {
      expect(state.nextFrame()).toBe(FrameResult.stateContinue);
    }
    expect(state.nextFrame()).toBe(FrameResult.stateComplete);
  });

  it('SwipeState uses the base idle sprite', () => {
    expect(new SwipeState(makePokemon()).spriteLabel).toBe('idle');
  });
});

describe('walk states', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('WalkRightState advances the pokemon right and stops at the boundary', () => {
    // Pin Math.random above the 1% early-stop threshold for determinism
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const pokemon = makePokemon({ left: 0, speed: 10, width: 32 });
    const state = new WalkRightState(pokemon);
    // window.innerWidth * 0.95 boundary; run far beyond it
    let frames = 0;
    let result = state.nextFrame();
    while (result === FrameResult.stateContinue && frames < 10_000) {
      result = state.nextFrame();
      frames++;
    }
    expect(result).toBe(FrameResult.stateComplete);
    expect(pokemon.left).toBeGreaterThanOrEqual(
      Math.floor(window.innerWidth * 0.95) - pokemon.width,
    );
  });

  it('WalkLeftState moves the pokemon left and completes at the left edge', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const pokemon = makePokemon({ left: 100, speed: 25 });
    const state = new WalkLeftState(pokemon);
    let frames = 0;
    while (pokemon.left > 0 && frames < 1_000) {
      state.nextFrame();
      frames++;
    }
    expect(pokemon.left).toBeLessThanOrEqual(0);
    expect(state.nextFrame()).toBe(FrameResult.stateComplete);
  });

  it('run states move faster than walk states per frame', () => {
    const walker = new WalkRightState(makePokemon({ left: 0, speed: 2 }));
    walker.nextFrame();
    const walkDistance = walker.pokemon.left;

    const runner = new RunRightState(makePokemon({ left: 0, speed: 2 }));
    runner.nextFrame();
    const runDistance = runner.pokemon.left;

    expect(runDistance).toBeGreaterThan(walkDistance);
  });

  it('walk direction metadata is exposed', () => {
    expect(new WalkLeftState(makePokemon()).horizontalDirection).toBe(
      HorizontalDirection.left,
    );
    expect(new WalkRightState(makePokemon()).horizontalDirection).toBe(
      HorizontalDirection.right,
    );
  });
});

describe('vertical movement states', () => {
  it('ClimbWallLeftState climbs until bottom reaches 100', () => {
    const pokemon = makePokemon({ bottom: 97 });
    const state = new ClimbWallLeftState(pokemon);
    let frames = 0;
    while (
      state.nextFrame() === FrameResult.stateContinue &&
      frames < 1_000
    ) {
      frames++;
    }
    expect(state.nextFrame()).toBe(FrameResult.stateComplete);
    expect(pokemon.bottom).toBeGreaterThanOrEqual(100);
  });

  it('JumpDownLeftState falls and clamps bottom at the floor', () => {
    const pokemon = makePokemon({ bottom: 8, floor: 3 });
    const state = new JumpDownLeftState(pokemon);
    state.nextFrame(); // 8 -> 3
    expect(state.nextFrame()).toBe(FrameResult.stateComplete);
    expect(pokemon.bottom).toBe(3);
  });
});

describe('chaseFriend state', () => {
  it('ChaseFriendState cancels when there is no friend', () => {
    const state = new ChaseFriendState(makePokemon());
    expect(state.nextFrame()).toBe(FrameResult.stateCancel);
  });
});

describe('resolveState', () => {
  it('resolves every registered state label to its class', () => {
    const labels = [
      States.sitIdle,
      States.walkRight,
      States.walkLeft,
      States.runRight,
      States.runLeft,
      States.lie,
      States.wallHangLeft,
      States.climbWallLeft,
      States.jumpDownLeft,
      States.land,
      States.swipe,
      States.chaseFriend,
      States.standRight,
      States.standLeft,
    ];
    for (const label of labels) {
      const state = resolveState(label, makePokemon());
      expect(state.label.length).toBeGreaterThan(0);
    }
  });

  it('falls back to SitIdleState for unknown labels', () => {
    const state = resolveState('totally-unknown', makePokemon());
    expect(state.spriteLabel).toBe('idle');
  });
});
