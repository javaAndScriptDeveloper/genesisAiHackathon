"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircleIcon, ArrowLeft02Icon, ArrowRight02Icon, Tick02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { OptionCard } from "@/components/features/OptionCard/OptionCard";
import { Spotty, type SpottyMood } from "@/components/features/Spotty/Spotty";
import { ThemeToggle } from "@/components/features/ThemeToggle/ThemeToggle";
import { Badge, Button, Card, EmptyState, Icon, IconButton, Input, ProgressBar, Skeleton, Switch } from "@/components/ui";
import { parseGoal, useTrainers, type GoalResult, type Trainer } from "@/lib/api/onboarding";
import { WEEKDAYS } from "@/lib/fit/dates";
import { DAYS, DURATIONS, EQUIPMENT, EXPERIENCES, GOALS, LOCATIONS, WEARABLES } from "@/lib/fit/options";
import { generatePlan } from "@/lib/fit/plan";
import { useFit } from "@/lib/fit/store/FitProvider";
import type { Equipment, Gender, Profile, TrainingLocation } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./OnboardingQuiz.module.scss";

type T = (k: string, p?: Record<string, string | number>) => string;

const QUIZ_GENDERS: Gender[] = ["male", "female", "non-binary"];
// Location pre-fills equipment, so the user only unticks what they lack (Fitbod pattern).
const EQUIPMENT_FOR: Record<TrainingLocation, Equipment[]> = {
	home: ["dumbbells", "bands"],
	hybrid: ["dumbbells", "bands"],
	gym: ["dumbbells", "bench", "barbell", "machines"],
};

const makeSchema = (t: T) =>
	z.object({
		name: z.string().trim().min(1, t("fit.onboarding.errors.name")).max(30, t("fit.onboarding.errors.nameLong")),
		gender: z.enum(QUIZ_GENDERS).nullable(),
		goal: z
			.enum(GOALS)
			.nullable()
			.superRefine((g, ctx) => {
				if (g === null) ctx.addIssue({ code: "custom", message: t("fit.quiz.errors.goal") });
			}),
		goalText: z.string().max(500),
		age: z.number({ error: t("fit.onboarding.errors.number") }).int().min(14, t("fit.onboarding.errors.age")).max(90, t("fit.onboarding.errors.age")),
		heightCm: z.number({ error: t("fit.onboarding.errors.number") }).min(120, t("fit.onboarding.errors.height")).max(230, t("fit.onboarding.errors.height")),
		weightKg: z.number({ error: t("fit.onboarding.errors.number") }).min(30, t("fit.onboarding.errors.weight")).max(250, t("fit.onboarding.errors.weight")),
		experience: z.enum(EXPERIENCES),
		location: z.enum(LOCATIONS),
		equipment: z.array(z.enum(EQUIPMENT)),
		durationMin: z.number(),
		daysPerWeek: z.number(),
		trainerId: z.string().min(1, t("fit.quiz.errors.trainer")),
		wearable: z.enum(WEARABLES),
	});
type Form = z.infer<ReturnType<typeof makeSchema>>;

const STEPS = ["hello", "name", "gender", "goal", "body", "level", "days", "fighter", "sync", "ready"] as const;
type Step = (typeof STEPS)[number];
const QUIZ_STEPS = STEPS.length - 1; // "ready" is the reward, not a question.
const FIELDS: Record<Step, (keyof Form)[]> = {
	hello: [],
	name: ["name"],
	gender: ["gender"],
	goal: ["goal", "goalText"],
	body: ["age", "heightCm", "weightKg"],
	level: ["experience", "location", "equipment"],
	days: ["durationMin", "daysPerWeek"],
	fighter: ["trainerId"],
	sync: ["wearable"],
	ready: [],
};
const SKIPPABLE: Step[] = ["gender", "sync"];

const toProfile = (v: Form): Profile => ({
	name: v.name.trim(),
	age: v.age,
	gender: v.gender,
	heightCm: v.heightCm,
	weightKg: v.weightKg,
	goal: v.goal ?? "stay-fit",
	goalText: v.goalText.trim() || undefined,
	experience: v.experience,
	location: v.location,
	equipment: v.location === "gym" ? EQUIPMENT_FOR.gym : v.equipment,
	durationMin: v.durationMin,
	daysPerWeek: v.daysPerWeek,
	limitations: [],
	limitationNote: "",
	wearable: v.wearable,
	trainerId: v.trainerId,
});

