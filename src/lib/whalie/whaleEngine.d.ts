// Types for whaleEngine.js — a BYTE-IDENTICAL copy of the mobile app's
// src/reader/whaleEngine.js (Immerse repo). Never edit the .js here: change it
// on mobile, then re-copy it and update the sha256 in
// src/lib/__tests__/whaleEngineCopy.test.ts. This file only describes it.

export type WhalePalette = 'paper' | 'sepia' | 'night';

export interface WhalieHandle {
  setPalette(palette: WhalePalette): void;
  setFloor(px: number): void;
  setReduceMotion(reduce: boolean): void;
  setPaused(paused: boolean): void;
  breach(): void;
  destroy(): void;
  _state(): { x: number; facing: 'left' | 'right'; mode: string; lineVisible: boolean; spout: unknown };
}

export interface CreateWhalieOptions {
  palette?: WhalePalette;
  floor?: number;
  reduceMotion?: boolean;
  onLog?: (message: string) => void;
}

export const WHALE_SPRITE: string[];
export const WHALE_PALETTES: Record<WhalePalette, Record<string, string>>;
export function whalePaletteFor(themeKey: string): WhalePalette;
export function newWhalieState(width: number, opts?: Record<string, unknown>): Record<string, unknown>;
export function stepWhalie(state: Record<string, unknown>, dtSeconds: number, width: number): Record<string, unknown>;
export function createWhalie(host: HTMLElement, opts?: CreateWhalieOptions): WhalieHandle;
