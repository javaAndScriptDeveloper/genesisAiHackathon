"use client";

import { ArrowDown01Icon, Clock01Icon, Dumbbell01Icon, FlashIcon, Medal01Icon } from "@hugeicons/core-free-icons";
import { Badge, EmptyState, Icon, KIND_ICON, SportIcon } from "@/components/ui";
import { addDays, formatDay, mondayOf, WEEKDAYS, weekdayIndex } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import type { SessionLog } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./History.module.scss";

const FEEL_TONE = { easy: "neutral", right: "success", hard: "warning" } as const;

export function History() {
	const t = useT();
	const u = useUnits();
	const { state } = useFit();
	const logs = [...state.history].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
	if (logs.length === 0) return <EmptyState title={t("fit.progress.historyEmpty")} description={t("fit.progress.historyEmptyBody")} />;

	// Group by week (Monday start) so a long list stays scannable.
	const groups = new Map<string, SessionLog[]>();
	for (const log of logs) {
		const key = mondayOf(log.date);
		groups.set(key, [...(groups.get(key) ?? []), log]);
	}
	const minutes = Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60);
	const volume = logs.reduce((n, l) => n + l.volumeKg, 0);
	const xp = logs.reduce((n, l) => n + l.xp, 0);

	return (
		<>
			<ul className={styles.totals} aria-label={t("fit.history.totals")}>
				<li><Icon icon={Dumbbell01Icon} size={18} /><strong>{logs.length}</strong><span>{t("fit.awards.workouts")}</span></li>
				<li><Icon icon={Clock01Icon} size={18} /><strong>{minutes}</strong><span>{t("fit.awards.minutes")}</span></li>
				<li><Icon icon={FlashIcon} size={18} /><strong>{xp}</strong><span>XP</span></li>
			</ul>

			{[...groups.entries()].map(([monday, items]) => (
				<section key={monday} className={styles.group}>
					<h3 className={styles.groupTitle}>
						{formatDay(monday)} – {formatDay(addDays(monday, 6))}
						<span>{t("fit.history.groupCount", { n: items.length })}</span>
					</h3>
					<ul className={styles.list}>
						{items.map((l) => (
							<li key={l.id}>
								<details className={styles.log}>
									<summary className={styles.summary}>
										<span className={styles.date} aria-hidden>
											<small>{WEEKDAYS[weekdayIndex(l.date)]}</small>
											<strong>{Number(l.date.slice(8))}</strong>
										</span>
										<span className={styles.main}>
											<strong>{l.title}</strong>
											<span className={styles.chips}>
												<span><Icon icon={Clock01Icon} size={14} />{Math.max(1, Math.round(l.durationSec / 60))} {t("fit.common.minShort")}</span>
												{l.volumeKg > 0 && <span><Icon icon={Dumbbell01Icon} size={14} />{u.fmtMass(l.volumeKg)}</span>}
												<span><Icon icon={FlashIcon} size={14} />+{l.xp}</span>
											</span>
										</span>
										<span className={styles.badges}>
											<Badge tone={l.status === "completed" ? "success" : "warning"}>{t(`fit.status.${l.status}`)}</Badge>
										</span>
										<Icon icon={ArrowDown01Icon} size={18} className={styles.chevron} />
									</summary>
									<div className={styles.body}>
										<ul className={styles.exercises}>
											{l.exercises.map((e) => {
												const ex = getExercise(e.exerciseId);
												return (
													<li key={e.exerciseId}>
														<span className={styles.exIcon}>
															<SportIcon name={KIND_ICON[ex.kind]} size={18} />
														</span>
														<span className={styles.exMain}>
															<strong>{ex.name}</strong>
															{e.skipped ? (
																<span className={styles.skipped}>{t("fit.workout.skippedLabel")}</span>
															) : (
																<span className={styles.sets}>
																	{e.sets.map((s, i) => (
																		<span key={i} className={styles.set}>{s.reps}{s.weight ? `×${u.fmtLoad(s.weight)}` : ""}</span>
																	))}
																</span>
															)}
														</span>
													</li>
												);
											})}
										</ul>
										{l.prs.length > 0 && (
											<p className={styles.pr}>
												<Icon icon={Medal01Icon} size={16} />
												{t("fit.session.prs", { list: l.prs.join(", ") })}
											</p>
										)}
										<p className={styles.foot}>
											<Badge tone={FEEL_TONE[l.perceived] ?? "neutral"}>{t(`fit.summary.feel.${l.perceived}`)}</Badge>
											{l.adaptations.length > 0 && <span>{t("fit.progress.adaptedCount", { n: l.adaptations.length })}</span>}
										</p>
									</div>
								</details>
							</li>
						))}
					</ul>
				</section>
			))}
		</>
	);
}
