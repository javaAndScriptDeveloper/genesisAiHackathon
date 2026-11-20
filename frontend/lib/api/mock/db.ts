import type { Item } from "../types";

const owners = ["Олена К.", "Тарас Б.", "Марія Л.", "Андрій Д."];
const statuses: Item["status"][] = ["active", "draft", "archived"];

export const items: Item[] = Array.from({ length: 47 }, (_, i) => ({
	id: String(i + 1),
	title: `Елемент ${i + 1}`,
	status: statuses[i % statuses.length] ?? "active",
	owner: owners[i % owners.length] ?? "Олена К.",
	createdAt: new Date(2026, 10, 1 + (i % 28)).toISOString(),
}));
