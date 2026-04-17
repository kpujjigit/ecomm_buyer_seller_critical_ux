// Seedable PRNG so simulator runs can be reproduced. Tiny Mulberry32 — fine
// for demo volumes, not for anything cryptographic.
export type Rng = () => number;

export function makeRng(seed?: string): Rng {
  let s = seed ? hashString(seed) : (Math.random() * 2 ** 32) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)]!;

export const randInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

export const randFloat = (rng: Rng, min: number, max: number): number =>
  rng() * (max - min) + min;

export const chance = (rng: Rng, pct: number): boolean => rng() < pct;

// sha256-ish opaque hash for user/listing/search IDs. Not real sha256 — just
// looks like one in the dashboard.
export const opaqueId = (rng: Rng, prefix = ''): string => {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 24; i++) out += hex[Math.floor(rng() * 16)];
  return `${prefix}${out}`;
};
