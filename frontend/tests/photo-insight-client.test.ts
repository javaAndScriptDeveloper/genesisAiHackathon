import { describe, expect, it } from "vitest";
import { errorFromStatus, mockAllowed, parsePhotoInsightResponse } from "@/lib/api/photoInsight";
import { buildContext, defaultPair, gating, orderPair, toInsight } from "@/lib/fit/photoInsight";
import { emptyState } from "@/lib/fit/seed";
import { reducer } from "@/lib/fit/store/reducer";
import { photoInsightRequestSchema } from "@/lib/ai/photoInsight";
import { SAFE_TEXT_RE, sanitizeRecordText } from "@/lib/fit/safeText";
import type { PhotoCheckIn } from "@/lib/fit/types";
import type { PersonalRecord } from "@/lib/progress/records";

const ph = (id: string, date: string, weightKg?: number): PhotoCheckIn => ({ id, date, dataUrl: "data:image/jpeg;base64,AAAA", ...(weightKg !== undefined ? { weightKg } : {}) });
const rec = (date: string, exerciseId = "squat", value = 100): PersonalRecord => ({ exerciseId, metric: "e1rm", value, previous: 90, date, sessionId: `s-${date}` });

describe("default pair", () => {
	it("picks earliest and latest regardless of order", () => {
		const pair = defaultPair([ph("b", "2026-10-01"), ph("c", "2026-11-20"), ph("a", "2026-09-01")]);
		expect(pair?.before.id).toBe("a");
		expect(pair?.after.id).toBe("c");
	});
	it("is null with fewer than two photos or one shared date", () => {
		expect(defaultPair([ph("a", "2026-09-01")])).toBeNull();
		expect(defaultPair([ph("a", "2026-09-01"), ph("b", "2026-09-01")])).toBeNull();
	});
	it("orders any chosen two by date", () => {
		expect(orderPair(ph("x", "2026-11-01"), ph("y", "2026-10-01"))?.before.id).toBe("y");
		expect(orderPair(ph("x", "2026-11-01"), ph("y", "2026-11-01"))).toBeNull();
	});
});

describe("context", () => {
	const pair = { before: ph("a", "2026-09-01"), after: ph("b", "2026-11-01") };
	const base = { pair, consistency: 0.8, streakWeeks: 4, exerciseName: (id: string) => id.toUpperCase() };
	it("uses body weights on or before each date", () => {
		const c = buildContext({ ...base, bodyWeights: [{ date: "2026-08-20", kg: 80 }, { date: "2026-10-20", kg: 77.4 }, { date: "2026-12-01", kg: 70 }], records: [] });
		expect(c.weightChangeKg).toBe(-2.6);
		expect(c.periodDays).toBe(61);
		expect(c.streakWeeks).toBe(4);
	});
	it("prefers the weight stored on the photo and is null when unknown", () => {
		const p = { before: ph("a", "2026-09-01", 80), after: ph("b", "2026-11-01", 78) };
		expect(buildContext({ ...base, pair: p, bodyWeights: [], records: [] }).weightChangeKg).toBe(-2);
		expect(buildContext({ ...base, bodyWeights: [], records: [] }).weightChangeKg).toBeNull();
	});
	it("keeps up to 5 records inside the period, newest first", () => {
		const records = [rec("2026-08-01"), rec("2026-09-01"), rec("2026-09-05"), rec("2026-09-10"), rec("2026-10-01"), rec("2026-10-10"), rec("2026-11-01"), rec("2026-11-05")];
		const c = buildContext({ ...base, bodyWeights: [], records });
		expect(c.records).toHaveLength(5);
		expect(c.records[0]).toEqual({ exercise: "SQUAT", text: "estimated 1RM 100 kg" });
	});
});

describe("gating", () => {
	it("needs two photos; first analysis free, later ones premium", () => {
		expect(gating(1, 0, false)).toEqual({ showButton: false, premiumGate: false });
		expect(gating(2, 0, false)).toEqual({ showButton: true, premiumGate: false });
		expect(gating(2, 1, false)).toEqual({ showButton: true, premiumGate: true });
		expect(gating(2, 3, true)).toEqual({ showButton: true, premiumGate: false });
	});
});

