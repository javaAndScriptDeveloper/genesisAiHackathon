"use client";

import clsx from "clsx";
import { useCallback, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { Icon, type IconDefinition } from "../Icon/Icon";
import styles from "./Dropdown.module.scss";

export interface DropdownItem {
	label: string;
	onSelect: () => void;
	icon?: IconDefinition;
	tone?: "default" | "danger";
	disabled?: boolean;
}

interface DropdownProps {
	/** Render-prop for the trigger; spread `props` onto a <button>. */
	trigger: (props: {
		ref: React.RefObject<HTMLButtonElement | null>;
		onClick: () => void;
		onKeyDown: (e: KeyboardEvent) => void;
		"aria-haspopup": "menu";
		"aria-expanded": boolean;
		"aria-controls": string;
	}) => ReactNode;
	items: DropdownItem[];
	align?: "start" | "end";
}

// Action menu (not a value picker; use Select for that).
export function Dropdown({ trigger, items, align = "end" }: DropdownProps) {
	const id = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const close = useCallback(() => setOpen(false), []);
	useClickOutside(rootRef, open, close);

	const run = (index: number) => {
		const item = items[index];
		if (!item || item.disabled) return;
		setOpen(false);
		triggerRef.current?.focus();
		item.onSelect();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (!open) {
			if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				setActive(0);
				setOpen(true);
			}
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			setActive((a) => (a + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
		} else if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			run(active);
		} else if (event.key === "Escape") {
			setOpen(false);
			triggerRef.current?.focus();
		} else if (event.key === "Tab") setOpen(false);
	};

	return (
		<div ref={rootRef} className={styles.root}>
			{trigger({
				ref: triggerRef,
				onClick: () => setOpen((o) => !o),
				onKeyDown,
				"aria-haspopup": "menu",
				"aria-expanded": open,
				"aria-controls": `${id}-menu`,
			})}
			{open && (
				<ul id={`${id}-menu`} role="menu" className={clsx(styles.panel, align === "end" ? styles.end : styles.start)}>
					{items.map((item, index) => (
						<li key={item.label} role="none">
							<button
								type="button"
								role="menuitem"
								tabIndex={-1}
								disabled={item.disabled}
								className={clsx(styles.item, index === active && styles.active, item.tone === "danger" && styles.danger)}
								onPointerEnter={() => setActive(index)}
								onClick={() => run(index)}
							>
								{item.icon && <Icon icon={item.icon} size={18} />}
								{item.label}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
