"use client";

import clsx from "clsx";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useCallback, useId, useRef, useState, type KeyboardEvent } from "react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import { Icon } from "../Icon/Icon";
import styles from "./Select.module.scss";

export interface SelectOption<T extends string> {
	value: T;
	label: string;
	disabled?: boolean;
}

interface SelectProps<T extends string> {
	options: SelectOption<T>[];
	value: T | null;
	onChange: (value: T) => void;
	label?: string;
	placeholder?: string;
	error?: string;
	className?: string;
}

// Keyboard: Arrow Up/Down, Home/End, Enter/Space select, Escape closes (focus returns to trigger), typeahead by first letters.
export function Select<T extends string>({ options, value, onChange, label, placeholder = "Оберіть…", error, className }: SelectProps<T>) {
	const id = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const typeahead = useRef({ text: "", timer: 0 });
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const selected = options.find((o) => o.value === value);

	const close = useCallback(() => setOpen(false), []);
	useClickOutside(rootRef, open, close);

	const openMenu = () => {
		setActive(Math.max(0, options.findIndex((o) => o.value === value)));
		setOpen(true);
	};
	const choose = (index: number) => {
		const option = options[index];
		if (!option || option.disabled) return;
		onChange(option.value);
		setOpen(false);
		triggerRef.current?.focus();
	};
	const move = (step: 1 | -1) => {
		let next = active;
		for (let i = 0; i < options.length; i++) {
			next = (next + step + options.length) % options.length;
			if (!options[next]?.disabled) break;
		}
		setActive(next);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		switch (event.key) {
			case "ArrowDown":
			case "ArrowUp":
				event.preventDefault();
				if (!open) return openMenu();
				return move(event.key === "ArrowDown" ? 1 : -1);
			case "Home":
			case "End":
				if (!open) return;
				event.preventDefault();
				return setActive(event.key === "Home" ? 0 : options.length - 1);
			case "Enter":
			case " ":
				event.preventDefault();
				return open ? choose(active) : openMenu();
			case "Escape":
				if (open) {
					event.preventDefault();
					setOpen(false);
					triggerRef.current?.focus();
				}
				return;
			case "Tab":
				return setOpen(false);
			default:
				if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
					const t = typeahead.current;
					window.clearTimeout(t.timer);
					t.text += event.key.toLowerCase();
					t.timer = window.setTimeout(() => (t.text = ""), 600);
					const index = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text));
					if (index >= 0) {
						if (!open) setOpen(true);
						setActive(index);
					}
				}
		}
	};

	return (
		<div ref={rootRef} className={clsx(styles.root, className)}>
			{label && (
				<label id={`${id}-label`} className={styles.label} onClick={() => triggerRef.current?.focus()}>
					{label}
				</label>
			)}
			<button
				ref={triggerRef}
				type="button"
				className={clsx(styles.trigger, open && styles.open, error && styles.invalid)}
				role="combobox"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={`${id}-list`}
				aria-labelledby={label ? `${id}-label` : undefined}
				aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
				onClick={() => (open ? setOpen(false) : openMenu())}
				onKeyDown={onKeyDown}
			>
				<span className={clsx(styles.value, !selected && styles.placeholder)}>{selected?.label ?? placeholder}</span>
				<Icon icon={ArrowDown01Icon} size={18} className={styles.chevron} />
			</button>
			{open && (
				<ul id={`${id}-list`} role="listbox" className={styles.panel} tabIndex={-1}>
					{options.map((option, index) => (
						<li
							key={option.value}
							id={`${id}-opt-${index}`}
							role="option"
							aria-selected={option.value === value}
							aria-disabled={option.disabled || undefined}
							className={clsx(styles.option, index === active && styles.active, option.disabled && styles.disabled)}
							onPointerEnter={() => setActive(index)}
							onClick={() => choose(index)}
						>
							<span>{option.label}</span>
							{option.value === value && <Icon icon={Tick02Icon} size={16} />}
						</li>
					))}
				</ul>
			)}
			{error && (
				<p className={styles.error} role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
