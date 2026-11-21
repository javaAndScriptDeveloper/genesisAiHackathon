import { alternativesFor, getExercise, isUsable } from "./exercises";
import { buildBlock, estimateMinutes, nextBlockId, roundLoad } from "./plan";
import type { AdaptOp, ExerciseBlock, Profile, SetEntry } from "./types";

export interface AdaptResult {
	exercises: ExerciseBlock[];
	message: string;
	changed: boolean;
}

interface Ctx {
	profile: Profile;
	/** Index of the first block that may change (the current exercise in a live session). */
	startIndex: number;
}

const undone = (block: ExerciseBlock) => block.sets.filter((s) => !s.done);

function mapUndone(block: ExerciseBlock, fn: (set: SetEntry) => SetEntry): ExerciseBlock {
	return { ...block, sets: block.sets.map((s) => (s.done ? s : fn(s))) };
}

function scaleLoad(set: SetEntry, factor: number, repDelta: number, timed: boolean): SetEntry {
	if (set.targetWeight !== undefined) return { ...set, targetWeight: roundLoad(set.targetWeight * factor) };
	const min = timed ? 15 : 5;
	return { ...set, target: Math.max(min, set.target + (timed ? repDelta * 5 : repDelta)) };
}

function eligible(blocks: ExerciseBlock[], start: number): number[] {
	return blocks.map((b, i) => (i >= start && !b.skipped && undone(b).length > 0 ? i : -1)).filter((i) => i >= 0);
}

/** Replace an untouched block with an easier variant when one exists and is usable. */
function easierVariant(block: ExerciseBlock, profile: Profile): ExerciseBlock | null {
	const exercise = getExercise(block.exerciseId);
	if (!exercise.easierId || block.sets.some((s) => s.done)) return null;
	const easier = getExercise(exercise.easierId);
	if (!isUsable(easier, profile)) return null;
	const fresh = buildBlock(easier, profile, 1, { sets: block.sets.length, rest: block.restSec });
	return { ...fresh, id: block.id };
}

