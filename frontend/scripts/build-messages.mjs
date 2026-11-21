// Merges messages/parts/<locale-agnostic>.json fragments (English source copy) into messages/en.json.
// Parts keep each feature's copy next to its work; run `node scripts/build-messages.mjs` after editing a part.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "messages");
const merge = (a, b) => {
	for (const [k, v] of Object.entries(b)) a[k] = typeof v === "object" && v !== null && typeof a[k] === "object" ? merge(a[k], v) : v;
	return a;
};
const baseFile = path.join(dir, "en.base.json");
const base = JSON.parse(readFileSync(baseFile, "utf8"));
const out = readdirSync(path.join(dir, "parts")).filter((f) => f.endsWith(".json")).sort().reduce((acc, f) => merge(acc, JSON.parse(readFileSync(path.join(dir, "parts", f), "utf8"))), base);
writeFileSync(path.join(dir, "en.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log("messages/en.json built");
