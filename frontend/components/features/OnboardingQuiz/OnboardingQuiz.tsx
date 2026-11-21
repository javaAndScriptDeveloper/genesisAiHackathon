"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircleIcon, ArrowLeft02Icon, ArrowRight02Icon, Mic01Icon, StopIcon, Tick02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { OptionCard } from "@/components/features/OptionCard/OptionCard";
import { Spotty, type SpottyMood } from "@/components/features/Spotty/Spotty";
import { ThemeToggle } from "@/components/features/ThemeToggle/ThemeToggle";
import { Avatar, Badge, Button, Card, EmptyState, Icon, IconButton, Input, ProgressBar, Skeleton, Switch } from "@/components/ui";
import { parseGoal, type GoalResult } from "@/lib/api/onboarding";
import { usePersonalPlan } from "@/lib/api/plan";
import { transcribe } from "@/lib/api/stt";
import { useTrainers, type Trainer } from "@/lib/api/trainers";
import { WEEKDAYS } from "@/lib/fit/dates";
import { DAYS, DURATIONS, EQUIPMENT, EXPERIENCES, GOALS, LOCATIONS, WEARABLES } from "@/lib/fit/options";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useVoiceRecorder } from "@/lib/hooks/useVoiceRecorder";
import { useActionNavigate } from "@/lib/fit/store/hooks";
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
});

