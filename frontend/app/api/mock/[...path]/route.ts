import { NextResponse } from "next/server";
import { getItem, listItems } from "@/lib/api/mock/handlers";
import { TRAINERS } from "@/lib/api/mock/trainers";

// Mock backend. Add `?delay=800` to simulate latency, `?fail=1` to simulate a 500.
export async function GET(request: Request, ctx: RouteContext<"/api/mock/[...path]">) {
	const { path } = await ctx.params;
	const url = new URL(request.url);
	const delay = Number(url.searchParams.get("delay") ?? 0);
	if (delay > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 5000)));
	if (url.searchParams.get("fail") === "1") return NextResponse.json({ error: "mock failure" }, { status: 500 });

	const [resource, id] = path;
	if (resource === "trainers" && !id) return NextResponse.json({ trainers: TRAINERS });
	if (resource === "items" && !id) {
		const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
		const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? 10)));
		return NextResponse.json(listItems(page, pageSize));
	}
	if (resource === "items" && id) {
		const item = getItem(id);
		return item ? NextResponse.json(item) : NextResponse.json({ error: "not found" }, { status: 404 });
	}
	return NextResponse.json({ error: "not found" }, { status: 404 });
}