export function OnboardingQuiz() {
	const t = useT();
	const router = useRouter();
	const { dispatch, today } = useFit();
	const [step, setStep] = useState(0);
	const [dir, setDir] = useState<"fwd" | "back">("fwd");
	const [demoHistory, setDemoHistory] = useState(true);
	const [goalResult, setGoalResult] = useState<GoalResult | null>(null);
	const schema = useMemo(() => makeSchema(t), [t]);
	const form = useForm<Form>({
		resolver: zodResolver(schema),
		mode: "onTouched",
		defaultValues: { name: "", gender: null, goal: null, goalText: "", age: 28, heightCm: 172, weightKg: 70, experience: "beginner", location: "home", equipment: EQUIPMENT_FOR.home, durationMin: 30, daysPerWeek: 3, trainerId: "", wearable: "none" },
	});
	const { register, control, watch, trigger, getValues, setValue, formState } = form;
	const values = watch();
	const current: Step = STEPS[step] ?? "hello";
	const trainers = useTrainers();
	const trainer = trainers.data?.find((tr) => tr.id === values.trainerId);
	const name = values.name.trim();

	const understand = useMutation({
		mutationFn: (text: string) => parseGoal(text),
		onSuccess: (result) => {
			setGoalResult(result);
			if (result.goal) setValue("goal", result.goal, { shouldValidate: true });
		},
	});

	const go = (to: number) => {
		setDir(to > step ? "fwd" : "back");
		setStep(Math.max(0, Math.min(STEPS.length - 1, to)));
	};
	const next = async () => {
		// Typed a goal but didn't send it: let Spotty read it before validating the step.
		const text = getValues("goalText").trim();
		if (current === "goal" && !getValues("goal") && text) await understand.mutateAsync(text);
		if (await trigger(FIELDS[current])) go(step + 1);
	};
	const skip = () => {
		if (current === "gender") setValue("gender", null);
		if (current === "sync") setValue("wearable", "none");
		go(step + 1);
	};

	const finish = () => {
		const parsed = schema.safeParse(getValues());
		if (!parsed.success) return;
		dispatch({ type: "complete-onboarding", profile: toProfile(parsed.data), demoHistory, today, now: new Date().toISOString() });
		router.replace("/today");
	};

	const preview = useMemo(() => {
		if (current !== "ready") return [];
		const parsed = schema.safeParse(getValues());
		if (!parsed.success) return [];
		const profile = toProfile(parsed.data);
		// The next N sessions: late in the week the current week may have none left.
		return generatePlan(profile, today, 2).slice(0, profile.daysPerWeek);
	}, [current, schema, getValues, today]);

	const spotty = spottyLine(current, { t, name, values, goalResult, pending: understand.isPending, trainer });

	return (
		<form className={styles.root} noValidate onSubmit={(e) => e.preventDefault()}>
			<div className={styles.top}>
				{step > 0 ? <IconButton icon={ArrowLeft02Icon} label={t("fit.common.back")} onClick={() => go(step - 1)} /> : <span className={styles.spacer} />}
				<ProgressBar value={(Math.min(step + 1, QUIZ_STEPS) / QUIZ_STEPS) * 100} label={t("fit.onboarding.progress")} className={styles.bar} />
				<span className={styles.count}>{current === "ready" ? <Icon icon={Tick02Icon} size={18} /> : `${step + 1}/${QUIZ_STEPS}`}</span>
				<ThemeToggle />
			</div>

			<div className={clsx(styles.content, styles[dir])} key={current}>
				{current === "hello" ? (
					<div className={styles.hello}>
						<Spotty mood="wave" size="lg">
							{t("fit.quiz.spotty.hello")}
						</Spotty>
						<ul className={styles.perks}>
							{(["plan", "coach", "honest"] as const).map((p) => (
								<li key={p}>
									<Icon icon={Tick02Icon} size={16} />
									{t(`fit.quiz.hello.${p}`)}
								</li>
							))}
						</ul>
					</div>
				) : (
					<>
						<Spotty mood={spotty.mood} className={styles.spotty}>
							{spotty.line}
						</Spotty>
						<h1 className={styles.title}>{t(`fit.quiz.steps.${current}.title`, { name })}</h1>
					</>
				)}

				{current === "name" && <Input label={t("fit.quiz.nameLabel")} autoComplete="given-name" autoFocus error={formState.errors.name?.message} {...register("name")} />}

				{current === "gender" && (
					<div className={styles.stack} role="radiogroup" aria-label={t("fit.onboarding.gender")}>
						<Controller control={control} name="gender" render={({ field }) => (
							<>
								{QUIZ_GENDERS.map((g) => (
									<OptionCard key={g} type="radio" name="gender" label={t(`fit.quiz.gender.${g}`)} checked={field.value === g} onChange={() => field.onChange(g)} />
								))}
							</>
						)} />
					</div>
				)}

				{current === "goal" && (
					<div className={styles.stack}>
						<Controller control={control} name="goal" render={({ field }) => (
							<div className={styles.stack} role="radiogroup" aria-label={t("fit.quiz.steps.goal.title", { name })}>
								{GOALS.map((g) => (
									<OptionCard
										key={g}
										type="radio"
										name="goal"
										label={t(`fit.opt.goal.${g}.label`)}
										hint={t(`fit.opt.goal.${g}.hint`)}
										checked={field.value === g}
										onChange={() => {
											field.onChange(g);
											setValue("goalText", "");
											setGoalResult(null);
										}}
									/>
								))}
							</div>
						)} />
						<Input
							label={t("fit.quiz.goal.typeLabel")}
							placeholder={t("fit.quiz.goal.placeholder")}
							enterKeyHint="next"
							error={formState.errors.goal?.message ?? formState.errors.goalText?.message}
							{...register("goalText", {
								// Typing your own goal replaces a picked option; Continue lets Spotty read it.
								onChange: (e: { target: { value: string } }) => {
									if (e.target.value.trim()) setValue("goal", null);
								},
							})}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									void next();
								}
							}}
						/>
					</div>
				)}

				{current === "body" && (
					<div className={styles.bodyGrid}>
						<Input label={t("fit.onboarding.height")} type="number" inputMode="numeric" hint="cm" error={formState.errors.heightCm?.message} {...register("heightCm", { valueAsNumber: true })} />
						<Input label={t("fit.onboarding.weight")} type="number" inputMode="decimal" step="0.1" hint="kg" error={formState.errors.weightKg?.message} {...register("weightKg", { valueAsNumber: true })} />
						<Input label={t("fit.onboarding.age")} type="number" inputMode="numeric" error={formState.errors.age?.message} {...register("age", { valueAsNumber: true })} />
					</div>
				)}

				{current === "level" && (
					<div className={styles.stack}>
						<Controller control={control} name="experience" render={({ field }) => (
							<>
								{EXPERIENCES.map((e) => (
									<OptionCard key={e} type="radio" name="experience" label={t(`fit.opt.experience.${e}.label`)} hint={t(`fit.opt.experience.${e}.hint`)} checked={field.value === e} onChange={() => field.onChange(e)} />
								))}
							</>
						)} />
					</div>
				)}

				{current === "days" && (
					<div className={styles.stack}>
						<fieldset className={styles.group}>
							<legend className={styles.legend}>{t("fit.onboarding.days")}</legend>
							<div className={styles.chips5}>
								<Controller control={control} name="daysPerWeek" render={({ field }) => (
									<>
										{DAYS.map((d) => (
											<OptionCard key={d} compact type="radio" name="days" label={String(d)} checked={field.value === d} onChange={() => field.onChange(d)} />
										))}
									</>
								)} />
							</div>
						</fieldset>
						<fieldset className={styles.group}>
							<legend className={styles.legend}>{t("fit.onboarding.duration")}</legend>
							<div className={styles.chips}>
								<Controller control={control} name="durationMin" render={({ field }) => (
									<>
										{DURATIONS.map((d) => (
											<OptionCard key={d} compact type="radio" name="duration" label={`${d} ${t("fit.common.minShort")}`} checked={field.value === d} onChange={() => field.onChange(d)} />
										))}
									</>
								)} />
							</div>
						</fieldset>
					</div>
				)}

				{current === "fighter" && (
					<div className={styles.stack}>
						{trainers.isPending ? (
							<div className={styles.stack} aria-busy="true" aria-label={t("fit.quiz.fighter.loading")}>
								{[0, 1, 2, 3].map((i) => (
									<Skeleton key={i} height="11.2rem" />
								))}
							</div>
						) : trainers.isError ? (
							<EmptyState icon={AlertCircleIcon} title={t("fit.quiz.fighter.errorTitle")} description={t("fit.quiz.fighter.errorText")} action={<Button variant="secondary" loading={trainers.isFetching} onClick={() => void trainers.refetch()}>{t("fit.quiz.fighter.retry")}</Button>} />
						) : trainers.data.length === 0 ? (
							<EmptyState icon={UserGroupIcon} title={t("fit.quiz.fighter.emptyTitle")} description={t("fit.quiz.fighter.emptyText")} />
						) : (
							<Controller control={control} name="trainerId" render={({ field }) => (
								<div className={styles.stack} role="radiogroup" aria-label={t("fit.quiz.steps.fighter.title")}>
									{trainers.data.map((tr) => (
										<TrainerCard key={tr.id} trainer={tr} checked={field.value === tr.id} onChange={() => field.onChange(tr.id)} intensityLabel={t("fit.quiz.fighter.intensity", { n: tr.intensity })} />
									))}
								</div>
							)} />
						)}
						{formState.errors.trainerId?.message && (
							<p className={styles.error} role="alert">
								{formState.errors.trainerId.message}
							</p>
						)}
					</div>
				)}

				{current === "sync" && (
					<div className={styles.stack}>
						<Controller control={control} name="wearable" render={({ field }) => (
							<>
								{WEARABLES.map((w) => (
									<OptionCard key={w} type="radio" name="wearable" label={t(`fit.opt.wearable.${w}.label`)} hint={t(`fit.opt.wearable.${w}.hint`)} checked={field.value === w} onChange={() => field.onChange(w)} />
								))}
							</>
						)} />
					</div>
				)}

				{current === "ready" && (
					<div className={styles.stack}>
						<Card className={styles.summary}>
							<div className={styles.badges}>
								<Badge tone="accent">{t(`fit.opt.goal.${values.goal ?? "stay-fit"}.label`)}</Badge>
								<Badge>{t(`fit.opt.experience.${values.experience}.label`)}</Badge>
								<Badge>{t("fit.onboarding.daysOption", { n: values.daysPerWeek })}</Badge>
							</div>
							{trainer && (
								<p className={styles.coachLine}>
									<span className={clsx(styles.avatar, styles[trainer.tone])} aria-hidden>
										{initials(trainer.name)}
									</span>
									<span>{t("fit.quiz.ready.coach", { trainer: trainer.name, style: trainer.style.toLowerCase() })}</span>
								</p>
							)}
						</Card>
						<h2 className={styles.subTitle}>{t("fit.quiz.ready.why")}</h2>
						<ul className={styles.why}>
							<li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyGoal", { hint: t(`fit.opt.goal.${values.goal ?? "stay-fit"}.hint`) })}</li>
							<li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyDays", { n: values.daysPerWeek, min: values.durationMin })}</li>
							<li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyLevel", { level: t(`fit.opt.experience.${values.experience}.label`).toLowerCase() })}</li>
							{values.wearable !== "none" && <li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyWatch", { device: t(`fit.opt.wearable.${values.wearable}.label`) })}</li>}
						</ul>
						<h2 className={styles.subTitle}>{t("fit.onboarding.firstWeek")}</h2>
						<ul className={styles.week}>
							{preview.map((w) => (
								<li key={w.id} className={styles.weekItem}>
									<span className={styles.day}>{WEEKDAYS[(new Date(`${w.date}T00:00:00`).getDay() + 6) % 7]}</span>
									<span className={styles.weekText}>
										<strong>{w.title}</strong>
										<span>{w.focus}</span>
									</span>
									<span className={styles.weekMin}>
										{w.durationMin} {t("fit.common.minShort")}
									</span>
								</li>
							))}
						</ul>
						{preview.length === 0 && <p className={styles.note}>{t("fit.onboarding.noPreview")}</p>}
						<Switch label={t("fit.onboarding.demoHistory")} checked={demoHistory} onChange={(e) => setDemoHistory(e.target.checked)} />
					</div>
				)}
			</div>

			<div className={styles.footer}>
				{current === "ready" ? (
					<Button size="lg" iconRight={ArrowRight02Icon} onClick={finish}>
						{t("fit.quiz.ready.cta")}
					</Button>
				) : (
					<Button size="lg" iconRight={ArrowRight02Icon} loading={understand.isPending} onClick={() => void next()}>
						{current === "hello" ? t("fit.quiz.hello.cta") : current === "sync" ? t("fit.quiz.sync.cta") : t("fit.common.continue")}
					</Button>
				)}
				{SKIPPABLE.includes(current) && (
					<Button variant="ghost" onClick={skip}>
						{t("fit.quiz.skip")}
					</Button>
				)}
			</div>
		</form>
	);
}

