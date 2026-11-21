"use client";

import { Add01Icon, Alert02Icon, CheckmarkCircle01Icon, MinusSignIcon, Calendar03Icon, DropletIcon, FireIcon, Medal01Icon, Target01Icon, Notification03Icon, PlayIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Stat } from "@/components/features/Stat/Stat";
import { WeekStrip } from "@/components/features/WeekStrip/WeekStrip";
import { WorkoutCard } from "@/components/features/WorkoutCard/WorkoutCard";
import { AnimatedNumber, Button, Card, EmptyState, Icon, IconButton, Picture, ProgressBar, ProgressRing, useToast } from "@/components/ui";
import { kcalFor } from "@/lib/fit/calories";
import { daysBetween, formatDay } from "@/lib/fit/dates";
import { motivationFor } from "@/lib/fit/gamification";
import { WATER_MAX_ML, WATER_STEP_ML } from "@/lib/fit/seed";
import { unreadCount } from "@/lib/fit/notifications";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useActionNavigate, useFitStats, useStartWorkout } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Today.module.scss";

function greetingKey(): string {
	const h = new Date().getHours();
	return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

export function Today() {
	const t = useT();
	const router = useRouter();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const stats = useFitStats();
	const start = useStartWorkout();
	const go = useActionNavigate();
	const profile = state.profile;
	if (!profile) return null;

	const todays = state.planned.find((w) => w.date === today && w.status === "planned");
	const doneToday = state.planned.find((w) => w.date === today && (w.status === "completed" || w.status === "partial"));
	const missed = state.planned.filter((w) => w.status === "planned" && !w.adHoc && w.date < today && daysBetween(w.date, today) <= 7).sort((a, b) => b.date.localeCompare(a.date))[0];
	const comeback = stats.sinceLast !== null && stats.sinceLast >= 7;
	const water = state.water[today] ?? 0;
	const active = state.active && state.active.phase !== "summary" ? state.active : null;
	const next = stats.next;
	const unread = unreadCount(state);
	const weekPct = Math.min(100, (stats.goal.done / stats.goal.target) * 100);

	return (
		<div className={styles.root}>
			<ScreenHeader
				title={t(`fit.today.greeting.${greetingKey()}`, { name: profile.name })}
				subtitle={<><Icon icon={Calendar03Icon} size={14} />{formatDay(today)}</>}
				actions={
					<>
						<span className={styles.bell}>
							<IconButton icon={Notification03Icon} label={t("fit.today.notifications", { n: unread })} onClick={() => router.push("/notifications")} />
							{unread > 0 && <span className={styles.badge} aria-hidden>{unread}</span>}
						</span>
					</>
				}
			/>

			<div className={styles.content}>
				{state.planned.length === 0 && <EmptyState title={t("fit.today.empty.title")} description={t("fit.today.empty.body")} action={<Button onClick={() => router.push("/profile/edit")}>{t("fit.today.empty.cta")}</Button>} />}

				{active ? (
					<Card className={styles.hero}>
						<p className={styles.eyebrow}>{t("fit.today.inProgress")}</p>
						<h2 className={styles.heroTitle}>{active.title}</h2>
						<Button size="lg" iconLeft={PlayIcon} onClick={() => router.push("/workout")}>{t("fit.today.resume")}</Button>
					</Card>
				) : todays ? (
					<Card className={styles.hero}>
						<Picture name="training-all" alt="" width={384} height={384} sizes="220px" className={styles.heroPhoto} />
						<p className={styles.eyebrow}>{t("fit.today.todaysWorkout")}</p>
						<h2 className={styles.heroTitle}>{todays.title}</h2>
						<p className={styles.heroMeta}>
							{todays.durationMin} {t("fit.common.minShort")} · {kcalFor(todays.exercises.map((b) => b.exerciseId), profile.weightKg, todays.durationMin)} kcal · {t("fit.session.exercises", { n: todays.exercises.length })}
						</p>
						<div className={styles.heroActions}>
							<Button size="lg" iconLeft={PlayIcon} onClick={() => start(todays.id)}>{t("fit.today.start")}</Button>
							<Button size="lg" variant="secondary" onDark onClick={() => router.push(`/training/session/${todays.id}`)}>{t("fit.today.preview")}</Button>
						</div>
					</Card>
				) : doneToday ? (
					<Card className={styles.hero}>
						<p className={styles.eyebrow}>{t("fit.today.doneEyebrow")}</p>
						<h2 className={styles.heroTitle}>{t("fit.today.doneTitle")}</h2>
						<p className={styles.heroMeta}>{t("fit.today.doneBody")}</p>
						<Button variant="secondary" onDark onClick={() => router.push("/progress")}>{t("fit.today.seeProgress")}</Button>
					</Card>
				) : state.planned.length > 0 ? (
					<Card className={styles.hero}>
						<Picture name="training-mobility" alt="" width={384} height={384} sizes="220px" className={styles.heroPhoto} />
						<p className={styles.eyebrow}>{t("fit.today.recoveryEyebrow")}</p>
						<h2 className={styles.heroTitle}>{t("fit.today.recoveryTitle")}</h2>
						<p className={styles.heroMeta}>{t("fit.today.recoveryBody")}</p>
						<div className={styles.heroActions}>
							{next && <Button iconLeft={PlayIcon} onClick={() => start(next.id)}>{t("fit.today.startEarly")}</Button>}
							<Button variant="secondary" onDark onClick={() => go(`/training/session/x-${today}-mobility`, { type: "add-adhoc", kind: "mobility", today })}>{t("fit.today.mobility")}</Button>
						</div>
						{next && <p className={styles.heroMeta}>{t("fit.today.nextUp", { title: next.title, day: formatDay(next.date) })}</p>}
					</Card>
				) : null}

				{missed && !todays && (
					<Card className={styles.notice}>
						<Icon icon={Alert02Icon} size={22} />
						<div>
							<h3>{t("fit.today.missedTitle", { day: formatDay(missed.date) })}</h3>
							<p>{t("fit.today.missedBody", { title: missed.title })}</p>
							<Button size="sm" variant="secondary" onClick={() => router.push(`/training/session/${missed.id}`)}>{t("fit.today.missedCta")}</Button>
						</div>
					</Card>
				)}

				{comeback && !active && next && (
					<Card className={styles.notice}>
						<Icon icon={FireIcon} size={22} />
						<div>
							<h3>{t("fit.today.comebackTitle")}</h3>
							<p>{t("fit.today.comebackBody", { days: stats.sinceLast ?? 0 })}</p>
							<Button size="sm" onClick={() => {
								toast.show(t("fit.today.comebackToast"), "success");
								go(`/training/session/${next.id}`, { type: "adapt", op: { kind: "tired" }, today });
							}}>{t("fit.today.comebackCta")}</Button>
						</div>
					</Card>
				)}

				<section aria-label={t("fit.today.weekGoal")} className={styles.goal}>
					<ProgressRing value={weekPct} label={t("fit.today.weekGoal")} size={92}>
						<strong className={styles.ringNum}><AnimatedNumber value={stats.goal.done} />/<AnimatedNumber value={stats.goal.target} /></strong>
						<span className={styles.ringLabel}>{t("fit.today.sessions")}</span>
					</ProgressRing>
					<div className={styles.goalText}>
						<h2>{t("fit.today.weekGoal")}</h2>
						<p>{stats.goal.done >= stats.goal.target ? t("fit.today.goalDone") : stats.week.planned === 0 && stats.goal.done === 0 ? t("fit.today.noPlanThisWeek") : t("fit.today.goalLeft", { n: stats.goal.target - stats.goal.done })}</p>
					</div>
				</section>

				<WeekStrip planned={state.planned} today={today} />

				<div className={styles.stats}>
					<Stat label={t("fit.today.streak")} value={stats.streak.current} hint={t(stats.streak.current === 1 ? "fit.today.streakHintOne" : "fit.today.streakHint")} icon={<Icon icon={FireIcon} size={14} />} />
					<Stat label={t("fit.today.level")} value={stats.level.level} hint={`${stats.level.into}/${stats.level.span} XP`} icon={<Icon icon={Medal01Icon} size={14} />} />
				</div>
				<ProgressBar value={stats.level.pct} label={t("fit.today.xpProgress")} />

				<Card className={styles.challenge}>
					<p className={styles.eyebrow}><Icon icon={Target01Icon} size={14} /> {t("fit.today.challenge")}</p>
					<h3>{stats.challenge.title}</h3>
					<p>{stats.challenge.description}</p>
					<ProgressBar value={(stats.challenge.progress / stats.challenge.target) * 100} label={stats.challenge.title} tone={stats.challenge.complete ? "success" : "accent"} />
					<span className={styles.challengeMeta}>
						{Math.round(stats.challenge.progress).toLocaleString("en-US")} / {stats.challenge.target.toLocaleString("en-US")} {stats.challenge.unit}
						{stats.challenge.complete && ` · ${t("fit.today.challengeDone")}`}
					</span>
				</Card>

				<Card className={styles.water}>
					<div className={styles.waterTop}>
						<span className={styles.waterIcon}>
							<Icon icon={DropletIcon} size={22} />
						</span>
						<div className={styles.waterText}>
							<h3>{t("fit.today.water")}</h3>
							<p><strong>{water}</strong> / {state.waterGoalMl} ml</p>
						</div>
						<div className={styles.waterActions}>
							<IconButton icon={MinusSignIcon} variant="secondary" label={t("fit.today.waterRemove", { ml: WATER_STEP_ML })} disabled={water <= 0} onClick={() => dispatch({ type: "water", date: today, delta: -WATER_STEP_ML })} />
							<Button iconLeft={Add01Icon} disabled={water >= WATER_MAX_ML} onClick={() => dispatch({ type: "water", date: today, delta: WATER_STEP_ML })}>{WATER_STEP_ML} ml</Button>
						</div>
					</div>
					<ProgressBar value={Math.min(100, (water / state.waterGoalMl) * 100)} label={t("fit.today.water")} tone={water >= state.waterGoalMl ? "success" : "accent"} />
					<p className={styles.waterStatus} data-state={water >= WATER_MAX_ML ? "limit" : water >= state.waterGoalMl ? "done" : "going"} role="status">
						{water >= WATER_MAX_ML ? (
							<><Icon icon={Alert02Icon} size={16} />{t("fit.today.waterLimit", { max: WATER_MAX_ML })}</>
						) : water >= state.waterGoalMl ? (
							<><Icon icon={CheckmarkCircle01Icon} size={16} />{t("fit.today.waterDone")}</>
						) : (
							t("fit.today.waterLeft", { ml: state.waterGoalMl - water })
						)}
					</p>
				</Card>

				{next && !todays && !active && <WorkoutCard workout={next} />}

				<p className={styles.quote}>{motivationFor(today)}</p>
				<Link href="/nutrition" className={styles.link}>{t("fit.today.nutritionLink")}</Link>
			</div>
		</div>
	);
}
