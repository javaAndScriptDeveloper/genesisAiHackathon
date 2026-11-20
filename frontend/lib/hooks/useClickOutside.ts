import { useEffect, type RefObject } from "react";

// Calls `onOutside` on pointer-down outside `ref` while `active`.
export function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onOutside: () => void) {
	useEffect(() => {
		if (!active) return;
		const handler = (event: PointerEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
		};
		document.addEventListener("pointerdown", handler);
		return () => document.removeEventListener("pointerdown", handler);
	}, [ref, active, onOutside]);
}
