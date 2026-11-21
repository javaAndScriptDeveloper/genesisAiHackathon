"use client";

import clsx from "clsx";
import { ArrowLeft01Icon, ArrowRight01Icon, CrownIcon, FullScreenIcon } from "@hugeicons/core-free-icons";
import { useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Icon, IconButton, Sheet } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PERIOD_DAYS, clientToViewX, periodChange, pickPointIndex, pointXs, pointYs, pointsInPeriod, type ChartPeriod, type ChartBox } from "@/lib/progress/recordsScreen";
import type { SeriesPoint } from "@/lib/progress/records";
import type { IsoDate } from "@/lib/progress/types";
import styles from "./InteractiveChart.module.scss";

const ALL_PERIODS: ChartPeriod[] = ["4w", "3m", "year"];
const BASE_W = 300;
const H = 130;
const PX_PER_POINT = 44;

export interface InteractiveChartProps {
	/** Values already in display units (kg or lb). */
	points: SeriesPoint[];
	unit: string;
	/** Accessible name of the chart, e.g. "Goblet squat estimated 1RM". */
	label: string;
	today: IsoDate;
	periods?: ChartPeriod[];
	defaultPeriod?: ChartPeriod;
	/** True for periods the user may not see (free plan). */
	isLocked?: (period: ChartPeriod) => boolean;
	/** Called when a locked period is chosen (analytics, navigation). */
	onLocked?: (period: ChartPeriod) => void;
	/** Shown instead of the chart while a locked period is selected (e.g. a PremiumGate). */
	lockedContent?: ReactNode;
	/** Formats a value for the readout; defaults to the locale number with at most one decimal. */
	format?: (value: number) => string;
	/** Shows values as estimates ("≈ 36 kg"). */
	estimate?: boolean;
	/** Hide the "Expand" button (used inside the expanded sheet itself). */
	hideExpand?: boolean;
	className?: string;
}

