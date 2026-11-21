"use client";

import { useMemo, useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Skeleton } from "@/components/ui";
import { useProgressCalendar } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import { calendarMonth, dayDetails, isValidMonth, monthOf, shiftMonth, weekDetails } from "@/lib/progress/calendar";
import { consistencyV2, streakV2 } from "@/lib/progress/consistency";
import type { IsoDate } from "@/lib/progress/types";
import { CalendarGrid } from "./CalendarGrid/CalendarGrid";
import { DaySheet } from "./DaySheet/DaySheet";
import { PauseCard } from "./PauseCard/PauseCard";
import { ScoreBreakdown } from "./ScoreBreakdown/ScoreBreakdown";
import { StreakCard } from "./StreakCard/StreakCard";
import { WeekSheet } from "./WeekSheet/WeekSheet";
import styles from "./ProgressCalendar.module.scss";

const monthIndex = (m: string): number => {
	const [y = 0, mo = 1] = m.split("-").map(Number);
	return y * 12 + mo - 1;
};

/** Interactive training calendar: month grid with day/week sheets, streak, "how the score was built" and pause. */
export function ProgressCalendar({ initialMonth }: { initialMonth?: string }) {
	const t = useT();
	const { history, ctx, today, ready, pauses } = useProgressCalendar();
	const thisMonth = monthOf(today);
	// Months relative to the current one, so "Today" is offset 0 and a new day keeps the view stable.
	const [offset, setOffset] = useState(() => (initialMonth && isValidMonth(initialMonth) ? monthIndex(initialMonth) - monthIndex(monthOf(today)) : 0));
	const [dir, setDir] = useState<-1 | 0 | 1>(0);
	const [day, setDay] = useState<IsoDate | null>(null);
	const [week, setWeek] = useState<IsoDate | null>(null);
	const month = shiftMonth(thisMonth, offset);

	const data = useMemo(() => calendarMonth(history, ctx, month), [history, ctx, month]);
	const streak = useMemo(() => streakV2(history, ctx), [history, ctx]);
	const consistency = useMemo(() => consistencyV2(history, ctx), [history, ctx]);
	const dayInfo = useMemo(() => (day ? dayDetails(history, ctx, day) : null), [history, ctx, day]);
	const weekInfo = useMemo(() => (week ? weekDetails(history, ctx, week) : null), [history, ctx, week]);
	const noWorkouts = history.sessions.length === 0;

	const go = (delta: -1 | 1) => {
		setDir(delta);
		setOffset((o) => o + delta);
	};

	return (
		<div className={styles.root}>
			<ScreenHeader title={t("fit.progress.calendar.screenTitle")} subtitle={t("fit.progress.calendar.screenSubtitle")} back="/progress" />
			<div className={styles.content}>
				{!ready ? (
					<CalendarSkeleton />
				) : (
					<>
						<CalendarGrid
							data={data}
							today={today}
							dir={dir}
							isCurrentMonth={offset === 0}
							onPrev={() => go(-1)}
							onNext={() => go(1)}
							onToday={() => {
								setDir(offset > 0 ? -1 : 1);
								setOffset(0);
							}}
							onDay={setDay}
							onWeek={setWeek}
						/>
						<StreakCard current={streak.current} best={streak.best} empty={noWorkouts} />
						<ScoreBreakdown score={noWorkouts ? null : consistency.score} weeks={consistency.weeks} onWeek={setWeek} />
						<PauseCard pauses={pauses} today={today} />
					</>
				)}
			</div>
			<DaySheet details={dayInfo} onClose={() => setDay(null)} />
			<WeekSheet details={weekInfo} onClose={() => setWeek(null)} />
		</div>
	);
}

function CalendarSkeleton() {
	return (
		<div className={styles.skeleton} aria-hidden>
			<Skeleton height="4.4rem" />
			{Array.from({ length: 6 }, (_, i) => (
				<Skeleton key={i} height="4.4rem" />
			))}
			<Skeleton height="12rem" />
			<Skeleton height="16rem" />
		</div>
	);
}
