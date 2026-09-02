import { POKEMON_DATA } from '../common/pokemon-data';
import {
  PokemonColor,
  PokemonExtraSprite,
  PokemonSize,
  PokemonSpeed,
} from '../common/types';
import { ISequenceTree } from './sequences';
import {
  States,
  IState,
  resolveState,
  PokemonInstanceState,
  isStateAboveGround,
  HorizontalDirection,
  FrameResult,
  IPokemonType,
} from './states';

export class InvalidStateError extends Error {
  fromState: States;
  pokemonType: string;

  constructor(fromState: States, pokemonType: string) {
    super(`Invalid state ${fromState} for pokemon type ${pokemonType}`);
    this.fromState = fromState;
    this.pokemonType = pokemonType;
  }
}

export abstract class BasePokemonType implements IPokemonType {
  label: string = 'base';
  static count: number = 0;
  sequence: ISequenceTree = {
    startingState: States.sitIdle,
    sequenceStates: [],
  };
  static possibleColors: PokemonColor[];
  currentState: IState;
  currentStateEnum: States;
  holdState: IState | undefined;
  holdStateEnum: States | undefined;
  private el: HTMLImageElement;
  private collision: HTMLDivElement;
  private speech: HTMLImageElement;
  private _left: number;
  private _bottom: number;
  pokemonRoot: string;
  _floor: number;
  _friend: IPokemonType | undefined;
  private _name: string;
  private _baseSpeed: number;
  private _size: PokemonSize;
  private _generation: string;
  private _originalSpriteSize: number;
  private spriteBottomPad = 0;
  private spritePadMeasured = false;

  constructor(
    spriteElement: HTMLImageElement,
    collisionElement: HTMLDivElement,
    speechElement: HTMLImageElement,
    size: PokemonSize,
    left: number,
    bottom: number,
    pokemonRoot: string,
    floor: number,
    name: string,
    speed: number,
    generation: string,
    originalSpriteSize: number,
  ) {
    this.el = spriteElement;
    this.collision = collisionElement;
    this.speech = speechElement;
    this.pokemonRoot = pokemonRoot;
    this._floor = floor;
    this._left = left;
    this._bottom = bottom;
    this._originalSpriteSize = originalSpriteSize;
    this.initSprite(size, left, bottom, originalSpriteSize);
    // Once the first sprite image loads, measure its transparent bottom
    // padding and sink the sprite so its feet sit exactly on the floor.
    this.el.addEventListener('load', () => this.measureSpriteBottomPad());
    this.currentStateEnum = this.sequence.startingState;
    this.currentState = resolveState(this.currentStateEnum, this);

    this._name = name;
    this._size = size;
    this._baseSpeed = this.randomizeSpeed(speed);
    this._generation = generation;

    // Increment the static count of the Pokemon class that the constructor belongs to
    (this.constructor as typeof BasePokemonType).count += 1;
  }

  initSprite(
    pokemonSize: PokemonSize,
    left: number,
    bottom: number,
    originalSpriteSize: number,
  ) {
    const spriteSize = this.calculateSpriteWidth(
      pokemonSize,
      originalSpriteSize,
    );

    this.el.style.left = `${left}px`;
    this.el.style.bottom = `${bottom - this.spriteBottomPad}px`;
    this.el.style.width = `${spriteSize}px`;
    this.el.style.height = `${spriteSize}px`;

    // Remove 'auto' since it gave issues with sizing
    this.el.style.maxWidth = 'none';
    this.el.style.maxHeight = 'none';

    this.collision.style.left = `${left}px`;
    this.collision.style.bottom = `${bottom - this.spriteBottomPad}px`;
    this.collision.style.width = `${spriteSize}px`;
    this.collision.style.height = `${spriteSize}px`;

    this.speech.style.left = `${left}px`;
    this.speech.style.bottom = `${
      bottom - this.spriteBottomPad + spriteSize
    }px`;
    this.hideSpeechBubble();
  }

  get left(): number {
    return this._left;
  }

  get bottom(): number {
    return this._bottom;
  }

  private repositionAccompanyingElements() {
    this.collision.style.left = `${this._left}px`;
    this.collision.style.bottom = `${this._bottom - this.spriteBottomPad}px`;
    this.speech.style.left = `${this._left}px`;
    this.speech.style.bottom = `${
      this._bottom -
      this.spriteBottomPad +
      this.calculateSpriteWidth(this._size, this._originalSpriteSize)
    }px`;
  }