export function InteractiveChart(props: InteractiveChartProps) {
	const { points, unit, label, today, periods = ALL_PERIODS, defaultPeriod = "3m", isLocked, onLocked, lockedContent, format, estimate = false, hideExpand = false, className } = props;
	const { t, locale } = useI18n();
	const [period, setPeriod] = useState<ChartPeriod>(periods.includes(defaultPeriod) ? defaultPeriod : (periods[0] ?? "3m"));
	const [pickedDate, setPickedDate] = useState<IsoDate | null>(null);
	const [expanded, setExpanded] = useState(false);
	const dragging = useRef(false);
	const svgRef = useRef<SVGSVGElement>(null);

	const nf = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
	const fmt = format ?? ((v: number) => nf.format(v));
	const fmtDate = (d: IsoDate): string => {
		const [y = 1970, m = 1, day = 1] = d.split("-").map(Number);
		const sameYear = Number(today.slice(0, 4)) === y;
		return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(new Date(y, m - 1, day));
	};

	const approx = (v: string) => (estimate ? t("fit.progress.recordsScreen.approx", { value: v }) : v);
	const locked = isLocked?.(period) ?? false;
	const visible = useMemo(() => pointsInPeriod(points, today, PERIOD_DAYS[period]), [points, today, period]);
	const wide = expanded && visible.length * PX_PER_POINT > BASE_W;
	const width = wide ? visible.length * PX_PER_POINT : BASE_W;
	const box: ChartBox = { width, height: H, padX: 16, padY: 16 };
	const xs = useMemo(() => pointXs(visible.map((p) => p.date), box), [visible, width]); // eslint-disable-line react-hooks/exhaustive-deps
	const ys = useMemo(() => pointYs(visible.map((p) => p.value), box), [visible, width]); // eslint-disable-line react-hooks/exhaustive-deps

	const lastIndex = visible.length - 1;
	const found = pickedDate ? visible.findIndex((p) => p.date === pickedDate) : -1;
	const index = found >= 0 ? found : lastIndex;
	const current = visible[index];

	const pickAt = (clientX: number) => {
		const svg = svgRef.current;
		if (!svg) return;
		const r = svg.getBoundingClientRect();
		const i = pickPointIndex(xs, clientToViewX(clientX, r.left, r.width, width));
		const p = visible[i];
		if (p) setPickedDate(p.date);
	};
	const onDown = (e: PointerEvent<SVGSVGElement>) => {
		dragging.current = true;
		e.currentTarget.setPointerCapture(e.pointerId);
		pickAt(e.clientX);
	};
	const onMove = (e: PointerEvent<SVGSVGElement>) => {
		if (dragging.current) pickAt(e.clientX);
	};
	const onUp = (e: PointerEvent<SVGSVGElement>) => {
		dragging.current = false;
		if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
	};
	const step = (delta: -1 | 1) => {
		const p = visible[Math.min(lastIndex, Math.max(0, index + delta))];
		if (p) setPickedDate(p.date);
	};

	const choose = (p: ChartPeriod) => {
		setPeriod(p);
		setPickedDate(null);
		if (isLocked?.(p)) onLocked?.(p);
	};

	const change = periodChange(visible);
	const desc = `${label}. ${visible.map((p) => `${fmtDate(p.date)}: ${approx(fmt(p.value))} ${unit}`).join("; ")}`;
	const first = visible[0];
	const last = visible[lastIndex];
	const values = visible.map((p) => p.value);

	const body = (
		<div className={clsx(styles.root, className)}>
			<div className={styles.periods} role="group" aria-label={t("fit.progress.chart.periodLabel")}>
				{periods.map((p) => {
					const lockedP = isLocked?.(p) ?? false;
					return (
						<button key={p} type="button" className={clsx(styles.period, p === period && styles.activePeriod)} aria-pressed={p === period} onClick={() => choose(p)}>
							{t(`fit.progress.chart.p${p}`)}
							{lockedP && <Icon icon={CrownIcon} size={12} />}
							{lockedP && <span className={styles.srOnly}> {t("fit.common.premium")}</span>}
						</button>
					);
				})}
			</div>

			{locked ? (
				lockedContent
			) : visible.length === 0 ? (
				<p className={styles.empty}>{t("fit.progress.chart.empty")}</p>
			) : (
				<>
					<div className={styles.readout} aria-live="polite">
						<div className={styles.value}>
							<strong>{current ? approx(fmt(current.value)) : ""}</strong>
							<span className={styles.unit}>{unit}</span>
							<span className={styles.date}>{current ? fmtDate(current.date) : ""}</span>
						</div>
						<div className={styles.steppers}>
							<IconButton icon={ArrowLeft01Icon} label={t("fit.progress.chart.prev")} onClick={() => step(-1)} disabled={index <= 0} />
							<IconButton icon={ArrowRight01Icon} label={t("fit.progress.chart.next")} onClick={() => step(1)} disabled={index >= lastIndex} />
						</div>
					</div>
					<div className={clsx(styles.scroll, wide && styles.scrollWide)}>
						<svg
							ref={svgRef}
							viewBox={`0 0 ${width} ${H + 18}`}
							role="img"
							aria-label={desc}
							className={clsx(styles.svg, wide && styles.svgWide)}
							style={wide ? { width } : undefined}
							onPointerDown={onDown}
							onPointerMove={onMove}
							onPointerUp={onUp}
							onPointerCancel={onUp}
						>
							<line x1={box.padX} x2={width - box.padX} y1={H - box.padY / 2} y2={H - box.padY / 2} className={styles.base} />
							<polyline fill="none" className={styles.line} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={visible.map((_, i) => `${xs[i]},${ys[i]}`).join(" ")} />
							{current && <line x1={xs[index]} x2={xs[index]} y1={box.padY / 2} y2={H - box.padY / 2} className={styles.cursor} strokeDasharray="3 3" />}
							{visible.map((p, i) => (
								<circle key={p.date} cx={xs[i]} cy={ys[i]} r={i === index ? 6 : 3.5} className={i === index ? styles.dotActive : styles.dot} />
							))}
							{first && (
								<text x={box.padX} y={H + 14} textAnchor="start" className={styles.axis}>
									{fmtDate(first.date)}
								</text>
							)}
							{last && visible.length > 1 && (
								<text x={width - box.padX} y={H + 14} textAnchor="end" className={styles.axis}>
									{fmtDate(last.date)}
								</text>
							)}
							{values.length > 1 && (
								<text x={box.padX} y={9} textAnchor="start" className={styles.axis}>
									{fmt(Math.max(...values))}
								</text>
							)}
						</svg>
					</div>
					<div className={styles.foot}>
						<span className={styles.change}>{visible.length > 1 ? t("fit.progress.chart.change", { value: `${change > 0 ? "+" : ""}${fmt(change)}`, unit }) : t("fit.progress.chart.onePoint")}</span>
						{!hideExpand && (
							<button type="button" className={styles.expand} onClick={() => setExpanded(true)}>
								<Icon icon={FullScreenIcon} size={16} />
								{t("fit.progress.chart.expand")}
							</button>
						)}
					</div>
				</>
			)}
		</div>
	);

	return (
		<>
			{body}
			{!hideExpand && (
				<Sheet open={expanded} onClose={() => setExpanded(false)} title={label} closeLabel={t("common.close")} variant="full">
					<InteractiveChart {...props} hideExpand defaultPeriod={period} />
				</Sheet>
			)}
		</>
	);
}
