import { z } from "zod";

export const itemSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum(["active", "draft", "archived"]),
	owner: z.string(),
	createdAt: z.string(),
});
export type Item = z.infer<typeof itemSchema>;

export const itemsResponseSchema = z.object({
	items: z.array(itemSchema),
	total: z.number(),
});
export type ItemsResponse = z.infer<typeof itemsResponseSchema>;

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}
