"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/** Smoothly scrolls `container` horizontally so `item` sits in the middle (Telegram-style tab strips). */
export function scrollToCenter(container: HTMLElement, item: HTMLElement, smooth = true): void {
	const target = item.offsetLeft - (container.clientWidth - item.offsetWidth) / 2;
	const max = container.scrollWidth - container.clientWidth;
	container.scrollTo({ left: Math.max(0, Math.min(max, target)), behavior: smooth ? "smooth" : "auto" });
}

/**
 * Drives a "magic line" under/behind the active tab and keeps it centered in an overflowing tab strip.
 * The indicator is positioned through CSS variables set directly on the DOM, so tab switches never re-render React.
 * The container must be `position: relative` and the indicator `position: absolute` using --ind-x / --ind-w.
 */
export function useSlidingIndicator(activeKey: string) {
	const container = useRef<HTMLDivElement>(null);
	const indicator = useRef<HTMLSpanElement>(null);
	const items = useRef(new Map<string, HTMLElement>());
	const first = useRef(true);

	const register = useCallback(
		(key: string) => (node: HTMLElement | null) => {
			if (node) items.current.set(key, node);
			else items.current.delete(key);
		},
		[],
	);

	const sync = useCallback(
		(animate: boolean) => {
			const box = container.current;
			const line = indicator.current;
			const el = items.current.get(activeKey);
			if (!box || !line) return;
			if (!el) {
				delete line.dataset.ready; // nothing active here (e.g. on a profile page): hide the indicator
				return;
			}
			line.style.setProperty("--ind-x", `${el.offsetLeft}px`);
			line.style.setProperty("--ind-w", `${el.offsetWidth}px`);
			line.dataset.ready = "true";
			scrollToCenter(box, el, animate);
		},
		[activeKey],
	);

	useLayoutEffect(() => {
		sync(!first.current);
		first.current = false;
	}, [sync]);

	useEffect(() => {
		const box = container.current;
		if (!box || typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(() => sync(false));
		observer.observe(box);
		return () => observer.disconnect();
	}, [sync]);

	return { container, indicator, register };
}