export function OnboardingQuiz() {
	const t = useT();
	const go = useActionNavigate();
	const { state, today } = useFit();
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

	// Voice goal: Gemini transcribes the recording, then Spotty reads it like a typed goal.
	const recorder = useVoiceRecorder();
	const [micFailed, setMicFailed] = useState(false);
	const listen = useMutation({
		mutationFn: (audio: Blob) => transcribe(audio),
		onSuccess: (text) => {
			const heard = text.slice(0, 500);
			// A new recording replaces the goal instead of piling onto the previous one.
			setValue("goalText", heard, { shouldValidate: true });
			setValue("goal", null);
			setGoalResult(null);
			understand.mutate(heard);
		},
		onError: () => setMicFailed(true),
	});
	const toggleMic = async () => {
		setMicFailed(false);
		if (recorder.status !== "recording") return recorder.start();
		const audio = await recorder.stop();
		if (audio && audio.size > 0) listen.mutate(audio);
	};
	const micMessage = micFailed
		? t("fit.profile.micFailed")
		: recorder.status === "unsupported"
			? t("fit.profile.micUnsupported")
			: recorder.status === "denied"
				? t("fit.profile.micDenied")
				: null;

	const goStep = (to: number) => {
		// Leaving the goal step mid-recording: release the microphone and drop the clip.
		if (recorder.status === "recording") void recorder.stop();
		setMicFailed(false);
		setDir(to > step ? "fwd" : "back");
		setStep(Math.max(0, Math.min(STEPS.length - 1, to)));
	};
	const next = async () => {
		// Typed a goal but didn't send it: let Spotty read it before validating the step.
		const text = getValues("goalText").trim();
		if (current === "goal" && !getValues("goal") && text) await understand.mutateAsync(text);
		if (await trigger(FIELDS[current])) goStep(step + 1);
	};
	const skip = () => {
		if (current === "gender") setValue("gender", null);
		if (current === "sync") setValue("wearable", "none");
		goStep(step + 1);
	};

	// The plan is written from the answers once the user reaches the last screen: the AI trainer flow saves the user
	// and device under the progress token and builds the plan (rule-based fallback), see lib/api/plan.ts.
	const planRequest = useMemo(() => {
		if (current !== "ready") return null;
		const parsed = schema.safeParse(getValues());
		if (!parsed.success) return null;
		return { profile: toProfile(parsed.data), trainerSlug: parsed.data.trainerId };
	}, [current, schema, getValues]);
	const plan = usePersonalPlan(planRequest, today, state.progressToken);
	// The next N sessions: late in the week the current week may have none left.
	const preview = plan.data?.planned.slice(0, planRequest?.profile.daysPerWeek ?? 0) ?? [];
	const aiWhy = plan.data?.source === "ai" ? plan.data.why : [];

	const finish = () => {
		const parsed = schema.safeParse(getValues());
		if (!parsed.success || plan.isPending) return;
		// The plan's source and the device registered under this token go with it, so later checks and rebuilds reuse them.
		const ai = plan.data ? { backend: plan.data.backend, summary: plan.data.source === "rules" ? null : plan.data.summary, source: plan.data.source, progressToken: state.progressToken } : undefined;
		go("/today", { type: "complete-onboarding", profile: toProfile(parsed.data), units: state.units, trainerId: parsed.data.trainerId, demoHistory, today, now: new Date().toISOString(), planned: plan.data?.planned, ai }, { replace: true });
	};

	const spotty = spottyLine(current, { t, name, values, goalResult, pending: understand.isPending, trainer, planPending: plan.isPending, planSummary: plan.data?.summary ?? "" });

	return (
		<form className={styles.root} noValidate onSubmit={(e) => e.preventDefault()}>
			<div className={styles.top}>
				{step > 0 ? <IconButton icon={ArrowLeft02Icon} label={t("fit.common.back")} onClick={() => goStep(step - 1)} /> : <span className={styles.spacer} />}
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
						<Button
							variant="secondary"
							iconLeft={recorder.status === "recording" ? StopIcon : Mic01Icon}
							aria-pressed={recorder.status === "recording"}
							loading={listen.isPending}
							disabled={understand.isPending}
							onClick={() => void toggleMic()}
						>
							{listen.isPending ? t("fit.profile.micTranscribing") : recorder.status === "recording" ? t("fit.profile.micStop") : t("fit.profile.micStart")}
						</Button>
						{micMessage && <p className={styles.note} role="alert">{micMessage}</p>}
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
										<TrainerCard key={tr.id} trainer={tr} checked={field.value === tr.id} onChange={() => field.onChange(tr.id)} />
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
									<Avatar name={trainer.name} src={trainer.pathToImage} size={32} />
									<span>{t("fit.quiz.ready.coach", { trainer: trainer.name })}</span>
								</p>
							)}
						</Card>
						<h2 className={styles.subTitle}>{t("fit.quiz.ready.why")}</h2>
						{plan.isPending ? (
							<div className={styles.stack} aria-busy="true" aria-label={t("fit.quiz.ready.building")}>
								{[0, 1, 2].map((i) => (
									<Skeleton key={i} height="2rem" />
								))}
							</div>
						) : aiWhy.length > 0 ? (
							<ul className={styles.why}>
								{aiWhy.map((reason) => (
									<li key={reason}><Icon icon={Tick02Icon} size={16} />{reason}</li>
								))}
							</ul>
						) : (
						<ul className={styles.why}>
							<li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyGoal", { hint: t(`fit.opt.goal.${values.goal ?? "stay-fit"}.hint`) })}</li>
							<li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyDays", { n: values.daysPerWeek, min: values.durationMin })}</li>
							<li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyLevel", { level: t(`fit.opt.experience.${values.experience}.label`).toLowerCase() })}</li>
							{values.wearable !== "none" && <li><Icon icon={Tick02Icon} size={16} />{t("fit.quiz.ready.whyWatch", { device: t(`fit.opt.wearable.${values.wearable}.label`) })}</li>}
						</ul>
						)}
						<h2 className={styles.subTitle}>{t("fit.onboarding.firstWeek")}</h2>
						{plan.isPending ? (
							<div className={styles.stack} aria-busy="true">
								{Array.from({ length: values.daysPerWeek }, (_, i) => (
									<Skeleton key={i} height="5.6rem" />
								))}
							</div>
						) : (
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
						)}
						{!plan.isPending && preview.length === 0 && <p className={styles.note}>{t("fit.onboarding.noPreview")}</p>}
						<Switch label={t("fit.onboarding.demoHistory")} checked={demoHistory} onChange={(e) => setDemoHistory(e.target.checked)} />
					</div>
				)}
			</div>

			<div className={styles.footer}>
				{current === "ready" ? (
					<Button size="lg" iconRight={ArrowRight02Icon} loading={plan.isPending} onClick={finish}>
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

function TrainerCard({ trainer, checked, onChange }: { trainer: Trainer; checked: boolean; onChange: () => void }) {
	return (
		<label className={clsx(styles.trainer, checked && styles.trainerOn)}>
			<input className={styles.srOnly} type="radio" name="trainer" checked={checked} onChange={onChange} />
			<Avatar name={trainer.name} src={trainer.pathToImage} size={56} />
			<span className={styles.trainerText}>
				<strong className={styles.trainerName}>{trainer.name}</strong>
				<span className={styles.tagline}>{trainer.tov}</span>
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
	planPending: boolean;
	planSummary: string;
}

/** Spotty's reaction for the current step: personal, and reacting to what the user just entered. */
function spottyLine(step: Step, { t, name, values, goalResult, pending, trainer, planPending, planSummary }: LineCtx): { mood: SpottyMood; line: string } {
	switch (step) {
		case "hello":
		case "name":
			return { mood: "wave", line: name ? t("fit.quiz.spotty.nameKnown", { name }) : t("fit.quiz.spotty.name") };
		case "gender":
			return { mood: "idle", line: t("fit.quiz.spotty.gender", { name }) };
		case "goal":
			if (pending) return { mood: "think", line: t("fit.quiz.spotty.thinking") };
			if (goalResult && values.goal) return { mood: "cheer", line: t("fit.quiz.spotty.goalGot", { goal: t(`fit.opt.goal.${values.goal}.label`).toLowerCase() }) };
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
			if (planPending) return { mood: "think", line: t("fit.quiz.spotty.building", { name }) };
			return { mood: "cheer", line: planSummary || t("fit.quiz.spotty.ready", { name }) };
	}
}
