"use client";

import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, CircleIcon, Moon02Icon, PauseIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useMemo, useRef, type PointerEvent } from "react";
import { Button, Icon, IconButton, type IconDefinition } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { CalendarDayState, CalendarMonth, CalendarWeekSummary } from "@/lib/progress/calendar";
import { weekStart } from "@/lib/progress/dates";
import type { IsoDate } from "@/lib/progress/types";
import { fmtDay, fmtMonth, fmtShort, fmtWeekdays } from "../format";
import styles from "./CalendarGrid.module.scss";

const SWIPE_PX = 50;

export const STATE_ICON: Partial<Record<CalendarDayState, IconDefinition>> = {
	"training-done": Tick02Icon,
	"rest-credited": Moon02Icon,
	missed: Cancel01Icon,
	paused: PauseIcon,
};

const LEGEND: CalendarDayState[] = ["training-done", "rest-credited", "missed", "paused", "planned", "today"];

type WeekMark = "credited" | "paused" | "current" | "none" | "future";

function weekMark(w: CalendarWeekSummary, future: boolean): WeekMark {
	if (w.paused) return "paused";
	if (w.credited) return "credited";
	if (w.current) return "current";
	return future ? "future" : "none";
}

const WEEK_ICON: Partial<Record<WeekMark, IconDefinition>> = { credited: Tick02Icon, paused: PauseIcon, current: CircleIcon };

interface CalendarGridProps {
	data: CalendarMonth;
	today: IsoDate;
	/** -1 when the user went back, 1 forward; drives the slide direction. */
	dir: -1 | 0 | 1;
	isCurrentMonth: boolean;
	onPrev: () => void;
	onNext: () => void;
	onToday: () => void;
	onDay: (date: IsoDate) => void;
	onWeek: (weekStart: IsoDate) => void;
}

export function CalendarGrid({ data, today, dir, isCurrentMonth, onPrev, onNext, onToday, onDay, onWeek }: CalendarGridProps) {
	const { t, locale } = useI18n();
	const weekdays = useMemo(() => fmtWeekdays(locale), [locale]);
	const start = useRef<{ x: number; y: number } | null>(null);
	const swiped = useRef(false);

	const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		start.current = { x: e.clientX, y: e.clientY };
		swiped.current = false;
	};
	const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
		const s = start.current;
		start.current = null;
		if (!s) return;
		const dx = e.clientX - s.x;
		const dy = e.clientY - s.y;
		if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
		swiped.current = true; // swallow the click that follows the swipe
		if (dx < 0) onNext();
		else onPrev();
	};

	const thisMonday = weekStart(today);

	return (
		<section className={styles.root} aria-label={t("fit.progress.calendar.title")}>
			<div className={styles.nav}>
				<IconButton icon={ArrowLeft01Icon} label={t("fit.progress.calendar.prevMonth")} onClick={onPrev} />
				<h2 className={styles.month} aria-live="polite">
					{fmtMonth(data.month, locale)}
				</h2>
				<IconButton icon={ArrowRight01Icon} label={t("fit.progress.calendar.nextMonth")} onClick={onNext} />
				<Button size="sm" variant="secondary" onClick={onToday} disabled={isCurrentMonth} className={styles.todayBtn}>
					{t("fit.progress.calendar.today")}
				</Button>
			</div>

			<div
				className={styles.grid}
				onPointerDown={onPointerDown}
				onPointerUp={onPointerUp}
				onPointerCancel={() => (start.current = null)}
				onClickCapture={(e) => {
					if (!swiped.current) return;
					swiped.current = false;
					e.stopPropagation();
					e.preventDefault();
				}}
			>
				<div className={styles.head} aria-hidden>
					{weekdays.map((d) => (
						<span key={d}>{d}</span>
					))}
					<span>{t("fit.progress.calendar.weekCol")}</span>
				</div>
				<div key={data.month} className={styles.body} data-dir={dir}>
					{data.weeks.map((w) => {
						const mark = weekMark(w.week, w.weekStart > thisMonday);
						const markIcon = WEEK_ICON[mark];
						return (
							<div key={w.weekStart} className={styles.row}>
								{w.days.map((d) => {
									const icon = STATE_ICON[d.state];
									const label = t("fit.progress.calendar.dayAria", {
										date: fmtDay(d.date, locale),
										state: d.isToday && d.state !== "today" ? `${t(`fit.progress.calendar.state.${d.state}`)}, ${t("fit.progress.calendar.todaySuffix")}` : t(`fit.progress.calendar.state.${d.state}`),
									});
									return (
										<button
											key={d.date}
											type="button"
											className={styles.day}
											data-outside={!d.inMonth || undefined}
											data-state={d.state}
											data-today={d.isToday || undefined}
											aria-label={label}
											aria-current={d.isToday ? "date" : undefined}
											onClick={() => onDay(d.date)}
										>
											<span className={styles.num}>{Number(d.date.slice(8))}</span>
											{icon && <Icon icon={icon} size={10} strokeWidth={2.5} className={styles.mark} />}
										</button>
									);
								})}
								<button
									type="button"
									className={styles.week}
									data-mark={mark}
									aria-label={t("fit.progress.calendar.weekAria", { date: fmtShort(w.weekStart, locale), status: t(`fit.progress.calendar.weekMark.${mark}`) })}
									onClick={() => onWeek(w.weekStart)}
								>
									{markIcon && <Icon icon={markIcon} size={mark === "current" ? 8 : 16} strokeWidth={2.5} />}
								</button>
							</div>
						);
					})}
				</div>
			</div>

			<ul className={styles.legend}>
				{LEGEND.map((s) => {
					const icon = STATE_ICON[s];
					return (
						<li key={s}>
							<span className={styles.swatch} data-state={s} aria-hidden>
								{icon && <Icon icon={icon} size={9} strokeWidth={2.5} />}
							</span>
							{t(`fit.progress.calendar.legend.${s}`)}
						</li>
					);
				})}
			</ul>
			<p className={styles.note}>{t("fit.progress.calendar.legendNote")}</p>
		</section>
	);
}
