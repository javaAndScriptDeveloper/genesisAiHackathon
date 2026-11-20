import { items } from "./db";
import type { ItemsResponse } from "../types";

export function listItems(page: number, pageSize: number): ItemsResponse {
	const start = (page - 1) * pageSize;
	return { items: items.slice(start, start + pageSize), total: items.length };
}

export function getItem(id: string) {
	return items.find((item) => item.id === id) ?? null;
}
