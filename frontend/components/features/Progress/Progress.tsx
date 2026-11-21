"use client";

import { ArrowRight01Icon, Calendar03Icon, Clock01Icon, Dumbbell01Icon, FireIcon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Awards } from "@/components/features/Awards/Awards";
import { CheckIns } from "@/components/features/CheckIns/CheckIns";
import { History } from "@/components/features/History/History";
import { BarChart, LineChart } from "@/components/features/Charts/Charts";
import { ProgressInsights } from "@/components/features/ProgressInsights/ProgressInsights";
import { PremiumGate, usePremium } from "@/components/features/PremiumGate/PremiumGate";
import { WeekBars } from "@/components/features/WeekBars/WeekBars";
import { TrainingInsight } from "@/components/features/TrainingInsight/TrainingInsight";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Stat } from "@/components/features/Stat/Stat";
import { AnimatedNumber, Badge, Card, Icon, IconButton, ProgressBar, ProgressRing, SegmentedControl } from "@/components/ui";
import { addDays, formatMonthDay, mondayOf, weekdayIndex, WEEKDAYS } from "@/lib/fit/dates";
import { kcalFor } from "@/lib/fit/calories";
import { getExercise } from "@/lib/fit/exercises";
import { historyByWeek } from "@/lib/fit/stats";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useFitStats, useProgressAnalytics, useUnits } from "@/lib/fit/store/hooks";
import { useTabMemory } from "@/lib/fit/store/useTabMemory";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Progress.module.scss";

type Tab = "overview" | "history" | "awards" | "checkins";
export function Progress() {
	const t = useT();
	const router = useRouter();
	const [tab, setTab] = useTabMemory<Tab>("progress.tab", "overview");
	return (
		<div className={styles.root}>
			<ScreenHeader
				title={t("fit.progress.title")}
				actions={<IconButton icon={Calendar03Icon} label={t("fit.progress.calendar.screenTitle")} onClick={() => router.push("/progress/calendar", { transitionTypes: ["nav-forward"] })} />}
			/>
			<div className={styles.content}>
				<SegmentedControl
					label={t("fit.progress.title")}
					value={tab}
					onChange={setTab}
					options={[
						{ id: "overview", label: t("fit.progress.overview") },
						{ id: "history", label: t("fit.progress.history") },
						{ id: "awards", label: t("fit.progress.awards") },
						{ id: "checkins", label: t("fit.progress.checkins") },
					]}
				/>
				{tab === "overview" && <Overview />}
				{tab === "history" && <History />}
				{tab === "awards" && <Awards />}
				{tab === "checkins" && <CheckIns />}
			</div>
		</div>
	);
}

