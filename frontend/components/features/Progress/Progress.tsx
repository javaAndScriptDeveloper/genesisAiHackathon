"use client";

import { Analytics01Icon, ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";
import { Awards } from "@/components/features/Awards/Awards";
import { CheckIns } from "@/components/features/CheckIns/CheckIns";
import { History } from "@/components/features/History/History";
import { fmtShort } from "@/components/features/ProgressCalendar/format";
import { ProgressHighlights } from "@/components/features/ProgressHighlights/ProgressHighlights";
import { ProgressLevelBar } from "@/components/features/ProgressLevelBar/ProgressLevelBar";
import { ProgressNavList, type ProgressNavItem } from "@/components/features/ProgressNavList/ProgressNavList";
import { ProgressScoreCards } from "@/components/features/ProgressScoreCards/ProgressScoreCards";
import { ProgressWeekGoal } from "@/components/features/ProgressWeekGoal/ProgressWeekGoal";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { WeekBars } from "@/components/features/WeekBars/WeekBars";
import { Icon, IconButton, SegmentedControl, Skeleton, useToast } from "@/components/ui";
import { kcalFor } from "@/lib/fit/calories";
import { addDays, mondayOf, weekdayIndex } from "@/lib/fit/dates";
import { useShare } from "@/lib/hooks/useShare";
import { nextUpcoming } from "@/lib/fit/plan";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgress, useProgressAnalytics, useStartWorkout, useUnits } from "@/lib/fit/store/hooks";
import { useTabMemory } from "@/lib/fit/store/useTabMemory";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { nextBadges, recentBadges } from "@/lib/progress/badges";
import { mainAction, newRecords, unseenReportWeek, weekDayStates } from "@/lib/progress/mainScreen";
import { weeklyReportV2 } from "@/lib/progress/report";
import styles from "./Progress.module.scss";

type Tab = "overview" | "history" | "awards" | "checkins";

/** Progress screen: the team's four tabs; Overview holds the weekly goal, consistency and streak, level and achievements, highlights and sub-screen links. */
export function Progress() {
	const { t } = useI18n();
	const router = useRouter();
	const { ready } = useFit();
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
				{tab === "overview" && (ready ? <Overview /> : <OverviewSkeleton />)}
				{tab === "history" && <History />}
				{tab === "awards" && <Awards />}
				{tab === "checkins" && <CheckIns />}
			</div>
		</div>
	);
}

