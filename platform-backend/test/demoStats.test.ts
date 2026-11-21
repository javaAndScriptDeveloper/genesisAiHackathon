import { describe, expect, it } from "vitest";
import { baselineFor, generateDailyStats } from "../src/demoStats.js";

const users = Array.from({ length: 50 }, (_, i) => i + 1);
const dates = Array.from({ length: 10 }, (_, i) => `2026-11-${String(i + 10).padStart(2, "0")}`);
const grid = users.flatMap((u) => dates.map((d) => [u, d] as const));

describe("demo statistics", () => {
  it("same user and date give the same stats", () => {
    expect(generateDailyStats(7, "2026-11-21", "normal")).toEqual(generateDailyStats(7, "2026-11-21", "normal"));
  });

  it("normal readiness is always >= 60", () => {
    for (const [u, d] of grid) expect(generateDailyStats(u, d, "normal").readiness).toBeGreaterThanOrEqual(60);
  });

  it("tired readiness is 40..59", () => {
    for (const [u, d] of grid) {
      const r = generateDailyStats(u, d, "tired").readiness;
      expect(r).toBeGreaterThanOrEqual(40);
      expect(r).toBeLessThanOrEqual(59);
    }
  });

  it("bad-night readiness is < 40", () => {
    for (const [u, d] of grid) expect(generateDailyStats(u, d, "bad-night").readiness).toBeLessThan(40);
  });

  it("bad-night sleep is 4..5 h and resting HR is 8..12 above baseline", () => {
    for (const [u, d] of grid) {
      const s = generateDailyStats(u, d, "bad-night");
      const b = baselineFor(u);
      expect(s.sleepHours).toBeGreaterThanOrEqual(4);
      expect(s.sleepHours).toBeLessThanOrEqual(5);
      expect(s.restingHr - b.restingHr).toBeGreaterThanOrEqual(8);
      expect(s.restingHr - b.restingHr).toBeLessThanOrEqual(12);
      expect(s.source).toBe("demo");
    }
  });
});