const initials = (name: string) =>
	name
		.split(" ")
		.map((p) => p[0] ?? "")
		.join("")
		.slice(0, 2);

function TrainerCard({ trainer, checked, onChange, intensityLabel }: { trainer: Trainer; checked: boolean; onChange: () => void; intensityLabel: string }) {
	return (
		<label className={clsx(styles.trainer, checked && styles.trainerOn)}>
			<input className={styles.srOnly} type="radio" name="trainer" checked={checked} onChange={onChange} />
			<span className={clsx(styles.avatar, styles.avatarLg, styles[trainer.tone])} aria-hidden>
				{initials(trainer.name)}
			</span>
			<span className={styles.trainerText}>
				<span className={styles.trainerHead}>
					<strong className={styles.trainerName}>{trainer.name}</strong>
					<span className={styles.intensity} aria-label={intensityLabel} role="img">
						{[1, 2, 3].map((n) => (
							<span key={n} className={clsx(styles.bolt, n <= trainer.intensity && styles.boltOn)} />
						))}
					</span>
				</span>
				<span className={styles.trainerStyle}>{trainer.style}</span>
				<span className={styles.tagline}>{trainer.tagline}</span>
				<span className={styles.badges}>
					{trainer.specialties.map((s) => (
						<Badge key={s}>{s}</Badge>
					))}
				</span>
			</span>
		</label>
	);
}