function Overview() {
	const { t, locale } = useI18n();
	const router = useRouter();
	const u = useUnits();
	const { state, today } = useFit();
	const p = useProgress();
	const { reportWeeks } = useProgressAnalytics();
	const start = useStartWorkout();
	const toast = useToast();
	const shareWith = useShare();
	const nf = new Intl.NumberFormat(locale);
	const events = state.progressEvents;

	const next = nextUpcoming(state.planned, today);
	const onStart = next ? () => start(next.id) : undefined;
	const openCalendar = () => router.push("/progress/calendar", { transitionTypes: ["nav-forward"] });

	const reportWeek = unseenReportWeek(events, today);

	// This week per day: training minutes and estimated calories from the logged sessions.
	const monday = mondayOf(today);
	const weekLogs = Array.from({ length: 7 }, (_, i) => state.history.filter((l) => l.date === addDays(monday, i)));
	const dayMinutes = weekLogs.map((logs) => Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60));
	const dayKcal = weekLogs.map((logs) => logs.reduce((n, l) => n + kcalFor(l.exercises.filter((e) => !e.skipped).map((e) => e.exerciseId), state.profile?.weightKg ?? 70, l.durationSec / 60), 0));

	const share = () => shareWith(t("fit.progress.shareTitle"), t("fit.progress.shareText", { done: p.week.quality, planned: p.week.goal, streak: p.streak.current, level: p.level.level }), { headline: t("fit.nudges.streakHeadline"), value: String(p.streak.current), line: t("fit.nudges.streakLine") });
	const report = useMemo(() => (reportWeek ? weeklyReportV2(p.history, p.ctx, reportWeek) : null), [p.history, p.ctx, reportWeek]);
	const latestReport = reportWeeks[0] ?? null;
	const fresh = p.history.sessions.length === 0;
	const unlocked = p.badges.filter((b) => b.unlocked).length;
	const lastWeight = p.history.body.at(-1);

	const nav: ProgressNavItem[] = [
		{ id: "calendar", href: "/progress/calendar", hint: t("fit.progress.main.nav.calendarHint") },
		{ id: "weight", href: "/progress/weight", hint: lastWeight ? u.fmtMass(lastWeight.weightKg, 1) : t("fit.progress.main.nav.weightHint") },
		{
			id: "report",
			href: latestReport ? `/progress/week/${latestReport}` : null,
			hint: latestReport ? t("fit.progress.main.nav.reportHint", { date: fmtShort(latestReport, locale) }) : t("fit.progress.main.nav.reportNone"),
			mark: reportWeek ? t("fit.progress.main.nav.new") : undefined,
		},
		{
			id: "achievements",
			href: "/progress/achievements",
			hint: t("fit.progress.main.nav.achievementsHint", { n: nf.format(unlocked), total: nf.format(p.badges.length) }),
			mark: p.unseen.byKind.badge > 0 ? t("fit.progress.main.nav.newCount", { n: nf.format(p.unseen.byKind.badge) }) : undefined,
		},
	];

	return (
		<>

			{reportWeek && report && (
				<Link href={`/progress/week/${reportWeek}`} transitionTypes={["nav-forward"]} className={styles.report}>
					<span className={styles.reportIcon}>
						<Icon icon={Analytics01Icon} size={22} />
					</span>
					<span className={styles.reportText}>
						<strong>{t("fit.progress.main.report.title")}</strong>
						<span>{t(report.pushText.key, { done: nf.format(report.pushText.params.done), goal: nf.format(report.pushText.params.goal), streak: nf.format(report.pushText.params.streak) })}</span>
					</span>
					<span className={styles.reportOpen}>
						{t("fit.progress.main.report.open")}
						<Icon icon={ArrowRight01Icon} size={16} />
					</span>
				</Link>
			)}

			<ProgressWeekGoal
				days={weekDayStates(p.week.days, today)}
				done={p.week.quality}
				goal={p.week.goal}
				paused={p.weekPaused}
				month={today.slice(0, 7)}
				today={today}
				onStart={onStart}
			/>

			<section className={styles.week} aria-labelledby="progress-this-week">
				<h2 id="progress-this-week" className={styles.h2}>
					{t("fit.progress.thisWeek")}
				</h2>
				<div className={styles.grid2}>
					<WeekBars title={t("fit.progress.time")} unit={t("fit.common.minShort")} values={dayMinutes} todayIndex={weekdayIndex(today)} tone="neutral" sport="stopwatch" />
					<WeekBars title={t("fit.progress.calories")} unit="kcal" values={dayKcal} todayIndex={weekdayIndex(today)} tone="accent" sport="flame" />
				</div>
			</section>

			<ProgressScoreCards fresh={fresh} consistency={p.consistency} streak={p.streak} onShare={share} />

			<ProgressLevelBar level={p.level} next={nextBadges(p.badges, 3)} recent={recentBadges(p.badges, 3)} newLevel={p.unseen.byKind.level > 0} />

			<ProgressHighlights
				exercises={p.history.exercises}
				improvements={p.improvements.slice(0, 2)}
				advice={p.advice}
				action={mainAction(p.advice, !!next)}
				onStart={() => onStart?.()}
				onCalendar={openCalendar}
				records={newRecords(p.records, events, 2)}
				allRecords={p.records}
			/>

			<ProgressNavList items={nav} />
		</>
	);
}

function OverviewSkeleton() {
	return (
		<>
			<Skeleton height="20rem" />
			<div className={styles.grid2}>
				<Skeleton height="14rem" />
				<Skeleton height="14rem" />
			</div>
			<Skeleton height="18rem" />
			<Skeleton height="12rem" />
			<Skeleton height="36rem" />
		</>
	);
}
