import { apiFetch } from "./client";
import { itemSchema, itemsResponseSchema } from "./types";

export * from "./types";

// Replace these with real endpoints when the backend appears; component code stays the same.
export const api = {
	listItems: (page = 1, pageSize = 10) =>
		apiFetch(`/items?page=${page}&pageSize=${pageSize}`, itemsResponseSchema),
	getItem: (id: string) => apiFetch(`/items/${id}`, itemSchema),
};
