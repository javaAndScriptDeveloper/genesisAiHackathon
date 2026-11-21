"use client";

import clsx from "clsx";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { Sheet } from "../Sheet/Sheet";
import styles from "./TimePicker.module.scss";

interface TimePickerProps {
	label: string;
	/** `HH:MM`, 24-hour. */
	value: string;
	onChange: (value: string) => void;
	/** Minute increments shown on the wheel. */
	minuteStep?: 1 | 5 | 10 | 15 | 30;
	/** Quick picks shown under the wheels. */
	presets?: string[];
	title?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	closeLabel?: string;
	hint?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parse(value: string): { h: number; m: number } {
	const [h = "0", m = "0"] = value.split(":");
	return { h: Math.min(23, Math.max(0, Number(h) || 0)), m: Math.min(59, Math.max(0, Number(m) || 0)) };
}

// Custom time field: a button that opens an iOS-style wheel picker in a sheet. No native <input type="time">.
export function TimePicker({ label, value, onChange, minuteStep = 5, presets = ["06:30", "07:30", "12:00", "18:00", "20:00"], title, confirmLabel = "Set time", cancelLabel = "Cancel", closeLabel = "Close", hint }: TimePickerProps) {
	const [open, setOpen] = useState(false);
	const id = useId();
	return (
		<div className={styles.field}>
			<span className={styles.label} id={`${id}-label`}>
				{label}
			</span>
			<button type="button" className={styles.trigger} aria-haspopup="dialog" aria-labelledby={`${id}-label ${id}-value`} onClick={() => setOpen(true)}>
				<span id={`${id}-value`} className={styles.value}>
					{value}
				</span>
				<Icon icon={Clock01Icon} size={20} />
			</button>
			{hint && <p className={styles.hint}>{hint}</p>}
			<Sheet open={open} onClose={() => setOpen(false)} title={title ?? label} closeLabel={closeLabel}>
				<PickerBody
					initial={value}
					minuteStep={minuteStep}
					presets={presets}
					confirmLabel={confirmLabel}
					cancelLabel={cancelLabel}
					onCancel={() => setOpen(false)}
					onConfirm={(next) => {
						onChange(next);
						setOpen(false);
					}}
				/>
			</Sheet>
		</div>
	);
}

interface BodyProps {
	initial: string;
	minuteStep: number;
	presets: string[];
	confirmLabel: string;
	cancelLabel: string;
	onCancel: () => void;
	onConfirm: (value: string) => void;
}

// Mounted only while the sheet is open, so the draft always starts from the saved value.
function PickerBody({ initial, minuteStep, presets, confirmLabel, cancelLabel, onCancel, onConfirm }: BodyProps) {
	const start = parse(initial);
	const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep);
	const [h, setH] = useState(start.h);
	const [m, setM] = useState(minutes.reduce((best, c) => (Math.abs(c - start.m) < Math.abs(best - start.m) ? c : best), 0));
	const current = `${pad(h)}:${pad(m)}`;
	return (
		<div className={styles.body}>
			<div className={styles.wheels}>
				<span className={styles.band} aria-hidden />
				<Wheel label="Hours" items={Array.from({ length: 24 }, (_, i) => i)} value={h} onChange={setH} />
				<span className={styles.colon} aria-hidden>
					:
				</span>
				<Wheel label="Minutes" items={minutes} value={m} onChange={setM} />
			</div>
			<div className={styles.presets} role="group" aria-label="Quick picks">
				{presets.map((p) => (
					<button
						key={p}
						type="button"
						className={clsx(styles.preset, p === current && styles.presetOn)}
						onClick={() => {
							const t = parse(p);
							setH(t.h);
							setM(minutes.reduce((best, c) => (Math.abs(c - t.m) < Math.abs(best - t.m) ? c : best), 0));
						}}
					>
						{p}
					</button>
				))}
			</div>
			<div className={styles.actions}>
				<Button variant="secondary" onClick={onCancel}>
					{cancelLabel}
				</Button>
				<Button onClick={() => onConfirm(current)}>
					{confirmLabel} · {current}
				</Button>
			</div>
		</div>
	);
}

interface WheelProps {
	label: string;
	items: number[];
	value: number;
	onChange: (value: number) => void;
}

// Scroll-snap column. Scrolling, tapping a row and the arrow keys all move the selection.
function Wheel({ label, items, value, onChange }: WheelProps) {
	const list = useRef<HTMLDivElement>(null);
	const timer = useRef<number | null>(null);
	const index = Math.max(0, items.indexOf(value));
	const rowHeight = () => list.current?.firstElementChild?.getBoundingClientRect().height ?? 44;

	const scrollToIndex = useCallback((i: number, smooth: boolean) => {
		const el = list.current;
		if (!el) return;
		const h = el.firstElementChild?.getBoundingClientRect().height ?? 44;
		el.scrollTo({ top: i * h, behavior: smooth ? "smooth" : "auto" });
	}, []);

	// First paint: jump to the saved value without animation.
	useEffect(() => {
		scrollToIndex(index, false);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
	}, []);

	// Selection changed from outside the scroll (preset, keyboard): bring the wheel to it.
	useEffect(() => {
		const el = list.current;
		if (!el) return;
		const now = Math.round(el.scrollTop / rowHeight());
		if (now !== index) scrollToIndex(index, true);
	}, [index, scrollToIndex]);

	useEffect(() => () => void (timer.current && window.clearTimeout(timer.current)), []);

	const onScroll = () => {
		if (timer.current) window.clearTimeout(timer.current);
		timer.current = window.setTimeout(() => {
			const el = list.current;
			if (!el) return;
			const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / rowHeight())));
			const next = items[i];
			if (next !== undefined && next !== value) onChange(next);
		}, 90);
	};

	const move = (to: number) => {
		const clamped = Math.min(items.length - 1, Math.max(0, to));
		const next = items[clamped];
		if (next !== undefined) onChange(next);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const map: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, PageDown: index + 4, PageUp: index - 4, Home: 0, End: items.length - 1 };
		const to = map[event.key];
		if (to === undefined) return;
		event.preventDefault();
		move(to);
	};

	return (
		<div ref={list} className={styles.wheel} role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={undefined} onScroll={onScroll} onKeyDown={onKeyDown}>
			{items.map((n, i) => (
				<div key={n} role="option" aria-selected={i === index} className={clsx(styles.item, i === index && styles.itemOn)} onClick={() => move(i)}>
					{pad(n)}
				</div>
			))}
		</div>
	);
}
