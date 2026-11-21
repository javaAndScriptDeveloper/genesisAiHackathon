export type Scenario = "normal" | "tired" | "bad-night";

export interface DailyStats {
  date: string;
  sleepHours: number;
  sleepScore: number;
  restingHr: number;
  hrvMs: number;
  steps: number;
  activeKcal: number;
  readiness: number;
  source: "demo";
  scenario: Scenario;
}

export interface Baseline {
  restingHr: number;
  hrvMs: number;
  sleepHours: number;
  steps: number;
}

// Same algorithm as frontend/lib/fit/dates.ts (the backend cannot import the frontend).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit.
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const between = (r: number, lo: number, hi: number) => lo + r * (hi - lo);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function baselineFor(userId: number): Baseline {
  const rand = mulberry32(hash(`baseline:${userId}`));
  return {
    restingHr: Math.round(between(rand(), 52, 68)),
    hrvMs: Math.round(between(rand(), 45, 85)),
    sleepHours: round1(between(rand(), 6.5, 8.0)),
    steps: Math.round(between(rand(), 5000, 11000)),
  };
}

export function readinessOf(s: Pick<DailyStats, "sleepHours" | "restingHr" | "hrvMs">, b: Baseline): number {
  const sleepPart = clamp((s.sleepHours - 4) / 4, 0, 1) * 40;
  const rhrPart = clamp(1 - (s.restingHr - b.restingHr) / 12, 0, 1) * 30;
  const hrvPart = (clamp(s.hrvMs / b.hrvMs, 0, 1.2) / 1.2) * 30;
  return Math.round(sleepPart + rhrPart + hrvPart);
}

export function generateDailyStats(userId: number, date: string, scenario: Scenario): DailyStats {
  const b = baselineFor(userId);
  const rand = mulberry32(hash(`${userId}:${date}`));
  let sleep: number, hr: number, hrvMul: number, stepsMul: number;
  if (scenario === "normal") {
    sleep = b.sleepHours + between(rand(), -0.6, 0.6);
    hr = b.restingHr + between(rand(), -3, 3);
    hrvMul = between(rand(), 0.9, 1.1);
    stepsMul = between(rand(), 0.75, 1.25);
  } else if (scenario === "tired") {
    sleep = between(rand(), 5.0, 5.7);
    hr = b.restingHr + between(rand(), 4, 6);
    hrvMul = between(rand(), 0.75, 0.85);
    stepsMul = between(rand(), 0.6, 0.8);
  } else {
    sleep = between(rand(), 4.0, 5.0);
    hr = b.restingHr + between(rand(), 8, 12);
    hrvMul = between(rand(), 0.6, 0.7);
    stepsMul = between(rand(), 0.4, 0.6);
  }
  const sleepHours = round1(sleep);
  const restingHr = Math.round(hr);
  const hrvMs = Math.round(b.hrvMs * hrvMul);
  const steps = Math.round(b.steps * stepsMul);
  return {
    date,
    sleepHours,
    sleepScore: Math.round(clamp(sleepHours / 8, 0, 1) * 100),
    restingHr,
    hrvMs,
    steps,
    activeKcal: Math.round(steps * 0.045),
    readiness: readinessOf({ sleepHours, restingHr, hrvMs }, b),
    source: "demo",
    scenario,
  };
}
