"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { BodyStep } from "./BodyStep";
import type { Units } from "@/lib/fit/units";
import { z } from "zod";
import { OptionCard } from "@/components/features/OptionCard/OptionCard";
import { Badge, Button, Card, Input, ProgressBar, Switch, Textarea, IconButton } from "@/components/ui";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { toISO, WEEKDAYS } from "@/lib/fit/dates";
import { DAYS, DURATIONS, EQUIPMENT, EXPERIENCES, GENDERS, GOALS, LIMITATIONS, LOCATIONS, WEARABLES } from "@/lib/fit/options";
import { generatePlan } from "@/lib/fit/plan";
import { useFit } from "@/lib/fit/store/FitProvider";
import type { Profile } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Onboarding.module.scss";

const makeSchema = (t: (k: string, p?: Record<string, string | number>) => string) =>
	z.object({
		name: z.string().trim().min(1, t("fit.onboarding.errors.name")).max(30, t("fit.onboarding.errors.nameLong")),
		age: z.number({ error: t("fit.onboarding.errors.number") }).int().min(14, t("fit.onboarding.errors.age")).max(90, t("fit.onboarding.errors.age")),
		gender: z.enum(GENDERS).nullable(),
		heightCm: z.number({ error: t("fit.onboarding.errors.number") }).min(120, t("fit.onboarding.errors.height")).max(230, t("fit.onboarding.errors.height")),
		weightKg: z.number({ error: t("fit.onboarding.errors.number") }).min(30, t("fit.onboarding.errors.weight")).max(250, t("fit.onboarding.errors.weight")),
		goal: z.enum(GOALS),
		experience: z.enum(EXPERIENCES),
		location: z.enum(LOCATIONS),
		equipment: z.array(z.enum(EQUIPMENT)),
		durationMin: z.number(),
		daysPerWeek: z.number(),
		limitations: z.array(z.enum(LIMITATIONS)),
		limitationNote: z.string().max(300),
		wearable: z.enum(WEARABLES),
	});

type Form = z.infer<ReturnType<typeof makeSchema>>;

const STEPS = ["about", "body", "goal", "experience", "where", "schedule", "limits", "wearable", "summary"] as const;
type Step = (typeof STEPS)[number];
const FIELDS: Record<Step, (keyof Form)[]> = {
	about: ["name", "age", "gender"],
	body: ["heightCm", "weightKg"],
	goal: ["goal"],
	experience: ["experience"],
	where: ["location", "equipment"],
	schedule: ["durationMin", "daysPerWeek"],
	limits: ["limitations", "limitationNote"],
	wearable: ["wearable"],
	summary: [],
};

