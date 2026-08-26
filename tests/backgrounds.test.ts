import { describe, expect, it } from 'vitest';

import {
  ALL_SCALES,
  ALL_THEMES,
  ColorThemeKind,
  PokemonSize,
  THEMES_WITH_MIDGROUND,
  Theme,
} from '../src/common/types';
import { calculateFloor, resolveSceneVariant } from '../src/panel/main';

describe('Background Beauty — floor heights', () => {
  it('every scene theme defines a floor for every pokemon size', () => {
    const scenes = ALL_THEMES.filter((t) => t !== Theme.none);
    for (const theme of scenes) {
      for (const size of ALL_SCALES) {
        expect(
          calculateFloor(size, theme),
          `${theme}/${size} has no floor height`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('the none theme keeps pokemon on the panel bottom', () => {
    for (const size of ALL_SCALES) {
      expect(calculateFloor(size, Theme.none)).toBe(0);
    }
  });

  it('floors grow monotonically with sprite size', () => {
    for (const theme of ALL_THEMES) {
      const floors = ALL_SCALES.map((s) => calculateFloor(s, theme));
      const sorted = [...floors].sort((a, b) => a - b);
      expect(floors).toEqual(sorted);
    }
  });
});

describe('Background Beauty — scene variant resolution', () => {
  it('follows the VS Code color theme when day/night cycle is off', () => {
    expect(resolveSceneVariant(ColorThemeKind.dark, false)).toBe('dark');
    expect(resolveSceneVariant(ColorThemeKind.light, false)).toBe('light');
    expect(resolveSceneVariant(ColorThemeKind.highContrast, false)).toBe(
      'light',
    );
  });

  it('day/night cycle picks dark at night and light by day', () => {
    expect(resolveSceneVariant(ColorThemeKind.light, true, 23)).toBe('dark');
    expect(resolveSceneVariant(ColorThemeKind.light, true, 2)).toBe('dark');
    expect(resolveSceneVariant(ColorThemeKind.light, true, 6)).toBe('light');
    expect(resolveSceneVariant(ColorThemeKind.light, true, 12)).toBe('light');
    expect(resolveSceneVariant(ColorThemeKind.light, true, 19)).toBe('dark');
  });

  it('day/night cycle overrides the color theme kind', () => {
    // 3 AM: dark even if VS Code is in a light theme
    expect(resolveSceneVariant(ColorThemeKind.light, true, 3)).toBe('dark');
    // Noon: light even if VS Code is in a dark theme
    expect(resolveSceneVariant(ColorThemeKind.dark, true, 12)).toBe('light');
  });
});

describe('Background Beauty — theme registry', () => {
  it('declares the two new generated scenes', () => {
    expect(ALL_THEMES).toContain(Theme.volcano);
    expect(ALL_THEMES).toContain(Theme.snow);
  });

  it('keeps none out of the parallax midground list', () => {
    expect(THEMES_WITH_MIDGROUND).not.toContain(Theme.none);
    for (const t of THEMES_WITH_MIDGROUND) {
      expect(ALL_THEMES).toContain(t);
    }
  });
});
