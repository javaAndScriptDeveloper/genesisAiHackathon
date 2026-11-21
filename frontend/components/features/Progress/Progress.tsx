"use client";

import { ArrowDown01Icon, Calendar03Icon, Camera01Icon, Clock01Icon, Dumbbell01Icon, FireIcon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { AchievementBadge } from "@/components/features/AchievementBadge/AchievementBadge";
import { BarChart, LineChart } from "@/components/features/Charts/Charts";
import { PremiumGate, usePremium } from "@/components/features/PremiumGate/PremiumGate";
import { TrainingInsight } from "@/components/features/TrainingInsight/TrainingInsight";
import { Notice } from "@/components/features/Notice/Notice";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Stat } from "@/components/features/Stat/Stat";
import { AnimatedNumber, Badge, Button, Card, EmptyState, Icon, Input, ProgressBar, ProgressRing, SegmentedControl, Sheet, useToast } from "@/components/ui";
import { addDays, formatDay, formatMonthDay, mondayOf, WEEKDAYS } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { ACHIEVEMENTS } from "@/lib/fit/gamification";
import { shareText } from "@/lib/fit/share";
import { historyByWeek } from "@/lib/fit/stats";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useFitStats, useUnits } from "@/lib/fit/store/hooks";
import { useTabMemory } from "@/lib/fit/store/useTabMemory";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Progress.module.scss";

type Tab = "overview" | "history" | "awards" | "checkins";
const FREE_PHOTOS = 3;

function resizeToDataUrl(file: File, max = 480): Promise<string> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			const scale = Math.min(1, max / Math.max(img.width, img.height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(img.width * scale);
			canvas.height = Math.round(img.height * scale);
			canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
			URL.revokeObjectURL(url);
			resolve(canvas.toDataURL("image/jpeg", 0.72));
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error("image"));
		};
		img.src = url;
	});
}

