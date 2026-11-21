/** In-memory sliding-window limiter per key (one server process; enough to stop a runaway client from burning model quota). */
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
	const hits = new Map<string, number[]>();
	return function allow(key: string): boolean {
		const t = now();
		const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
		if (recent.length >= limit) {
			hits.set(key, recent);
			return false;
		}
		hits.set(key, [...recent, t]);
		if (hits.size > 5000) for (const [k, v] of hits) if (v.every((at) => t - at >= windowMs)) hits.delete(k);
		return true;
	};
}
