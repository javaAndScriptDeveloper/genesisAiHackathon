"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Button, Card, EmptyState, SegmentedControl, Select, Skeleton } from "@/components/ui";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgress } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { plottedMetric, pickExercise, recordExercises, recordRows, type RecordsFilter } from "@/lib/progress/recordsScreen";
import { ExerciseTrend } from "./ExerciseTrend";
import { FormulaPanel } from "./FormulaPanel";
import { RecordList } from "./RecordList";
import { SetRecords } from "./SetRecords";
import styles from "./ProgressRecords.module.scss";

/** Records screen: filter, one exercise card (interactive chart, formula, set records) and the record history. */
export function ProgressRecords({ initialExercise }: { initialExercise?: string }) {
	const t = useT();
	const { state, dispatch, ready, today } = useFit();
	const progress = useProgress();
	const { history, records } = progress;
	const [filter, setFilter] = useState<RecordsFilter>("all");
	const [wanted, setWanted] = useState<string | null>(initialExercise ?? null);
	// Unseen pr events at the time of opening: they keep the "New" mark while this screen is open, then are marked seen.
	const [fresh, setFresh] = useState<ReadonlySet<string> | null>(null);
	const k = "fit.progress.recordsScreen";

	useEffect(() => {
		if (!ready || fresh !== null) return;
		setFresh(new Set(state.progressEvents.filter((e) => e.kind === "pr" && e.seenAt === null).map((e) => e.refId)));
		dispatch({ type: "mark-seen", kinds: ["pr"], now: new Date().toISOString() });
	}, [ready, fresh, state.progressEvents, dispatch]);

	const options = useMemo(() => recordExercises(history, filter), [history, filter]);
	const exerciseId = pickExercise(options, wanted);
	const exercise = options.find((o) => o.id === exerciseId);
	const rows = useMemo(() => recordRows(history, records, filter, fresh ?? new Set()), [history, records, filter, fresh]);
	const noData = history.sessions.every((s) => s.status !== "completed") || recordExercises(history, "all").length === 0;
	const showFormula = exerciseId !== null && plottedMetric(history, exerciseId) === "e1rm";
	const isWeighted = exercise?.kind === "weighted";

	return (
		<div className={styles.root}>
			<ScreenHeader title={t(`${k}.title`)} subtitle={t(`${k}.subtitle`)} back="/progress" />
			<div className={styles.content}>
				{!ready ? (
					<div className={styles.skeleton} aria-hidden>
						<Skeleton height="4.4rem" />
						<Skeleton height="4.4rem" />
						<Skeleton height="30rem" />
						<Skeleton height="16rem" />
					</div>
				) : noData ? (
					<Card>
						<EmptyState
							title={t(`${k}.emptyTitle`)}
							description={t(`${k}.emptyBody`)}
							action={
								<Link href="/today" tabIndex={-1}>
									<Button size="sm">{t(`${k}.emptyAction`)}</Button>
								</Link>
							}
						/>
					</Card>
				) : (
					<>
						<SegmentedControl
							label={t(`${k}.filterLabel`)}
							value={filter}
							onChange={setFilter}
							options={[
								{ id: "all", label: t(`${k}.all`) },
								{ id: "weighted", label: t(`${k}.weighted`) },
								{ id: "bodyweight", label: t(`${k}.bodyweight`) },
							]}
						/>
						{exercise && exerciseId ? (
							<Card className={styles.card}>
								<Select label={t(`${k}.exerciseLabel`)} options={options.map((o) => ({ value: o.id, label: o.name }))} value={exerciseId} onChange={setWanted} />
								<ExerciseTrend key={exerciseId} history={history} exerciseId={exerciseId} today={today} name={exercise.name} />
								{showFormula && <FormulaPanel history={history} exerciseId={exerciseId} />}
								{isWeighted && <SetRecords history={history} exerciseId={exerciseId} />}
							</Card>
						) : (
							<p className={styles.hint}>{t(`${k}.emptyFilter`)}</p>
						)}
						{rows.length > 0 && (
							<section aria-labelledby="records-list">
								<h2 id="records-list" className={styles.h2}>
									{t(`${k}.listTitle`)}
								</h2>
								<Card>
									<RecordList rows={rows} />
								</Card>
							</section>
						)}
					</>
				)}
			</div>
		</div>
	);
}
