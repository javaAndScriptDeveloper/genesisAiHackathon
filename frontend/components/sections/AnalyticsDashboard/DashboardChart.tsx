"use client";

import clsx from "clsx";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { useClickOutside } from "@/lib/hooks/useClickOutside";
import styles from "./AnalyticsDashboard.module.scss";

interface ChartValue {
	label: string;
	amount: string;
}

export interface ChartPoint {
	id: string;
	label: string;
	value: number;
	values: ChartValue[];
	tick?: string | number;
}

interface ChartSeriesProps {
	label: string;
	points: ChartPoint[];
	max: number;
	stacked?: boolean;
}

type Selection = { id: string; source: "pointer" | "keyboard" | "click" };

export function ChartSeries({ label, points, max, stacked = false }: ChartSeriesProps) {
	const [selection, setSelection] = useState<Selection | null>(null);
	const [tabStop, setTabStop] = useState(points[0]?.id);
	const series = useRef<HTMLDivElement>(null);
	const dismiss = useCallback(() => setSelection(null), []);
	useClickOutside(series, selection !== null, dismiss);

	const index = points.findIndex((point) => point.id === selection?.id);
	const active = points[index];
	const tabbable = points.some((point) => point.id === tabStop) ? tabStop : points[0]?.id;
	const anchor = stacked && active
		? 100 * (points.slice(0, index).reduce((sum, point) => sum + point.value, 0) + active.value / 2) / max
		: 100 * (index + 0.5) / points.length;

	function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		if (event.key === "Escape" && selection) {
			event.preventDefault();
			dismiss();
			return;
		}

		let next = index;
		switch (event.key) {
			case "ArrowLeft": next = Math.max(0, index - 1); break;
			case "ArrowRight": next = Math.min(points.length - 1, index + 1); break;
			case "Home": next = 0; break;
			case "End": next = points.length - 1; break;
			default: return;
		}
		event.preventDefault();
		series.current?.querySelectorAll("button")[next]?.focus({ preventScroll: true });
		const point = points[next];
		if (point) setSelection({ id: point.id, source: "keyboard" });
	}

	return (
		<div
			ref={series}
			className={clsx(styles.series, stacked && styles.costStack)}
			onPointerLeave={() => setSelection((current) => current?.source === "pointer" ? null : current)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					setSelection((current) => current?.source === "keyboard" ? null : current);
				}
			}}
		>
			<ul className={stacked ? styles.segments : styles.bars} aria-label={label}>
				{points.map((point, index) => {
					const size = `${100 * point.value / max}%`;
					return (
						<li key={point.id} data-cost={stacked ? point.id : undefined} style={stacked ? { width: size } : undefined}>
							<button
								type="button"
								className={styles.chartPoint}
								data-active={active === point}
								tabIndex={point.id === tabbable ? 0 : -1}
								aria-label={[point.label, ...point.values.map(({ label, amount }) => `${label} ${amount}`)].join(" · ")}
								onPointerEnter={(event) => {
									if (event.pointerType !== "touch") setSelection({ id: point.id, source: "pointer" });
								}}
								onFocus={(event) => {
									setTabStop(point.id);
									if (event.currentTarget.matches(":focus-visible")) setSelection({ id: point.id, source: "keyboard" });
								}}
								onClick={() => {
									setTabStop(point.id);
									setSelection((current) => current?.id === point.id && current.source === "click" ? null : { id: point.id, source: "click" });
								}}
								onKeyDown={(event) => handleKey(event, index)}
							>
								<span className={styles.chartBar} style={stacked ? undefined : { height: size }} aria-hidden />
							</button>
							{point.tick !== undefined && <span className={styles.tickLabel} aria-hidden>{point.tick}</span>}
						</li>
					);
				})}
			</ul>
			{active && (
				<div
					className={styles.chartHint}
					aria-hidden
					style={{ left: `clamp(min(50%, var(--hint-half-width)), ${anchor}%, max(50%, calc(100% - var(--hint-half-width))))` }}
				>
					<strong>{active.label}</strong>
					<dl>
						{active.values.map(({ label, amount }) => <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>)}
					</dl>
				</div>
			)}
		</div>
	);
}

interface DashboardChartProps extends Omit<ChartSeriesProps, "stacked"> {
	ticks: { value: number; label: string }[];
	threshold?: number;
}

export function DashboardChart({ label, points, max, ticks, threshold }: DashboardChartProps) {
	return (
		<div className={styles.chart}>
			<div className={styles.axis} aria-hidden>
				{ticks.map(({ value, label }) => <span key={value}>{label}</span>)}
			</div>
			<div className={styles.plot}>
				<div className={styles.gridlines} aria-hidden>{ticks.map(({ value }) => <i key={value} />)}</div>
				{threshold !== undefined && <div className={styles.threshold} style={{ bottom: `${100 * threshold / max}%` }} aria-hidden />}
				<ChartSeries label={label} points={points} max={max} />
			</div>
		</div>
	);
}
