// Converts assets-src/**/*.{png,jpg,jpeg} to public/img/<name>.webp (1x) and <name>@2x.webp.
// Source is treated as the @2x master: 1x = half width. Never upscales. Skips up-to-date outputs.
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "assets-src";
const OUT = "public/img";
const exts = new Set([".png", ".jpg", ".jpeg"]);

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(full);
		else if (exts.has(path.extname(entry.name).toLowerCase())) yield full;
	}
}

const newer = async (a, b) => {
	try {
		return (await stat(a)).mtimeMs <= (await stat(b)).mtimeMs;
	} catch {
		return false;
	}
};

await mkdir(OUT, { recursive: true });
let count = 0;
for await (const file of walk(SRC)) {
	const name = path.basename(file, path.extname(file));
	const out2x = path.join(OUT, `${name}@2x.webp`);
	const out1x = path.join(OUT, `${name}.webp`);
	if ((await newer(file, out2x)) && (await newer(file, out1x))) continue;
	const meta = await sharp(file).metadata();
	await sharp(file).webp({ quality: 85 }).toFile(out2x);
	await sharp(file).resize({ width: Math.round((meta.width ?? 0) / 2) || undefined }).webp({ quality: 85 }).toFile(out1x);
	console.log(`converted ${file} -> ${out1x}, ${out2x}`);
	count++;
}
console.log(`done, ${count} image(s) converted`);
