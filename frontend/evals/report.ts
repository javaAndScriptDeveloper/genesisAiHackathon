import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface EvalRow {
	id: string;
	trainerId: string;
	text: string;
	violations: string[];
	inCharacter: boolean;
	safe: boolean;
	reason: string;
	latencyMs: number;
}

// Gemini 3.5 Flash-Lite standard paid price per 1M tokens (https://ai.google.dev/gemini-api/docs/pricing); output includes thinking tokens.
const PRICE_IN_PER_M = 0.3;
const PRICE_OUT_PER_M = 2.5;
const TOKENS_IN = 220; // system + prompt for a nudge
const TOKENS_OUT = 45;
const JUDGE_IN = 420;
const JUDGE_OUT = 40;

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${Math.round((n / d) * 100)}%`);

export function writeReport(rows: EvalRow[], file = path.join(import.meta.dirname, "results", "latest.md")): string {
	const guardOk = rows.filter((r) => r.violations.length === 0).length;
	const charOk = rows.filter((r) => r.inCharacter).length;
	const safeOk = rows.filter((r) => r.safe).length;
	const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
	const median = latencies[Math.floor(latencies.length / 2)] ?? 0;
	const cost = rows.length * ((TOKENS_IN + JUDGE_IN) * PRICE_IN_PER_M + (TOKENS_OUT + JUDGE_OUT) * PRICE_OUT_PER_M) / 1_000_000;
	const trainers = [...new Set(rows.map((r) => r.trainerId))];
	const lines = [
		`# Nudge eval result`,
		``,
		`Run: ${new Date().toISOString()}. Cases: ${rows.length}.`,
		``,
		`| Metric | Result |`,
		`| --- | --- |`,
		`| Guard rules passed (no invented numbers, emoji, shaming, length) | ${guardOk}/${rows.length} (${pct(guardOk, rows.length)}) |`,
		`| Judge: in the trainer's voice | ${charOk}/${rows.length} (${pct(charOk, rows.length)}) |`,
		`| Judge: safe (no shaming or medical advice, no invented facts) | ${safeOk}/${rows.length} (${pct(safeOk, rows.length)}) |`,
		`| Median generation latency | ${median} ms |`,
		`| Estimated cost of this run (generate + judge) | $${cost.toFixed(5)} |`,
		``,
		`## In-character rate per trainer`,
		``,
		...trainers.map((t) => {
			const mine = rows.filter((r) => r.trainerId === t);
			return `- ${t}: ${mine.filter((r) => r.inCharacter).length}/${mine.length}`;
		}),
		``,
		`## Cases`,
		``,
		`| Case | Guard | Voice | Safe | Text |`,
		`| --- | --- | --- | --- | --- |`,
		...rows.map((r) => `| ${r.id} | ${r.violations.length === 0 ? "ok" : r.violations.join(", ")} | ${r.inCharacter ? "ok" : "no"} | ${r.safe ? "ok" : "no"} | ${r.text.replace(/\|/g, "/")} |`),
		``,
	];
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, lines.join("\n"));
	return file;
}
