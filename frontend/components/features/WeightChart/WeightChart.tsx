"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import { daysBetween } from "@/lib/progress/dates";
import { nearestDot, type WeightSeries } from "@/lib/progress/weightScreen";
import styles from "./WeightChart.module.scss";

interface WeightChartProps {
	series: WeightSeries;
	/** kg to the displayed number as text (units applied by the caller). */
	fmt: (kg: number) => string;
	fmtDate: (iso: string) => string;
	unit: string;
	goalKg?: number | null;
	label: string;
	/** Taller plot for the full-screen view. */
	tall?: boolean;
}

const W = 320;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 10;
const PAD_B = 20;

/** Two-series weight chart (weigh-in dots + 7-day average line). Tap, drag or arrow keys read a weigh-in. Plain SVG. */
export function WeightChart({ series, fmt, fmtDate, unit, goalKg, label, tall = false }: WeightChartProps) {
	const t = useT();
	const id = useId();
	const H = tall ? 300 : 180;
	const [picked, setPicked] = useState<string | null>(null);
	const last = series.dots[series.dots.length - 1];
	const active = series.dots.find((d) => d.date === picked) ?? last;
	if (!last || !active) return null;

	const span = Math.max(1, daysBetween(series.from, series.to));
	const plotW = W - PAD_L - PAD_R;
	const plotH = H - PAD_T - PAD_B;
	const x = (d: string) => PAD_L + (daysBetween(series.from, d) / span) * plotW;
	const y = (kg: number) => PAD_T + (1 - (kg - series.min) / (series.max - series.min)) * plotH;
	const avgAt = series.line.find((l) => l.date === active.date);
	const ticks = [series.max, (series.max + series.min) / 2, series.min];

	const valueText = `${fmtDate(active.date)}, ${t("fit.progress.weight.weighIn")} ${fmt(active.kg)} ${unit}${avgAt ? `, ${t("fit.progress.weight.avg")} ${fmt(avgAt.kg)} ${unit}` : ""}`;

	const pick = (e: PointerEvent<SVGSVGElement>) => {
		const r = e.currentTarget.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const hit = nearestDot(series, (px - PAD_L) / plotW);
		if (hit) setPicked(hit.date);
	};
	const onKey = (e: KeyboardEvent) => {
		const i = series.dots.findIndex((d) => d.date === active.date);
		const next = e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : e.key === "Home" ? 0 : e.key === "End" ? series.dots.length - 1 : null;
		if (next === null) return;
		e.preventDefault();
		const target = series.dots[Math.min(series.dots.length - 1, Math.max(0, next))];
		if (target) setPicked(target.date);
	};

	return (
		<figure className={styles.figure}>
			<p className={styles.readout} aria-live="polite">
				<strong>{fmtDate(active.date)}</strong>
				<span>
					{t("fit.progress.weight.weighIn")} {fmt(active.kg)} {unit}
				</span>
				{avgAt && (
					<span className={styles.avgText}>
						{t("fit.progress.weight.avg")} {fmt(avgAt.kg)} {unit}
					</span>
				)}
			</p>
			{/* The svg is focusable so keyboard users can step through weigh-ins; the text alternative sits in aria-label. */}
			<svg
				viewBox={`0 0 ${W} ${H}`}
				role="slider"
				tabIndex={0}
				aria-label={`${label}. ${t("fit.progress.weight.chartSummary", { n: series.dots.length, from: fmtDate(series.dots[0]?.date ?? series.from), to: fmtDate(last.date), last: `${fmt(last.kg)} ${unit}` })}`}
				aria-orientation="horizontal"
				aria-valuemin={0}
				aria-valuemax={series.dots.length - 1}
				aria-valuenow={Math.max(0, series.dots.findIndex((d) => d.date === active.date))}
				aria-valuetext={valueText}
				aria-describedby={`${id}-hint`}
				className={styles.svg}
				onPointerDown={(e) => {
					e.currentTarget.setPointerCapture(e.pointerId);
					pick(e);
				}}
				onPointerMove={(e) => {
					if (e.buttons > 0 || e.pointerType === "touch") pick(e);
				}}
				onKeyDown={onKey}
			>
				{ticks.map((v) => (
					<g key={v}>
						<line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} className={styles.grid} />
						<text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" className={styles.axis}>
							{fmt(v)}
						</text>
					</g>
				))}
				<text x={PAD_L} y={H - 5} className={styles.axis}>
					{fmtDate(series.from)}
				</text>
				<text x={W - PAD_R} y={H - 5} textAnchor="end" className={styles.axis}>
					{fmtDate(series.to)}
				</text>
				{goalKg && goalKg >= series.min && goalKg <= series.max && (
					<g>
						<line x1={PAD_L} x2={W - PAD_R} y1={y(goalKg)} y2={y(goalKg)} className={styles.goal} strokeDasharray="5 4" />
						<text x={W - PAD_R} y={y(goalKg) - 4} textAnchor="end" className={styles.goalText}>
							{t("fit.progress.weight.goalLine")} {fmt(goalKg)}
						</text>
					</g>
				)}
				{series.line.length > 1 && <polyline fill="none" className={styles.line} points={series.line.map((p) => `${x(p.date)},${y(p.kg)}`).join(" ")} />}
				{series.dots.map((p) => (
					<circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={p.date === active.date ? 5 : 3} className={p.date === active.date ? `${styles.dot} ${styles.dotActive}` : styles.dot} />
				))}
				<line x1={x(active.date)} x2={x(active.date)} y1={PAD_T} y2={H - PAD_B} className={styles.cursor} />
			</svg>
			<figcaption id={`${id}-hint`} className={styles.caption}>
				<span className={styles.key}>
					<i className={styles.keyDot} aria-hidden />
					{t("fit.progress.weight.weighIn")}
				</span>
				<span className={styles.key}>
					<i className={styles.keyLine} aria-hidden />
					{t("fit.progress.weight.avg")}
				</span>
			</figcaption>
		</figure>
	);
}
