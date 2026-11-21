"use client";

import { Calendar03Icon, ChartIncreaseIcon, ChampionIcon, Idea01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import Link from "next/link";
import { fmtShort } from "@/components/features/ProgressCalendar/format";
import { Badge, Button, Card, Icon } from "@/components/ui";
import { useUnits } from "@/lib/fit/store/hooks";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Advice, Improvement } from "@/lib/progress/improvements";
import { formatRecordValue, seriesMetric, type RecordFormat } from "@/lib/progress/mainScreen";
import type { PersonalRecord, RecordMetric } from "@/lib/progress/records";
import type { Exercise } from "@/lib/progress/types";
import styles from "./ProgressHighlights.module.scss";

interface ProgressHighlightsProps {
	exercises: Exercise[];
	improvements: Improvement[];
	advice: Advice | null;
	action: "start" | "calendar" | null;
	onStart: () => void;
	onCalendar: () => void;
	records: { record: PersonalRecord; isNew: boolean }[];
	/** All personal records, to know which metric an exercise's series uses (e1RM or max weight). */
	allRecords: PersonalRecord[];
}

const recordsHref = (exerciseId: string) => `/progress/records?exercise=${encodeURIComponent(exerciseId)}`;

/** "What improved" (≤ 2), "What next" (one action) and "New records" (2 cards). Each block hides when it has nothing to say. */
export function ProgressHighlights({ exercises, improvements, advice, action, onStart, onCalendar, records, allRecords }: ProgressHighlightsProps) {
	const { t, locale } = useI18n();
	const u = useUnits();
	const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
	/** Loads via useUnits (kg/lb), reps and seconds as counts; e1RM always as an estimate ("≈"). */
	const fmt: RecordFormat = {
		load: (kg) => `${nf.format(u.load(kg))} ${u.unit}`,
		reps: (n) => `${nf.format(n)} ${t("fit.progress.unit.reps")}`,
		time: (sec) => `${nf.format(sec)} ${t("fit.progress.unit.s")}`,
		estimate: (text) => t("fit.progress.main.records.estimate", { value: text }),
	};
	const value = (metric: RecordMetric, v: number): string => formatRecordValue(metric, v, fmt);

	const improvementText = (i: Improvement): string => {
		if (i.kind === "record") return t("fit.progress.improvements.record", { exercise: nameOf(i.exerciseId), before: value(i.metric, i.before), now: value(i.metric, i.now), delta: value(i.metric, i.delta) });
		return t(`fit.progress.improvements.${i.kind}`, { before: nf.format(i.before), now: nf.format(i.now), delta: nf.format(i.delta) });
	};

	const adviceText = (a: Advice): string => {
		if (a.id === "near-record") {
			const id = String(a.vars.exerciseId ?? "");
			const target = Number(a.vars.target);
			const metric = seriesMetric(exercises.find((e) => e.id === id)?.kind, allRecords, id);
			return t("fit.progress.advice.near-record", { exercise: String(a.vars.exercise ?? ""), target: Number.isFinite(target) ? value(metric, target) : "" });
		}
		return t(`fit.progress.advice.${a.id}`, Object.fromEntries(Object.entries(a.vars).map(([k, v]) => [k, typeof v === "number" ? nf.format(v) : v])));
	};

	if (improvements.length === 0 && !advice && records.length === 0) return null;
	return (
		<div className={styles.root}>
			{improvements.length > 0 && (
				<Card className={styles.card}>
					<h2 className={styles.h2}>{t("fit.progress.main.improved.title")}</h2>
					<ul className={styles.list}>
						{improvements.map((i) => (
							<li key={i.kind === "record" ? `${i.kind}-${i.exerciseId}` : i.kind}>
								<Link href={i.kind === "record" ? recordsHref(i.exerciseId) : "/progress/calendar"} transitionTypes={["nav-forward"]} className={styles.row}>
									<Icon icon={ChartIncreaseIcon} size={20} className={styles.icon} />
									<span>{improvementText(i)}</span>
								</Link>
							</li>
						))}
					</ul>
				</Card>
			)}

			{advice && (
				<Card className={styles.card}>
					<h2 className={styles.h2}>{t("fit.progress.main.next.title")}</h2>
					<p className={styles.advice}>
						<Icon icon={Idea01Icon} size={20} className={styles.icon} />
						<span>{adviceText(advice)}</span>
					</p>
					{action === "start" && (
						<Button variant="secondary" iconLeft={PlayIcon} onClick={onStart}>
							{t("fit.progress.main.next.start")}
						</Button>
					)}
					{action === "calendar" && (
						<Button variant="secondary" iconLeft={Calendar03Icon} onClick={onCalendar}>
							{t("fit.progress.main.next.calendar")}
						</Button>
					)}
				</Card>
			)}

			{records.length > 0 && (
				<section className={styles.records} aria-labelledby="progress-new-records">
					<h2 id="progress-new-records" className={styles.h2}>
						{t("fit.progress.main.records.title")}
					</h2>
					<ul className={styles.recordGrid}>
						{records.map(({ record: r, isNew }) => {
							const shown = value(r.metric, r.value);
							return (
								<li key={`${r.exerciseId}-${r.metric}-${r.date}`}>
									<Link href={recordsHref(r.exerciseId)} transitionTypes={["nav-forward"]} className={clsx(styles.record, isNew && styles.isNew)}>
										<span className={styles.recordHead}>
											<Icon icon={ChampionIcon} size={18} className={styles.icon} />
											{isNew && <Badge tone="accent">{t("fit.progress.main.records.new")}</Badge>}
										</span>
										<span className={styles.recordName}>{nameOf(r.exerciseId)}</span>
										<strong className={styles.recordValue}>{shown}</strong>
										<span className={styles.recordMeta}>
											{t(`fit.progress.main.records.${r.metric}`)} · {fmtShort(r.date, locale)}
										</span>
										{r.previous > 0 && r.value > r.previous && <span className={styles.recordUp}>{t("fit.progress.main.records.up", { delta: value(r.metric, r.value - r.previous) })}</span>}
									</Link>
								</li>
							);
						})}
					</ul>
				</section>
			)}
		</div>
	);
}