  calculateSpriteWidth(size: PokemonSize, originalSpriteSize: number): number {
    switch (size) {
      case PokemonSize.nano:
        return originalSpriteSize;
      case PokemonSize.small:
        return originalSpriteSize * 1.5;
      case PokemonSize.medium:
        return originalSpriteSize * 2;
      case PokemonSize.large:
        return originalSpriteSize * 2.5;
      default:
        return originalSpriteSize;
    }
  }

  positionBottom(bottom: number): void {
    this._bottom = bottom;
    this.el.style.bottom = `${this._bottom - this.spriteBottomPad}px`;
    this.repositionAccompanyingElements();
  }

  private measureSpriteBottomPad(): void {
    if (this.spritePadMeasured) {
      return;
    }
    this.spritePadMeasured = true;

    const w = this.el.naturalWidth;
    const h = this.el.naturalHeight;
    if (!w || !h) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.el, 0, 0, w, h);
    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch {
      return;
    }

    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 30) {
          maxY = y;
        }
      }
    }
    if (maxY < 0) {
      return;
    }

    const naturalPad = h - 1 - maxY;
    if (naturalPad <= 0) {
      return;
    }
    const renderedWidth = this.calculateSpriteWidth(
      this._size,
      this._originalSpriteSize,
    );
    this.spriteBottomPad = naturalPad * (renderedWidth / w);
    this.positionBottom(this._bottom);
  }

  positionLeft(left: number): void {
    // Hard right-edge clamp: never let a sprite leave the visible panel, even
    // after the sidebar is resized narrower while a state is mid-walk.
    // (width is 0 until the sprite image loads — skip the clamp in that case.)
    if (this.width > 0) {
      const maxX = window.innerWidth - this.width;
      if (left > maxX) {
        left = maxX;
      }
    }
    this._left = left;
    this.el.style.left = `${this._left}px`;
    this.repositionAccompanyingElements();
  }

  get width(): number {
    return this.el.width;
  }

  get floor(): number {
    return this._floor;
  }

  get hello(): string {
    // return the sound of the name of the animal
    return ` says hello 👋!`;
  }

  getState(): PokemonInstanceState {
    return { currentStateEnum: this.currentStateEnum };
  }

  get speed(): number {
    const base = this._baseSpeed ?? 0;
    switch (this._size) {
      case PokemonSize.nano:
        return base * 0.5; // much slower for nano
      case PokemonSize.small:
        return base * 0.75; // slower for small
      case PokemonSize.medium:
        return base * 1.0; // baseline
      case PokemonSize.large:
        return base * 1.25; // slightly faster for large
      default:
        return base;
    }
  }

  randomizeSpeed(speed: number): number {
    const min = speed * 0.7;
    const max = speed * 1.3;
    const newSpeed = Math.random() * (max - min) + min;
    return newSpeed;
  }

  get isMoving(): boolean {
    return this._baseSpeed !== PokemonSpeed.still;
  }

  recoverFriend(friend: IPokemonType) {
    // Recover friends..
    this._friend = friend;
  }

  recoverState(state: PokemonInstanceState) {
    // TODO : Resolve a bug where if it was swiping before, it would fail
    // because holdState is no longer valid.
    this.currentStateEnum = state.currentStateEnum ?? States.sitIdle;
    this.currentState = resolveState(this.currentStateEnum, this);

    if (!isStateAboveGround(this.currentStateEnum)) {
      // Reset the bottom of the sprite to the floor as the theme
      // has likely changed.
      this.positionBottom(this.floor);
    }
  }

  get canSwipe() {
    return !isStateAboveGround(this.currentStateEnum);
  }

  get canChase() {
    return !isStateAboveGround(this.currentStateEnum) && this.isMoving;
  }

  showSpeechBubble(duration: number = 3000, friend: boolean = false) {
    // Extract the media folder
    const segments = this.pokemonRoot.split('/');
    const basePath = segments.slice(0, segments.length - 3).join('/');

    if (friend) {
      this.speech.src = `${basePath}/heart.png`;
    } else {
      this.speech.src = `${basePath}/happy.png`;
    }

    this.speech.style.display = 'block';
    setTimeout(() => {
      this.hideSpeechBubble();
    }, duration);
  }

  hideSpeechBubble() {
    this.speech.style.display = 'none';
  }

  swipe() {
    if (this.currentStateEnum === States.swipe) {
      return;
    }
    this.holdState = this.currentState;
    this.holdStateEnum = this.currentStateEnum;
    this.currentStateEnum = States.swipe;
    this.currentState = resolveState(this.currentStateEnum, this);
    this.showSpeechBubble();
  }

  faceLeft() {
    this.el.style.transform = 'scaleX(-1)';
  }

  faceRight() {
    this.el.style.transform = 'scaleX(1)';
  }

  setAnimation(face: string, hasLeftFacingSprite: boolean | undefined) {
    const validFace =
      !hasLeftFacingSprite && face === 'walk_left' ? 'walk' : face;

    if (this.el.src.endsWith(`_${validFace}_8fps.gif`)) {
      return;
    }
    this.el.src = `${this.pokemonRoot}_${validFace}_8fps.gif`;
  }

  chooseNextState(fromState: States): States {
    // Work out next state
    let possibleNextStates: States[] | undefined = undefined;
    for (let i = 0; i < this.sequence.sequenceStates.length; i++) {
      if (this.sequence.sequenceStates[i].state === fromState) {
        possibleNextStates = this.sequence.sequenceStates[i].possibleNextStates;
      }
    }
    if (!possibleNextStates) {
      throw new InvalidStateError(fromState, this.label);
    }
    // randomly choose the next state
    const idx = Math.floor(Math.random() * possibleNextStates.length);
    return possibleNextStates[idx];
  }

  nextFrame() {
    const hasLeftFacingSprite = POKEMON_DATA[
      this.label
    ]?.extraSprites?.includes(PokemonExtraSprite.leftFacing);

    if (!hasLeftFacingSprite) {
      if (this.currentState.horizontalDirection === HorizontalDirection.left) {
        this.faceLeft();
      } else if (
        this.currentState.horizontalDirection === HorizontalDirection.right
      ) {
        this.faceRight();
      }
    } else {
      this.faceRight();
    }
    this.setAnimation(this.currentState.spriteLabel, hasLeftFacingSprite);

    // What's my buddy doing?
    if (
      this.hasFriend &&
      this.currentStateEnum !== States.chaseFriend &&
      this.isMoving
    ) {
      if (
        this.friend?.isPlaying &&
        !isStateAboveGround(this.currentStateEnum)
      ) {
        this.currentState = resolveState(States.chaseFriend, this);
        this.currentStateEnum = States.chaseFriend;
        return;
      }
    }

    const frameResult = this.currentState.nextFrame();
    if (frameResult === FrameResult.stateComplete) {
      // If recovering from swipe..
      if (this.holdState && this.holdStateEnum) {
        this.currentState = this.holdState;
        this.currentStateEnum = this.holdStateEnum;
        this.holdState = undefined;
        this.holdStateEnum = undefined;
        return;
      }

      const nextState = this.chooseNextState(this.currentStateEnum);
      this.currentState = resolveState(nextState, this);
      this.currentStateEnum = nextState;
    } else if (frameResult === FrameResult.stateCancel) {
      // Friend stopped playing - settle back to the starting idle state.
      // (SitIdle is in every sequence, so this avoids InvalidStateError.)
      if (this.currentStateEnum === States.chaseFriend) {
        this.currentState = resolveState(States.sitIdle, this);
        this.currentStateEnum = States.sitIdle;
      }
    }
  }

  get hasFriend(): boolean {
    return this._friend !== undefined;
  }

  get friend(): IPokemonType | undefined {
    return this._friend;
  }

  get name(): string {
    return this._name;
  }

  makeFriendsWith(friend: IPokemonType): boolean {
    this._friend = friend;
    console.log(this.name, ": I'm now friends ❤️ with ", friend.name);
    return true;
  }

  get isPlaying(): boolean {
    return (
      this.isMoving &&
      (this.currentStateEnum === States.runRight ||
        this.currentStateEnum === States.runLeft)
    );
  }

  get emoji(): string {
    return '🐶';
  }
}