export function applyAdapt(blocks: ExerciseBlock[], op: AdaptOp, ctx: Ctx): AdaptResult {
	const idx = eligible(blocks, ctx.startIndex);
	const none = (message: string): AdaptResult => ({ exercises: blocks, message, changed: false });
	if (op.kind !== "replace" && idx.length === 0) return none("Nothing left to adjust: all sets are done.");
	const next = blocks.map((b) => ({ ...b, sets: b.sets.map((s) => ({ ...s })) }));

	switch (op.kind) {
		case "easier":
		case "too-hard": {
			let swapped = 0;
			for (const i of idx) {
				const block = next[i];
				if (!block) continue;
				const variant = op.kind === "too-hard" ? null : easierVariant(block, ctx.profile);
				if (variant) {
					next[i] = variant;
					swapped += 1;
					continue;
				}
				const timed = getExercise(block.exerciseId).timed ?? false;
				const factor = op.kind === "too-hard" ? 0.85 : 0.9;
				next[i] = { ...mapUndone(block, (s) => scaleLoad(s, factor, op.kind === "too-hard" ? -3 : -2, timed)), restSec: Math.min(240, block.restSec + (op.kind === "too-hard" ? 20 : 0)) };
			}
			const extra = op.kind === "too-hard" ? " and added rest" : "";
			return { exercises: next, changed: true, message: `Lightened ${idx.length} remaining exercise${idx.length === 1 ? "" : "s"}${swapped ? ` (${swapped} swapped for easier versions)` : ""}${extra}.` };
		}
		case "harder": {
			for (const i of idx) {
				const block = next[i];
				if (block) next[i] = mapUndone(block, (s) => scaleLoad(s, 1.05, 1, getExercise(block.exerciseId).timed ?? false));
			}
			return { exercises: next, changed: true, message: "Nudged the remaining sets up slightly." };
		}
		case "more-rest": {
			for (const i of idx) {
				const block = next[i];
				if (block) next[i] = { ...block, restSec: Math.min(240, block.restSec + 30) };
			}
			return { exercises: next, changed: true, message: "Added 30 seconds of rest between sets." };
		}
		case "tired": {
			for (const i of idx) {
				const block = next[i];
				if (!block) continue;
				let working = block;
				if (undone(working).length >= 3) {
					const lastUndone = working.sets.map((s) => s.done).lastIndexOf(false);
					working = { ...working, sets: working.sets.filter((_, n) => n !== lastUndone) };
				}
				const timed = getExercise(working.exerciseId).timed ?? false;
				next[i] = { ...mapUndone(working, (s) => scaleLoad(s, 0.9, -2, timed)), restSec: Math.min(240, Math.round(working.restSec * 1.2)) };
			}
			return { exercises: next, changed: true, message: "Lighter session: fewer sets, about 10% less load and longer rests." };
		}
		case "shorten": {
			const keepTo = ctx.startIndex;
			let removed = 0;
			let trimmedSets = 0;
			const budget = Math.max(5, op.minutes);
			let guard = 40;
			while (estimateMinutes(next.filter((b) => !b.skipped)) > budget && guard-- > 0) {
				// First trim a set from the latest block that still has more than 2 sets to do.
				const trimIdx = [...eligible(next, keepTo)].reverse().find((i) => i > keepTo && undone(next[i] as ExerciseBlock).length > 2);
				if (trimIdx !== undefined) {
					const block = next[trimIdx] as ExerciseBlock;
					const lastUndone = block.sets.map((s) => s.done).lastIndexOf(false);
					next[trimIdx] = { ...block, sets: block.sets.filter((_, n) => n !== lastUndone) };
					trimmedSets += 1;
					continue;
				}
				// Then drop whole later blocks that have no completed sets.
				const dropIdx = [...eligible(next, keepTo)].reverse().find((i) => i > keepTo && !(next[i] as ExerciseBlock).sets.some((s) => s.done));
				if (dropIdx === undefined) break;
				next.splice(dropIdx, 1);
				removed += 1;
			}
			const changed = removed > 0 || trimmedSets > 0;
			return { exercises: next, changed, message: changed ? `Trimmed to about ${estimateMinutes(next)} min: ${removed} exercise${removed === 1 ? "" : "s"} removed, ${trimmedSets} set${trimmedSets === 1 ? "" : "s"} cut.` : "This already fits your time." };
		}
		case "replace": {
			const at = next.findIndex((b) => b.id === op.blockId);
			const block = next[at];
			if (!block) return none("Could not find that exercise.");
			const exclude = next.map((b) => b.exerciseId);
			const choice = alternativesFor(block.exerciseId, ctx.profile, exclude)[0];
			if (!choice) return none("No suitable replacement with your equipment and limitations.");
			return replaceBlock(next, at, choice.id, ctx.profile);
		}
	}
}

/** Swap one block for a specific exercise, keeping any sets already completed. */
export function replaceBlock(blocks: ExerciseBlock[], at: number, exerciseId: string, profile: Profile): AdaptResult {
	const block = blocks[at];
	if (!block) return { exercises: blocks, message: "Could not find that exercise.", changed: false };
	const target = getExercise(exerciseId);
	const remaining = undone(block).length;
	const fresh = buildBlock(target, profile, 1, { sets: Math.max(1, remaining || block.sets.length), rest: block.restSec });
	const before = getExercise(block.exerciseId).name;
	const done = block.sets.filter((s) => s.done);
	const next = [...blocks];
	if (done.length === 0) next[at] = { ...fresh, id: block.id };
	else {
		next[at] = { ...block, sets: done };
		next.splice(at + 1, 0, { ...fresh, id: nextBlockId() });
	}
	return { exercises: next, changed: true, message: `Replaced ${before} with ${target.name}${done.length ? " (completed sets kept)" : ""}.` };
}

/** Swap every block whose exercise is no longer possible (equipment removed or limitation added). */
export function replaceUnavailable(blocks: ExerciseBlock[], profile: Profile): { exercises: ExerciseBlock[]; replaced: string[] } {
	const replaced: string[] = [];
	let current = blocks;
	for (let i = 0; i < current.length; i += 1) {
		const block = current[i];
		if (!block || block.skipped || undone(block).length === 0) continue;
		if (isUsable(getExercise(block.exerciseId), profile)) continue;
		const choice = alternativesFor(block.exerciseId, profile, current.map((b) => b.exerciseId))[0];
		if (!choice) continue;
		const result = replaceBlock(current, i, choice.id, profile);
		current = result.exercises;
		replaced.push(`${getExercise(block.exerciseId).name} → ${choice.name}`);
	}
	return { exercises: current, replaced };
}