describe("response parsing", () => {
	const ok = { suitable: true, summary: "s", observations: [{ area: "a", text: "t" }], encouragement: "e" };
	it("accepts a valid response and rejects others", () => {
		expect(parsePhotoInsightResponse(ok)).toMatchObject({ summary: "s" });
		expect(parsePhotoInsightResponse({ ...ok, observations: "x" })).toBeNull();
		expect(parsePhotoInsightResponse(null)).toBeNull();
	});
	it("maps statuses and gates the mock to dev", () => {
		expect(errorFromStatus(429)).toBe("rate_limited");
		expect(errorFromStatus(503)).toBe("unavailable");
		expect(errorFromStatus(502)).toBe("failed");
		expect(mockAllowed("?mockPhotoAi=1", "development")).toBe(true);
		expect(mockAllowed("?mockPhotoAi=1", "production")).toBe(false);
		expect(mockAllowed("", "development")).toBe(false);
	});
});

describe("reducer", () => {
	it("records consent and adds insights idempotently", () => {
		const pair = { before: ph("a", "2026-09-01"), after: ph("b", "2026-11-01") };
		const insight = toInsight({ id: "i1", now: "2026-11-21T10:00:00Z", pair, model: "gemini", engineVersion: "2.0.0", result: { suitable: true, summary: "s", observations: [], encouragement: "e" } });
		expect(insight.result).not.toHaveProperty("suitable");
		let s = reducer(emptyState(), { type: "photo-ai-consent", at: "2026-11-21T10:00:00Z" });
		expect(s.photoAiConsentAt).toBe("2026-11-21T10:00:00Z");
		s = reducer(s, { type: "add-photo-insight", insight });
		s = reducer(s, { type: "add-photo-insight", insight });
		expect(s.photoInsights).toHaveLength(1);
		expect(reducer(emptyState(), { type: "hydrate", state: { ...emptyState(), photoInsights: undefined as never } }).photoInsights).toEqual([]);
	});
});

describe("sanitizing", () => {
	it("turns a long Ukrainian name with apostrophe and ampersand into a server-valid string", () => {
		const name = "Підтягування з’єднаним хватом & розведення гантелей лежачи на похилій лаві 😀 дуже довга назва";
		const out = sanitizeRecordText(name);
		expect(out.length).toBeLessThanOrEqual(60);
		expect(out).not.toMatch(/[&’😀]/u);
		expect(out).toContain("з'єднаним");
		expect(SAFE_TEXT_RE.test(out)).toBe(true);
		const pair = { before: ph("a", "2026-09-01"), after: ph("b", "2026-11-01") };
		const c = buildContext({ pair, bodyWeights: [], consistency: null, streakWeeks: 0, records: [rec("2026-10-01")], exerciseName: () => name });
		const png = "data:image/png;base64,iVBORw0KGgo=";
		const photo = (date: string) => ({ date, dataUrl: png });
		expect(photoInsightRequestSchema.safeParse({ token: crypto.randomUUID(), locale: "uk", before: photo("2026-09-01"), after: photo("2026-11-01"), context: c }).success).toBe(true);
	});
	it("drops records that sanitize to empty and clamps stored insight text", () => {
		expect(sanitizeRecordText("😀&")).toBe("");
		const pair = { before: ph("a", "2026-09-01"), after: ph("b", "2026-11-01") };
		const c = buildContext({ pair, bodyWeights: [], consistency: null, streakWeeks: 0, records: [rec("2026-10-01")], exerciseName: () => "😀" });
		expect(c.records).toEqual([]);
		const i = toInsight({ id: "x", now: "n", pair, model: "m", engineVersion: "e", result: { suitable: true, summary: "s".repeat(3000), observations: [{ area: "a".repeat(300), text: "t".repeat(2000) }], encouragement: "e".repeat(2000) } });
		expect([i.result.summary.length, i.result.observations[0]?.area.length, i.result.observations[0]?.text.length, i.result.encouragement.length]).toEqual([2000, 200, 1000, 1000]);
	});
});
