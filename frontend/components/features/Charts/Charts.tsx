import styles from "./Charts.module.scss";

interface BarDatum {
	label: string;
	value: number;
}

// Plain SVG charts driven by state. Each has a text alternative listing its values for screen readers.
export function BarChart({ data, label, unit = "", height = 120 }: { data: BarDatum[]; label: string; unit?: string; height?: number }) {
	const max = Math.max(1, ...data.map((d) => d.value));
	const w = 300;
	const gap = 8;
	const bar = (w - gap * (data.length - 1)) / Math.max(1, data.length);
	return (
		<figure className={styles.figure}>
			<svg viewBox={`0 0 ${w} ${height + 22}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`} className={styles.svg}>
				{data.map((d, i) => {
					const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * height);
					const x = i * (bar + gap);
					return (
						<g key={d.label + i}>
							<rect x={x} y={height - h} width={bar} height={h} rx={4} className={i === data.length - 1 ? styles.barNow : styles.bar} />
							<text x={x + bar / 2} y={height + 15} textAnchor="middle" className={styles.axis}>
								{d.label}
							</text>
						</g>
					);
				})}
			</svg>
		</figure>
	);
}

export function LineChart({ data, label, unit = "", goal, goalLabel = "Goal" }: { data: BarDatum[]; label: string; unit?: string; goal?: number; goalLabel?: string }) {
	const w = 300;
	const h = 110;
	const pad = 14;
	if (data.length === 0) return null;
	const values = data.map((d) => d.value);
	const extent = goal === undefined ? values : [...values, goal];
	const min = Math.min(...extent);
	const max = Math.max(...extent);
	const span = Math.max(0.5, max - min);
	const points = data.map((d, i) => {
		const x = pad + (data.length === 1 ? (w - pad * 2) / 2 : (i * (w - pad * 2)) / (data.length - 1));
		const y = pad + (1 - (d.value - min) / span) * (h - pad * 2);
		return { x, y, d };
	});
	return (
		<figure className={styles.figure}>
			<svg viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`} className={styles.svg}>
				{goal !== undefined && (
					<g>
						<line x1={pad} x2={w - pad} y1={pad + (1 - (goal - min) / span) * (h - pad * 2)} y2={pad + (1 - (goal - min) / span) * (h - pad * 2)} className={styles.goal} strokeDasharray="5 4" />
						<text x={w - pad} y={pad + (1 - (goal - min) / span) * (h - pad * 2) - 5} textAnchor="end" className={styles.goalText}>{goalLabel} {goal}{unit}</text>
					</g>
				)}
				<polyline fill="none" className={styles.line} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={points.map((p) => `${p.x},${p.y}`).join(" ")} />
				{points.map((p, i) => (
					<g key={i}>
						<circle cx={p.x} cy={p.y} r={4} className={styles.dot} />
						<text x={p.x} y={h + 15} textAnchor="middle" className={styles.axis}>{p.d.label}</text>
						<text x={p.x} y={p.y - 8} textAnchor="middle" className={styles.val}>{p.d.value}</text>
					</g>
				))}
			</svg>
		</figure>
	);
}
