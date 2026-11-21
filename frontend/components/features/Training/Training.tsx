"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { WeekStrip } from "@/components/features/WeekStrip/WeekStrip";
import { WorkoutCard } from "@/components/features/WorkoutCard/WorkoutCard";
import { Badge, Button, Card, Checkbox, EmptyState, Icon, IconButton, Input, SegmentedControl } from "@/components/ui";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { addDays, mondayOf, formatMonthDay } from "@/lib/fit/dates";
import { scrollToCenter } from "@/lib/hooks/useSlidingIndicator";
import { EXERCISES, isUsable } from "@/lib/fit/exercises";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useTabMemory } from "@/lib/fit/store/useTabMemory";
import type { Muscle } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Training.module.scss";

const MUSCLES: Muscle[] = ["chest", "back", "legs", "glutes", "shoulders", "arms", "core", "cardio", "mobility"];

export function Training() {
	const t = useT();
	const { state, today } = useFit();
	const [tab, setTab] = useTabMemory<"plan" | "library">("training.tab", "plan");
	const [offset, setOffset] = useState(0);
	const [query, setQuery] = useState("");
	const [muscle, setMuscle] = useState<Muscle | "all">("all");
	const [onlyMine, setOnlyMine] = useState(true);
	const profile = state.profile;

	const start = addDays(mondayOf(today), offset * 7);
	const end = addDays(start, 6);
	const week = state.planned.filter((w) => w.date >= start && w.date <= end).sort((a, b) => a.date.localeCompare(b.date));

	const library = useMemo(() => {
		if (!profile) return [];
		const q = query.trim().toLowerCase();
		return EXERCISES.filter((e) => (muscle === "all" || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)) && (!onlyMine || isUsable(e, profile)));
	}, [query, muscle, onlyMine, profile]);

	if (!profile) return null;

	return (
		<div className={styles.root}>
			<ScreenHeader title={t("fit.training.title")} subtitle={t("fit.training.subtitle")} />
			<div className={styles.content}>
				<SegmentedControl
					label={t("fit.training.title")}
					value={tab}
					onChange={setTab}
					options={[
						{ id: "plan", label: t("fit.training.plan") },
						{ id: "library", label: t("fit.training.library") },
					]}
				/>

				{tab === "plan" ? (
					<>
						<div className={styles.weekNav}>
							<IconButton icon={ArrowLeft01Icon} label={t("fit.training.prevWeek")} onClick={() => setOffset(offset - 1)} />
							<strong>
								{offset === 0 ? t("fit.training.thisWeek") : `${formatMonthDay(start)} – ${formatMonthDay(end)}`}
							</strong>
							<IconButton icon={ArrowRight01Icon} label={t("fit.training.nextWeek")} onClick={() => setOffset(offset + 1)} />
						</div>
						<WeekStrip planned={state.planned} today={today} weekOffset={offset} />
						{week.length === 0 ? (
							<EmptyState title={t("fit.training.emptyWeek")} description={t("fit.training.emptyWeekBody")} />
						) : (
							<ul className={styles.list}>
								{week.map((w) => (
									<li key={w.id}>
										<WorkoutCard workout={w} />
									</li>
								))}
							</ul>
						)}
						<Card className={styles.plain}>
							<p>{t("fit.training.recoveryNote")}</p>
							<Link href="/profile/edit" className={styles.link}>{t("fit.training.editPlan")}</Link>
						</Card>
					</>
				) : (
					<>
						<div className={styles.search}>
							<Input label={t("fit.training.search")} placeholder={t("fit.training.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
							<Icon icon={Search01Icon} size={18} className={styles.searchIcon} />
						</div>
						<div className={styles.chips} role="group" aria-label={t("fit.training.filterMuscle")}>
							{(["all", ...MUSCLES] as const).map((m) => (
								<button key={m} type="button" className={styles.chip} aria-pressed={muscle === m} onClick={(e) => {
										setMuscle(m);
										const strip = e.currentTarget.parentElement;
										if (strip) scrollToCenter(strip, e.currentTarget);
									}}>
									{t(`fit.muscle.${m}`)}
								</button>
							))}
						</div>
						<Checkbox label={t("fit.training.onlyMine")} checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
						{library.length === 0 ? (
							<EmptyState title={t("fit.training.noResults")} description={t("fit.training.noResultsBody")} action={<Button variant="secondary" onClick={() => { setQuery(""); setMuscle("all"); setOnlyMine(false); }}>{t("fit.training.clearFilters")}</Button>} />
						) : (
							<ul className={styles.list}>
								{library.map((e) => (
									<li key={e.id}>
										<Link href={`/training/exercise/${e.id}`} transitionTypes={["nav-forward"]} className={styles.exercise}>
											<span className={styles.exName}>{e.name}</span>
											<span className={styles.exMeta}>
												<Badge>{t(`fit.muscle.${e.muscle}`)}</Badge>
												<Badge tone={e.level === 1 ? "success" : e.level === 2 ? "warning" : "danger"}>{t(`fit.level.${e.level}`)}</Badge>
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</>
				)}
			</div>
		</div>
	);
}