function Overview() {
	const t = useT();
	const u = useUnits();
	const { state, today } = useFit();
	const stats = useFitStats();
	const { insights, consistencyDelta } = useProgressAnalytics();
	const [period, setPeriod] = useState<"week" | "month">("week");
	const premium = usePremium();

	const month = (() => {
		const start = addDays(today, -27);
		const logs = state.history.filter((l) => l.date >= start);
		const plan = state.planned.filter((w) => !w.adHoc && w.date >= start && (w.date < today || w.status !== "planned"));
		return { planned: plan.length, done: plan.filter((w) => w.status === "completed" || w.status === "partial").length, minutes: Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60), volume: logs.reduce((n, l) => n + l.volumeKg, 0) };
	})();
	// This week: the weekly goal from lib/progress (quality workouts / goal). Last 4 weeks: the plan (done / planned).
	const view = period === "week" ? { planned: stats.goal.target, done: stats.goal.done, minutes: stats.week.minutes, volume: stats.week.volume } : month;

	const weeks = historyByWeek(state.history, today, 6);
	const monday = mondayOf(today);
	const weekLogs = Array.from({ length: 7 }, (_, i) => state.history.filter((l) => l.date === addDays(monday, i)));
	const dayMinutes = weekLogs.map((logs) => Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60));
	const dayKcal = weekLogs.map((logs) => logs.reduce((n, l) => n + kcalFor(l.exercises.filter((e) => !e.skipped).map((e) => e.exerciseId), state.profile?.weightKg ?? 70, l.durationSec / 60), 0));
	const weights = state.bodyWeights.slice(-6).map((b) => ({ label: formatMonthDay(b.date), value: u.mass(b.kg, 1) }));

	// Calendar: last 5 weeks as a grid of planned/completed days, built from the same planned sessions as everywhere else.
	const gridStart = addDays(mondayOf(today), -28);
	const cells = Array.from({ length: 35 }, (_, i) => addDays(gridStart, i));

	// Strongest progression: the exercise with the most logged loaded sessions.
	const byExercise = new Map<string, { date: string; kg: number }[]>();
	for (const log of [...state.history].sort((a, b) => a.date.localeCompare(b.date))) {
		for (const e of log.exercises) {
			const best = Math.max(0, ...e.sets.map((s) => s.weight ?? 0));
			if (best > 0) byExercise.set(e.exerciseId, [...(byExercise.get(e.exerciseId) ?? []), { date: log.date, kg: best }]);
		}
	}
	const top = [...byExercise.entries()].sort((a, b) => b[1].length - a[1].length)[0];
	const muscleVolume = new Map<string, number>();
	for (const log of state.history) for (const e of log.exercises) muscleVolume.set(getExercise(e.exerciseId).muscle, (muscleVolume.get(getExercise(e.exerciseId).muscle) ?? 0) + e.sets.length);
	const muscleTotal = [...muscleVolume.values()].reduce((a, b) => a + b, 0) || 1;


	return (
		<>
			<SegmentedControl label={t("fit.progress.period")} value={period} onChange={setPeriod} options={[{ id: "week", label: t("fit.progress.thisWeek") }, { id: "month", label: t("fit.progress.last4") }]} />
			<div className={styles.grid2}>
				<Stat label={t("fit.progress.sessions")} value={<><AnimatedNumber value={view.done} />/<AnimatedNumber value={view.planned} /></>} hint={period === "week" ? t("fit.progress.ofWeeklyGoal") : t("fit.progress.completedVsPlanned")} icon={<Icon icon={Calendar03Icon} size={14} />} />
				<Stat label={t("fit.progress.time")} value={view.minutes} hint={t("fit.common.minShort")} icon={<Icon icon={Clock01Icon} size={14} />} />
				<Stat label={t("fit.progress.volume")} value={u.mass(view.volume)} hint={u.unit} icon={<Icon icon={Dumbbell01Icon} size={14} />} />
				<Stat label={t("fit.progress.streakLabel")} value={stats.streak.current} hint={t("fit.progress.longest", { n: stats.streak.longest })} icon={<Icon icon={FireIcon} size={14} />} />
			</div>

			<Card className={styles.row}>
				<ProgressRing value={stats.consistency ?? 0} label={t("fit.progress.consistency")} size={84}>
					<strong>{stats.consistency === null ? "–" : <AnimatedNumber value={stats.consistency} suffix="%" />}</strong>
				</ProgressRing>
				<div>
					<div className={styles.rowHead}>
						<h3>{t("fit.progress.consistency")}</h3>
						{consistencyDelta !== null && consistencyDelta !== 0 && (
							<Badge tone={consistencyDelta > 0 ? "success" : "neutral"}>{t("fit.progress.consistencyDelta", { sign: consistencyDelta > 0 ? "+" : "−", n: Math.abs(consistencyDelta) })}</Badge>
						)}
					</div>
					<p>{stats.consistency === null ? t("fit.progress.consistencyEmpty") : t("fit.progress.consistencyBody")}</p>
				</div>
			</Card>

			<TrainingInsight />

			<div className={styles.grid2}>
				<WeekBars title={t("fit.progress.time")} unit={t("fit.common.minShort")} values={dayMinutes} todayIndex={weekdayIndex(today)} tone="neutral" sport="stopwatch" />
				<WeekBars title={t("fit.progress.calories")} unit="kcal" values={dayKcal} todayIndex={weekdayIndex(today)} tone="accent" sport="flame" />
			</div>

			{insights.length > 0 && <ProgressInsights insights={insights} fallback="" />}

			<Card>
				<h3 className={styles.h3}>{t("fit.progress.weeklyVolume")}</h3>
				{state.history.length === 0 ? <p className={styles.p}>{t("fit.progress.noData")}</p> : <BarChart data={weeks.map((w) => ({ label: w.label, value: u.mass(w.volume) }))} label={t("fit.progress.weeklyVolume")} unit={` ${u.unit}`} />}
			</Card>

			<Link href="/progress/calendar" transitionTypes={["nav-forward"]} className={styles.calLink} aria-label={t("fit.progress.calendar.openAria")}>
				<Card interactive>
					<div className={styles.calTitle}>
						<h3 className={styles.h3}>{t("fit.progress.calendar.title")}</h3>
						<span className={styles.calOpen}>
							{t("fit.progress.calendar.open")}
							<Icon icon={ArrowRight01Icon} size={16} />
						</span>
					</div>
					<div className={styles.cal} aria-hidden>
						{WEEKDAYS.map((d) => <span key={d} className={styles.calHead}>{d[0]}</span>)}
						{cells.map((d) => {
							const w = state.planned.find((p) => p.date === d && !p.adHoc);
							const st = !w ? "rest" : w.status === "completed" ? "done" : w.status === "partial" ? "partial" : w.status === "skipped" ? "skipped" : d < today ? "missed" : "planned";
							return <span key={d} className={styles.calCell} data-state={st} data-today={d === today || undefined}>{Number(d.slice(8))}</span>;
						})}
					</div>
					<ul className={styles.legend} aria-hidden>
						{(["done", "partial", "planned", "skipped", "missed"] as const).map((s) => <li key={s}><span className={styles.legendDot} data-state={s} />{t(`fit.week.state.${s}`)}</li>)}
					</ul>
				</Card>
			</Link>

			<Link href="/progress/weight" transitionTypes={["nav-forward"]} className={styles.calLink} aria-label={t("fit.progress.weight.screenTitle")}>
				<Card>
					<h3 className={styles.h3}>{t("fit.progress.bodyWeight")}</h3>
					{weights.length < 2 ? <p className={styles.p}>{t("fit.progress.weightNeedMore")}</p> : <LineChart data={weights} label={t("fit.progress.bodyWeight")} unit={` ${u.unit}`} goal={state.goalWeightKg ? u.mass(state.goalWeightKg, 1) : undefined} goalLabel={t("fit.progress.goal")} />}
				</Card>
			</Link>

			<PremiumGate title={t("fit.progress.insightsLockedTitle")} body={t("fit.progress.insightsLockedBody")} source="insights">
				<Card>
					<h3 className={styles.h3}>{t("fit.progress.strength")}</h3>
					{top ? (
						<>
							<p className={styles.p}>{getExercise(top[0]).name}</p>
							<LineChart data={top[1].slice(-6).map((p) => ({ label: formatMonthDay(p.date), value: u.load(p.kg) }))} label={t("fit.progress.strength")} unit={` ${u.unit}`} />
						</>
					) : <p className={styles.p}>{t("fit.progress.noData")}</p>}
					<h3 className={styles.h3}>{t("fit.progress.muscles")}</h3>
					<ul className={styles.muscles}>
						{[...muscleVolume.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => (
							<li key={m}><span>{t(`fit.muscle.${m}`)}</span><ProgressBar value={(n / muscleTotal) * 100} label={t(`fit.muscle.${m}`)} tone="neutral" /><span>{Math.round((n / muscleTotal) * 100)}%</span></li>
						))}
					</ul>
					{premium && <Badge tone="success">{t("fit.progress.premiumActive")}</Badge>}
				</Card>
			</PremiumGate>
		</>
	);
}