export function Progress() {
	const t = useT();
	const [tab, setTab] = useTabMemory<Tab>("progress.tab", "overview");
	return (
		<div className={styles.root}>
			<ScreenHeader title={t("fit.progress.title")} subtitle={t("fit.progress.subtitle")} />
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
	const [period, setPeriod] = useState<"week" | "month">("week");
	const premium = usePremium();

	const month = (() => {
		const start = addDays(today, -27);
		const logs = state.history.filter((l) => l.date >= start);
		const plan = state.planned.filter((w) => !w.adHoc && w.date >= start && (w.date < today || w.status !== "planned"));
		return { planned: plan.length, done: plan.filter((w) => w.status === "completed" || w.status === "partial").length, minutes: Math.round(logs.reduce((n, l) => n + l.durationSec, 0) / 60), volume: logs.reduce((n, l) => n + l.volumeKg, 0) };
	})();
	const view = period === "week" ? { planned: stats.week.planned, done: stats.week.done, minutes: stats.week.minutes, volume: stats.week.volume } : month;

	const weeks = historyByWeek(state.history, today, 6);
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
			{state.hasDemoHistory && <Notice tone="info">{t("fit.progress.demoNote")}</Notice>}
			<SegmentedControl label={t("fit.progress.period")} value={period} onChange={setPeriod} options={[{ id: "week", label: t("fit.progress.thisWeek") }, { id: "month", label: t("fit.progress.last4") }]} />
			<div className={styles.grid2}>
				<Stat label={t("fit.progress.sessions")} value={<><AnimatedNumber value={view.done} />/<AnimatedNumber value={view.planned} /></>} hint={t("fit.progress.completedVsPlanned")} icon={<Icon icon={Calendar03Icon} size={14} />} />
				<Stat label={t("fit.progress.time")} value={view.minutes} hint={t("fit.common.minShort")} icon={<Icon icon={Clock01Icon} size={14} />} />
				<Stat label={t("fit.progress.volume")} value={u.mass(view.volume)} hint={u.unit} icon={<Icon icon={Dumbbell01Icon} size={14} />} />
				<Stat label={t("fit.progress.streakLabel")} value={stats.streak.current} hint={t("fit.progress.longest", { n: stats.streak.longest })} icon={<Icon icon={FireIcon} size={14} />} />
			</div>

			<Card className={styles.row}>
				<ProgressRing value={stats.consistency} label={t("fit.progress.consistency")} size={84}>
					<strong><AnimatedNumber value={stats.consistency} suffix="%" /></strong>
				</ProgressRing>
				<div>
					<h3>{t("fit.progress.consistency")}</h3>
					<p>{t("fit.progress.consistencyBody")}</p>
				</div>
			</Card>

			<TrainingInsight />

			<Card>
				<h3 className={styles.h3}>{t("fit.progress.weeklyVolume")}</h3>
				{state.history.length === 0 ? <p className={styles.p}>{t("fit.progress.noData")}</p> : <BarChart data={weeks.map((w) => ({ label: w.label, value: u.mass(w.volume) }))} label={t("fit.progress.weeklyVolume")} unit={` ${u.unit}`} />}
			</Card>

			<Card>
				<h3 className={styles.h3}>{t("fit.progress.calendar")}</h3>
				<div className={styles.cal} role="grid" aria-label={t("fit.progress.calendar")}>
					{WEEKDAYS.map((d) => <span key={d} className={styles.calHead} role="columnheader">{d[0]}</span>)}
					{cells.map((d) => {
						const w = state.planned.find((p) => p.date === d && !p.adHoc);
						const st = !w ? "rest" : w.status === "completed" ? "done" : w.status === "partial" ? "partial" : w.status === "skipped" ? "skipped" : d < today ? "missed" : "planned";
						return <span key={d} role="gridcell" className={styles.calCell} data-state={st} data-today={d === today || undefined} title={`${formatDay(d)}: ${w ? w.title : t("fit.week.state.rest")}`} aria-label={`${formatDay(d)}: ${w ? `${w.title}, ${t(`fit.week.state.${st}`)}` : t("fit.week.state.rest")}`}>{Number(d.slice(8))}</span>;
					})}
				</div>
				<ul className={styles.legend}>
					{(["done", "partial", "planned", "skipped", "missed"] as const).map((s) => <li key={s}><span className={styles.legendDot} data-state={s} />{t(`fit.week.state.${s}`)}</li>)}
				</ul>
			</Card>

			<Card>
				<h3 className={styles.h3}>{t("fit.progress.bodyWeight")}</h3>
				{weights.length < 2 ? <p className={styles.p}>{t("fit.progress.weightNeedMore")}</p> : <LineChart data={weights} label={t("fit.progress.bodyWeight")} unit={` ${u.unit}`} />}
			</Card>

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

function History() {
	const t = useT();
	const u = useUnits();
	const { state } = useFit();
	const logs = [...state.history].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
	if (logs.length === 0) return <EmptyState title={t("fit.progress.historyEmpty")} description={t("fit.progress.historyEmptyBody")} />;
	return (
		<ul className={styles.list}>
			{logs.map((l) => (
				<li key={l.id}>
					<details className={styles.log}>
						<summary className={styles.logSummary}>
							<span>
								<strong>{l.title}</strong>
								<span className={styles.sub}>{formatDay(l.date)} · {Math.max(1, Math.round(l.durationSec / 60))} {t("fit.common.minShort")} · {u.fmtMass(l.volumeKg)}</span>
							</span>
							<span className={styles.logBadges}>
								{l.demo && <Badge>{t("fit.common.demo")}</Badge>}
								<Badge tone={l.status === "completed" ? "success" : "warning"}>{t(`fit.status.${l.status}`)}</Badge>
							</span>
							<Icon icon={ArrowDown01Icon} size={18} className={styles.chevron} />
						</summary>
						<ul className={styles.logBody}>
							{l.exercises.map((e) => (
								<li key={e.exerciseId}>
									<strong>{getExercise(e.exerciseId).name}</strong>
									<span>{e.skipped ? t("fit.workout.skippedLabel") : e.sets.map((s) => `${s.reps}${s.weight ? `×${u.fmtLoad(s.weight)}` : ""}`).join(", ")}</span>
								</li>
							))}
							{l.prs.length > 0 && <li className={styles.pr}>{t("fit.session.prs", { list: l.prs.join(", ") })}</li>}
							<li className={styles.sub}>+{l.xp} XP · {t(`fit.summary.feel.${l.perceived}`)}{l.adaptations.length ? ` · ${t("fit.progress.adaptedCount", { n: l.adaptations.length })}` : ""}</li>
						</ul>
					</details>
				</li>
			))}
		</ul>
	);
}

function Awards() {
	const t = useT();
	const u = useUnits();
	const toast = useToast();
	const { state } = useFit();
	const stats = useFitStats();
	const unlockedCount = ACHIEVEMENTS.filter((a) => state.unlocked[a.id]).length;
	return (
		<>
			<Card className={styles.levelCard}>
				<div className={styles.levelTop}>
					<div>
						<p className={styles.eyebrow}>{t("fit.progress.level")}</p>
						<h2 className={styles.levelNum}>{stats.level.level}</h2>
					</div>
					<div className={styles.levelRight}>
						<strong>{stats.xp.toLocaleString("en-US")} XP</strong>
						<span>{t("fit.progress.toNext", { n: stats.level.span - stats.level.into })}</span>
					</div>
				</div>
				<ProgressBar value={stats.level.pct} label={t("fit.progress.level")} />
			</Card>

			<Card>
				<p className={styles.eyebrow}>{t("fit.today.challenge")}</p>
				<h3 className={styles.h3}>{stats.challenge.title}</h3>
				<p className={styles.p}>{stats.challenge.description}</p>
				<ProgressBar value={(stats.challenge.progress / stats.challenge.target) * 100} label={stats.challenge.title} tone={stats.challenge.complete ? "success" : "accent"} />
				<span className={styles.sub}>{Math.round(stats.challenge.progress).toLocaleString("en-US")} / {stats.challenge.target.toLocaleString("en-US")} {stats.challenge.unit}</span>
			</Card>

			<h2 className={styles.h2}>{t("fit.progress.badges", { n: unlockedCount, total: ACHIEVEMENTS.length })}</h2>
			<ul className={styles.badgesGrid}>
				{ACHIEVEMENTS.map((a) => {
					const when = state.unlocked[a.id];
					return (
						<li key={a.id} className={styles.badgeItem} data-locked={!when || undefined}>
							<AchievementBadge icon={a.icon} locked={!when} />
							<strong>{a.title}</strong>
							<span>{when ? t("fit.progress.unlockedOn", { day: formatDay(when) }) : a.description}</span>
						</li>
					);
				})}
			</ul>

			<h2 className={styles.h2}>{t("fit.progress.records")}</h2>
			{stats.records.length === 0 ? <EmptyState title={t("fit.progress.recordsEmpty")} description={t("fit.progress.recordsEmptyBody")} /> : (
				<ul className={styles.list}>
					{stats.records.slice(0, 8).map((r) => (
						<li key={r.exerciseId} className={styles.record}>
							<span><strong>{getExercise(r.exerciseId).name}</strong><span className={styles.sub}>{formatDay(r.date)}</span></span>
							<Badge tone="accent">{r.unit === "kg" ? u.fmtLoad(r.best) : `${r.best} ${r.unit}`}</Badge>
						</li>
					))}
				</ul>
			)}
			<Button variant="secondary" onClick={async () => {
				const r = await shareText(t("fit.progress.shareTitle"), t("fit.progress.shareAwards", { level: stats.level.level, xp: stats.xp, badges: unlockedCount }));
				toast.show(r === "copied" ? t("fit.common.copied") : r === "failed" ? t("fit.common.shareFailed") : t("fit.progress.shared"), r === "failed" ? "danger" : "success");
			}}>{t("fit.progress.shareAchievements")}</Button>
		</>
	);
}

function CheckIns() {
	const t = useT();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const premium = usePremium();
	const input = useRef<HTMLInputElement>(null);
	const [weight, setWeight] = useState("");
	const [busy, setBusy] = useState(false);
	const [removing, setRemoving] = useState<string | null>(null);
	const limited = !premium && state.photos.length >= FREE_PHOTOS;

	const onFile = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		try {
			const dataUrl = await resizeToDataUrl(file);
			dispatch({ type: "add-photo", photo: { id: `p${Date.now()}`, date: today, dataUrl } });
			toast.show(t("fit.progress.photoAdded"), "success");
		} catch {
			toast.show(t("fit.progress.photoError"), "danger");
		} finally {
			setBusy(false);
			if (input.current) input.current.value = "";
		}
	};

	const u = useUnits();
	const entered = Number(weight);
	const kg = u.toKg(entered);
	const validWeight = weight !== "" && kg >= 30 && kg <= 250;

	return (
		<>
			<Card className={styles.stack}>
				<h3 className={styles.h3}>{t("fit.progress.logWeight")}</h3>
				<div className={styles.inline}>
					<Input className={styles.grow} label={t("fit.onboarding.weight")} type="number" inputMode="decimal" step="0.1" suffix={u.unit} value={weight} onChange={(e) => setWeight(e.target.value)} error={weight !== "" && !validWeight ? t("fit.onboarding.errors.weight") : undefined} />
					<Button disabled={!validWeight} onClick={() => { dispatch({ type: "add-body-weight", date: today, kg }); setWeight(""); toast.show(t("fit.progress.weightSaved"), "success"); }}>{t("fit.common.save")}</Button>
				</div>
			</Card>

			<Card className={styles.stack}>
				<h3 className={styles.h3}>{t("fit.progress.photos")}</h3>
				<p className={styles.p}>{t("fit.progress.photosNote")}</p>
				<input ref={input} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
				{limited ? <PremiumGate title={t("fit.progress.photosLockedTitle")} body={t("fit.progress.photosLockedBody", { n: FREE_PHOTOS })} source="photos"><span /></PremiumGate> : <Button variant="secondary" iconLeft={Camera01Icon} loading={busy} onClick={() => input.current?.click()}>{t("fit.progress.addPhoto")}</Button>}
				{state.photos.length === 0 ? <EmptyState title={t("fit.progress.photosEmpty")} description={t("fit.progress.photosEmptyBody")} /> : (
					<ul className={styles.photos}>
						{state.photos.map((p) => (
							<li key={p.id}>
								{/* eslint-disable-next-line @next/next/no-img-element -- local data URL, not optimizable */}
								<img src={p.dataUrl} alt={t("fit.progress.photoAlt", { day: formatDay(p.date) })} />
								<span>{formatDay(p.date)}</span>
								<button type="button" className={styles.remove} onClick={() => setRemoving(p.id)}>{t("fit.progress.removePhoto")}</button>
							</li>
						))}
					</ul>
				)}
			</Card>
			<Sheet open={!!removing} onClose={() => setRemoving(null)} title={t("fit.progress.removeTitle")} closeLabel={t("common.close")} variant="center" footer={
				<>
					<Button variant="secondary" onClick={() => setRemoving(null)}>{t("fit.common.cancel")}</Button>
					<Button variant="danger" onClick={() => { if (removing) dispatch({ type: "remove-photo", id: removing }); setRemoving(null); }}>{t("fit.progress.removeConfirm")}</Button>
				</>
			}><p>{t("fit.progress.removeBody")}</p></Sheet>
		</>
	);
}
