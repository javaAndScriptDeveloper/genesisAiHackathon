import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "./types";

// Trainers live in platform-backend (Postgres). The browser reaches them through the `/api/*` fallback
// rewrite, so this uses the real path rather than the mock API base. Avatars are dummy SVGs in public/trainers
// (deliberate exception to the WebP rule), so render them with `unoptimized`.
export const trainerSchema = z.object({ id: z.string(), name: z.string(), iconPath: z.string(), description: z.string() });
export type Trainer = z.infer<typeof trainerSchema>;

const responseSchema = z.object({ trainers: z.array(trainerSchema) });

export async function fetchTrainers(): Promise<Trainer[]> {
	const response = await fetch("/api/trainers");
	if (!response.ok) throw new ApiError(`Request failed: ${response.status}`, response.status);
	const parsed = responseSchema.safeParse(await response.json());
	if (!parsed.success) throw new ApiError("Unexpected response shape", 502);
	return parsed.data.trainers;
}

export function useTrainers() {
	return useQuery({ queryKey: ["trainers"], queryFn: fetchTrainers, staleTime: Infinity });
}
