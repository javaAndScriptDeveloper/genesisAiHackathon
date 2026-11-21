import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "./types";

// Trainers live in platform-backend (Postgres). The browser reaches them through the `/api/*` fallback
// rewrite. The five seeded SVG paths map to bundled portraits so older backend data keeps working.
export const trainerSchema = z.object({ id: z.string(), name: z.string(), pathToImage: z.string(), tov: z.string() });
export type Trainer = z.infer<typeof trainerSchema>;

const bundledPortraits = new Map(
	["mike", "john", "hanna", "caroline", "alex"].map((id) => [`/trainers/${id}.svg`, `/img/trainer-${id}@2x.webp`]),
);

const BUNDLED_TRAINERS: Trainer[] = [["mike", "Mike"], ["john", "John"], ["hanna", "Hanna"], ["caroline", "Caroline"], ["alex", "Alex"]].map(([id, name]) => ({ id: id ?? "", name: name ?? "", pathToImage: `/img/trainer-${id}@2x.webp`, tov: "" }));

/**
 * The trainer with this id, or the bundled copy when the trainers list hasn't loaded (or the backend is down).
 * The default trainer (John) is shown on Today, Profile and notifications, so his photo must never depend on the network.
 */
export function trainerById(list: Trainer[] | undefined, id: string): Trainer | undefined {
	return list?.find((tr) => tr.id === id) ?? BUNDLED_TRAINERS.find((tr) => tr.id === id);
}

export function bundledTrainerPortrait(trainerId: string): string | undefined {
	return bundledPortraits.get(`/trainers/${trainerId}.svg`);
}

const responseSchema = z.object({ trainers: z.array(trainerSchema) });

export async function fetchTrainers(): Promise<Trainer[]> {
	const response = await fetch("/api/trainers");
	if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status);
	const parsed = responseSchema.safeParse(await response.json());
	if (!parsed.success) throw new ApiError("Unexpected response shape", 502);
	return parsed.data.trainers.map((trainer) => ({
		...trainer,
		pathToImage: bundledPortraits.get(trainer.pathToImage) ?? trainer.pathToImage,
	}));
}

export function useTrainers() {
	return useQuery({ queryKey: ["trainers"], queryFn: fetchTrainers, staleTime: Infinity });
}
