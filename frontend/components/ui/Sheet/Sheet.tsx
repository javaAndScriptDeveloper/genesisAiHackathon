"use client";

import clsx from "clsx";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Sheet.module.scss";

interface SheetProps {
	open: boolean;
	onClose: () => void;
	title: string;
	closeLabel?: string;
	children: ReactNode;
	footer?: ReactNode;
	/** `center` renders a compact dialog (confirmations); `bottom` a sheet that slides up. */
	variant?: "bottom" | "center";
	/** Hides the close button and blocks backdrop/Escape dismissal (safety stops, required choices). */
	modal?: boolean;
}

// In-frame overlay. A native <dialog> would escape the phone frame on desktop, so sheets are positioned
// against the nearest positioned ancestor (the device screen). Escape closes, focus moves inside, Tab is trapped.
export function Sheet({ open, onClose, title, closeLabel = "Close", children, footer, variant = "bottom", modal = false }: SheetProps) {
	const ref = useRef<HTMLDivElement>(null);
	const titleId = useId();

	useEffect(() => {
		if (!open) return;
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const panel = ref.current;
		const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])') ?? []);
		(panel?.querySelector<HTMLElement>("input, textarea") ?? panel)?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !modal) {
				event.stopPropagation();
				onClose();
			}
			if (event.key === "Tab") {
				const items = focusable();
				const first = items[0];
				const last = items[items.length - 1];
				if (!first || !last) return;
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("keydown", onKey);
			previous?.focus();
		};
	}, [open, onClose, modal]);

	if (!open) return null;
	return (
		<div className={clsx(styles.root, styles[variant])}>
			<div className={styles.backdrop} onClick={modal ? undefined : onClose} aria-hidden />
			<div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.panel}>
				<div className={styles.header}>
					<h3 id={titleId} className={styles.title}>
						{title}
					</h3>
					{!modal && <IconButton icon={Cancel01Icon} label={closeLabel} onClick={onClose} />}
				</div>
				<div className={styles.body}>{children}</div>
				{footer && <div className={styles.footer}>{footer}</div>}
			</div>
		</div>
	);
}
