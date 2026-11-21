/** Concurrent calls share one execution; the slot frees when it settles. */
export function singleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
	let running: Promise<R> | null = null;
	return (...args) => {
		if (running) return running;
		const p = fn(...args).finally(() => {
			running = null;
		});
		running = p;
		return p;
	};
}

/**
 * Runs one job at a time. A call made while a job is running waits for it and returns without running again,
 * except a `force` call made while a non-forced job runs, which runs after it.
 */
export function createGate() {
	let running: Promise<void> | null = null;
	let runningForced = false;
	return async function run(force: boolean, job: () => Promise<void>): Promise<void> {
		while (running) {
			const wasForced = runningForced;
			await running;
			if (!force || wasForced) return;
		}
		runningForced = force;
		const p = job().finally(() => {
			running = null;
		});
		running = p;
		await p;
	};
}
