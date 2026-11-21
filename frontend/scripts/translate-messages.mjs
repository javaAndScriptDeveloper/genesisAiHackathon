// Fills messages/<locale>.json with machine translations of every key that locale is still missing.
// Usage: bun --env-file=.env.local scripts/translate-messages.mjs [locale ...]   (no args = every locale except en)
// Needs GEMINI_API_KEY. It only sends the English UI copy (no user data) and keeps {placeholders} intact.
// Review the output before shipping: machine translation is a starting point, not a final copy edit.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "messages");
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is missing (run with --env-file=.env.local).");
const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
const NAMES = JSON.parse(readFileSync(path.join(dir, "..", "lib", "i18n", "names.json"), "utf8"));

const flatten = (obj, prefix = "") => Object.entries(obj).flatMap(([k, v]) => (typeof v === "object" && v !== null ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)]]));
const setDeep = (obj, dotted, value) => {
	const parts = dotted.split(".");
	let node = obj;
	for (const p of parts.slice(0, -1)) node = node[p] ??= {};
	node[parts.at(-1)] = value;
};
const placeholders = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");

const en = flatten(JSON.parse(readFileSync(path.join(dir, "en.json"), "utf8")));
const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAMES).filter((c) => c !== "en");

async function translate(batch, language) {
	const body = {
		contents: [{ parts: [{ text: `Translate these fitness-app UI strings from English to ${language}. Keep every {placeholder} exactly as is, keep it short and natural, address the user informally if the language has that option. Reply with a JSON object with the same keys.\n\n${JSON.stringify(Object.fromEntries(batch))}` }] }],
		generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
	};
	const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
	if (!res.ok) throw new Error(`Gemini ${res.status}`);
	const data = await res.json();
	return JSON.parse(data.candidates[0].content.parts[0].text);
}

for (const code of targets) {
	const file = path.join(dir, `${code}.json`);
	const current = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
	const have = new Set(flatten(current).map(([k]) => k));
	const missing = en.filter(([k]) => !have.has(k));
	console.log(`${code}: ${missing.length} missing`);
	for (let i = 0; i < missing.length; i += 60) {
		const batch = missing.slice(i, i + 60);
		const out = await translate(batch, NAMES[code] ?? code);
		for (const [k, source] of batch) {
			const value = out[k];
			// Reject anything that lost or changed a placeholder; it will be retried on the next run.
			if (typeof value === "string" && value.trim() && placeholders(value) === placeholders(source)) setDeep(current, k, value.trim());
		}
		writeFileSync(file, `${JSON.stringify(current, null, 2)}\n`);
	}
}
console.log("done");