interface LineCtx {
	t: T;
	name: string;
	values: Form;
	goalResult: GoalResult | null;
	pending: boolean;
	trainer: Trainer | undefined;
}

/** Spotty's reaction for the current step: personal, and reacting to what the user just entered. */
function spottyLine(step: Step, { t, name, values, goalResult, pending, trainer }: LineCtx): { mood: SpottyMood; line: string } {
	switch (step) {
		case "hello":
		case "name":
			return { mood: "wave", line: name ? t("fit.quiz.spotty.nameKnown", { name }) : t("fit.quiz.spotty.name") };
		case "gender":
			return { mood: "idle", line: t("fit.quiz.spotty.gender", { name }) };
		case "goal":
			if (pending) return { mood: "think", line: t("fit.quiz.spotty.thinking") };
			if (goalResult && values.goal) return { mood: "cheer", line: goalResult.summary || t("fit.quiz.spotty.goalGot", { goal: t(`fit.opt.goal.${values.goal}.label`).toLowerCase() }) };
			if (goalResult) return { mood: "think", line: t("fit.quiz.spotty.goalUnsure") };
			return { mood: "idle", line: t("fit.quiz.spotty.goal", { name }) };
		case "body":
			return { mood: "idle", line: t("fit.quiz.spotty.body") };
		case "level":
			return { mood: "idle", line: t(`fit.quiz.spotty.level.${values.experience}`) };
		case "days":
			return { mood: values.daysPerWeek >= 5 ? "cheer" : "idle", line: t(values.daysPerWeek >= 5 ? "fit.quiz.spotty.daysMany" : "fit.quiz.spotty.days", { n: values.daysPerWeek, min: values.durationMin }) };
		case "fighter":
			return trainer ? { mood: "cheer", line: t("fit.quiz.spotty.fighterPicked", { trainer: trainer.name.split(" ")[0] ?? trainer.name }) } : { mood: "wave", line: t("fit.quiz.spotty.fighter") };
		case "sync":
			return { mood: "idle", line: t("fit.quiz.spotty.sync") };
		case "ready":
			return { mood: "cheer", line: t("fit.quiz.spotty.ready", { name }) };
	}
}