export function Onboarding({ mode }: { mode: "create" | "edit" }) {
	const t = useT();
	const router = useRouter();
	const { state, dispatch, today } = useFit();
	const [step, setStep] = useState(0);
	const [demoHistory, setDemoHistory] = useState(true);
	const [units, setUnits] = useState<Units>(state.units);
	const schema = useMemo(() => makeSchema(t), [t]);
	const existing = state.profile;
	const form = useForm<Form>({
		resolver: zodResolver(schema),
		mode: "onTouched",
		defaultValues: existing ?? { name: "", age: 30, gender: null, heightCm: 175, weightKg: 75, goal: "build-muscle", experience: "beginner", location: "home", equipment: ["dumbbells"], durationMin: 30, daysPerWeek: 3, limitations: [], limitationNote: "", wearable: "none" },
	});
	const { register, control, watch, trigger, getValues, setValue, formState } = form;
	const current = STEPS[step] ?? "about";
	const values = watch();
	const last = step === STEPS.length - 1;

	const next = async () => {
		const ok = await trigger(FIELDS[current]);
		if (ok) setStep((s) => Math.min(STEPS.length - 1, s + 1));
	};

	const submit = () => {
		const parsed = schema.safeParse(getValues());
		if (!parsed.success) return;
		const profile: Profile = parsed.data;
		if (mode === "create") dispatch({ type: "complete-onboarding", profile, units, demoHistory, today, now: new Date().toISOString() });
		else dispatch({ type: "update-profile", profile, units, today });
		router.replace(mode === "create" ? "/today" : "/profile");
	};

	const preview = useMemo(() => {
		if (!last) return [];
		const parsed = schema.safeParse(values);
		return parsed.success ? generatePlan(parsed.data, today, 1).concat(generatePlan(parsed.data, toISO(new Date(Date.now() + 7 * 86_400_000)), 1)).slice(0, parsed.data.daysPerWeek) : [];
	}, [last, schema, values, today]);

	const toggle = <T extends string>(list: T[], item: T): T[] => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

	return (
		<div className={styles.root}>
			<div className={styles.top}>
				{step > 0 ? <IconButton icon={ArrowLeft02Icon} label={t("fit.common.back")} onClick={() => setStep(step - 1)} /> : mode === "edit" ? <IconButton icon={ArrowLeft02Icon} label={t("fit.common.back")} onClick={() => router.back()} /> : <span className={styles.spacer} />}
				<ProgressBar value={((step + 1) / STEPS.length) * 100} label={t("fit.onboarding.progress")} className={styles.bar} />
				<span className={styles.count}>
					{step + 1}/{STEPS.length}
				</span>
			</div>

			<div className={styles.content} key={current}>
				<p className={styles.eyebrow}>{mode === "edit" ? t("fit.onboarding.editEyebrow") : t("fit.onboarding.eyebrow")}</p>
				<h1 className={styles.title}>{t(`fit.onboarding.steps.${current}.title`)}</h1>
				<p className={styles.lead}>{t(`fit.onboarding.steps.${current}.lead`)}</p>

				{current === "about" && (
					<div className={styles.stack}>
						<Input label={t("fit.onboarding.name")} autoComplete="given-name" error={formState.errors.name?.message} {...register("name")} />
						<Input label={t("fit.onboarding.age")} type="number" inputMode="numeric" suffix={t("fit.onboarding.years")} error={formState.errors.age?.message} {...register("age", { valueAsNumber: true })} />
						<fieldset className={styles.group}>
							<legend className={styles.legend}>{t("fit.onboarding.gender")}</legend>
							<div className={styles.chips}>
								<Controller control={control} name="gender" render={({ field }) => (
									<>
										{GENDERS.map((g) => (
											<OptionCard key={g} compact type="radio" name="gender" label={t(`fit.opt.gender.${g}`)} checked={field.value === g} onChange={() => field.onChange(g)} />
										))}
									</>
								)} />
							</div>
						</fieldset>
					</div>
				)}

				{current === "body" && (
					<BodyStep
						units={units}
						onUnits={setUnits}
						heightCm={Number.isFinite(values.heightCm) ? values.heightCm : 175}
						weightKg={Number.isFinite(values.weightKg) ? values.weightKg : 75}
						onHeight={(cm) => setValue("heightCm", cm, { shouldValidate: true, shouldTouch: true })}
						onWeight={(kg) => setValue("weightKg", kg, { shouldValidate: true, shouldTouch: true })}
						heightError={formState.errors.heightCm?.message}
						weightError={formState.errors.weightKg?.message}
					/>
				)}

				{current === "goal" && (
					<div className={styles.stack}>
						<Controller control={control} name="goal" render={({ field }) => (
							<>
								{GOALS.map((g) => (
									<OptionCard key={g} type="radio" name="goal" label={t(`fit.opt.goal.${g}.label`)} hint={t(`fit.opt.goal.${g}.hint`)} checked={field.value === g} onChange={() => field.onChange(g)} />
								))}
							</>
						)} />
					</div>
				)}

				{current === "experience" && (
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

				{current === "where" && (
					<div className={styles.stack}>
						<Controller control={control} name="location" render={({ field }) => (
							<>
								{LOCATIONS.map((l) => (
									<OptionCard key={l} type="radio" name="location" label={t(`fit.opt.location.${l}.label`)} hint={t(`fit.opt.location.${l}.hint`)} checked={field.value === l} onChange={() => field.onChange(l)} />
								))}
							</>
						)} />
						{values.location !== "gym" && (
							<fieldset className={styles.group}>
								<legend className={styles.legend}>{t("fit.onboarding.equipment")}</legend>
								<p className={styles.note}>{t("fit.onboarding.equipmentNote")}</p>
								<div className={styles.chips}>
									<Controller control={control} name="equipment" render={({ field }) => (
										<>
											{EQUIPMENT.map((e) => (
												<OptionCard key={e} compact type="checkbox" name="equipment" label={t(`fit.opt.equipment.${e}`)} checked={field.value.includes(e)} onChange={() => field.onChange(toggle(field.value, e))} />
											))}
										</>
									)} />
								</div>
							</fieldset>
						)}
					</div>
				)}

				{current === "schedule" && (
					<div className={styles.stack}>
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
						<fieldset className={styles.group}>
							<legend className={styles.legend}>{t("fit.onboarding.days")}</legend>
							<div className={styles.chips}>
								<Controller control={control} name="daysPerWeek" render={({ field }) => (
									<>
										{DAYS.map((d) => (
											<OptionCard key={d} compact type="radio" name="days" label={t("fit.onboarding.daysOption", { n: d })} checked={field.value === d} onChange={() => field.onChange(d)} />
										))}
									</>
								)} />
							</div>
							<p className={styles.note}>{t("fit.onboarding.daysNote")}</p>
						</fieldset>
					</div>
				)}

				{current === "limits" && (
					<div className={styles.stack}>
						<Controller control={control} name="limitations" render={({ field }) => (
							<>
								{LIMITATIONS.map((l) => (
									<OptionCard key={l} type="checkbox" name="limitations" label={t(`fit.opt.limitation.${l}.label`)} hint={t(`fit.opt.limitation.${l}.hint`)} checked={field.value.includes(l)} onChange={() => field.onChange(toggle(field.value, l))} />
								))}
							</>
						)} />
						{values.limitations.includes("heart-bp") && <p className={styles.warning}>{t("fit.onboarding.heartNote")}</p>}
						<Textarea label={t("fit.onboarding.limitNote")} rows={3} {...register("limitationNote")} />
					</div>
				)}

				{current === "wearable" && (
					<div className={styles.stack}>
						<Controller control={control} name="wearable" render={({ field }) => (
							<>
								{WEARABLES.map((w) => (
									<OptionCard key={w} type="radio" name="wearable" label={t(`fit.opt.wearable.${w}.label`)} hint={t(`fit.opt.wearable.${w}.hint`)} checked={field.value === w} onChange={() => field.onChange(w)} />
								))}
							</>
						)} />
						<p className={styles.note}>{t("fit.onboarding.wearableNote")}</p>
					</div>
				)}

				{current === "summary" && (
					<div className={styles.stack}>
						<Card className={styles.summary}>
							<h2 className={styles.summaryTitle}>{t("fit.onboarding.summaryFor", { name: values.name })}</h2>
							<div className={styles.badges}>
								<Badge tone="accent">{t(`fit.opt.goal.${values.goal}.label`)}</Badge>
								<Badge>{t(`fit.opt.experience.${values.experience}.label`)}</Badge>
								<Badge>{t(`fit.opt.location.${values.location}.label`)}</Badge>
								<Badge>{t("fit.onboarding.daysOption", { n: values.daysPerWeek })}</Badge>
								<Badge>
									{values.durationMin} {t("fit.common.minShort")}
								</Badge>
							</div>
						</Card>
						<ul className={styles.week} aria-label={t("fit.onboarding.firstWeek")}>
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
						{mode === "create" && <Switch label={t("fit.onboarding.demoHistory")} checked={demoHistory} onChange={(e) => setDemoHistory(e.target.checked)} />}
						{mode === "create" && <p className={styles.note}>{t("fit.onboarding.demoHistoryNote")}</p>}
						{mode === "edit" && <p className={styles.note}>{t("fit.onboarding.editNote")}</p>}
					</div>
				)}
			</div>

			<div className={styles.footer}>
				{last ? (
					<Button size="lg" onClick={submit}>
						{mode === "create" ? t("fit.onboarding.finish") : t("fit.onboarding.save")}
					</Button>
				) : (
					<Button size="lg" onClick={next}>
						{t("fit.common.continue")}
					</Button>
				)}
			</div>
		</div>
	);
}
