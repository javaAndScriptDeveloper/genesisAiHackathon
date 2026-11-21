"use client";

import { Alert02Icon, CheckmarkCircle02Icon, Clock01Icon, Dumbbell01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Badge, Icon, Sheet } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CalendarDayState, DayDetails } from "@/lib/progress/calendar";
import { fmtDay } from "../format";
import styles from "./DaySheet.module.scss";

const TONE: Record<CalendarDayState, "neutral" | "accent" | "success" | "warning" | "danger"> = {
	"training-done": "success",
	"rest-credited": "success",
	rest: "neutral",
	missed: "danger",
	paused: "neutral",
	planned: "neutral",
	today: "accent",
	none: "neutral",
};

export function DaySheet({ details, onClose }: { details: DayDetails | null; onClose: () => void }) {
	const { t, locale } = useI18n();
	const d = details;
	return (
		<Sheet open={d !== null} onClose={onClose} title={d ? fmtDay(d.date, locale) : ""} closeLabel={t("common.close")}>
			{d && (
				<div className={styles.root}>
					<div className={styles.badges}>
						<Badge tone={TONE[d.state]}>{t(`fit.progress.calendar.state.${d.state}`)}</Badge>
						{d.planned && <Badge>{t(d.planned === "workout" ? "fit.progress.calendar.day.workoutPlanned" : "fit.progress.calendar.day.restPlanned")}</Badge>}
					</div>

					{d.paused && <p className={styles.p}>{t("fit.progress.calendar.day.paused")}</p>}

					{d.sessions.map((s) => (
						<section key={s.id} className={styles.session}>
							<div className={styles.meta}>
								<span>
									<Icon icon={Clock01Icon} size={16} />
									{t("fit.progress.calendar.day.minutes", { n: s.minutes })}
								</span>
								<span>
									<Icon icon={Dumbbell01Icon} size={16} />
									{t("fit.progress.calendar.day.sets", { done: s.completedSets, planned: s.plannedSets })}
								</span>
							</div>
							<p className={styles.quality} data-ok={s.quality || undefined}>
								<Icon icon={s.quality ? CheckmarkCircle02Icon : InformationCircleIcon} size={16} />
								{t(!s.planned ? "fit.progress.calendar.day.extra" : s.quality ? "fit.progress.calendar.day.quality" : "fit.progress.calendar.day.notQuality")}
							</p>
							{s.exercises.length > 0 && (
								<ul className={styles.list}>
									{s.exercises.map((e) => (
										<li key={e.id}>
											<span>{e.name}</span>
											<span className={styles.sub}>{t("fit.progress.calendar.day.setsShort", { n: e.sets })}</span>
										</li>
									))}
								</ul>
							)}
						</section>
					))}

					{d.missed && (
						<p className={styles.quality}>
							<Icon icon={Alert02Icon} size={16} />
							{t("fit.progress.calendar.day.missed")}
						</p>
					)}
					{d.planned === "workout" && d.future && <p className={styles.p}>{t("fit.progress.calendar.day.upcoming")}</p>}

					{d.rest && !d.paused && (
						<section className={styles.session}>
							<strong>{t(d.rest.credited ? "fit.progress.calendar.day.restCredited" : "fit.progress.calendar.day.restNotCredited")}</strong>
							<p className={styles.p}>{t(`fit.progress.calendar.day.reason.${d.rest.reason}`, { date: d.rest.nearest ? fmtDay(d.rest.nearest, locale) : "" })}</p>
						</section>
					)}

					{d.planned === null && d.sessions.length === 0 && <p className={styles.p}>{t("fit.progress.calendar.day.nothingPlanned")}</p>}
				</div>
			)}
		</Sheet>
	);
}
