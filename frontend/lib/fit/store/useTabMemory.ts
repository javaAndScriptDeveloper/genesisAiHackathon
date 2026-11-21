"use client";

import { useCallback, useState } from "react";

// Module-level memory so a screen's selected tab survives navigating away and back (not persisted across reloads).
const memory = new Map<string, string>();

export function useTabMemory<T extends string>(key: string, fallback: T): [T, (value: T) => void] {
	const [value, setValue] = useState<T>(() => (memory.get(key) as T | undefined) ?? fallback);
	const set = useCallback(
		(next: T) => {
			memory.set(key, next);
			setValue(next);
		},
		[key],
	);
	return [value, set];
}
