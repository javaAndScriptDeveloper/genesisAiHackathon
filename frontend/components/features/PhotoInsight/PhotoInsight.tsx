"use client";

import { SparklesIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useMemo, useState } from "react";
import { PremiumGate, usePremium } from "@/components/features/PremiumGate/PremiumGate";
import { Badge, Button, Card, Checkbox, Icon, Sheet, Skeleton } from "@/components/ui";
import { requestPhotoInsight, mockAllowed, type PhotoInsightError } from "@/lib/api/photoInsight";
import { formatDay } from "@/lib/fit/dates";
import { findExercise } from "@/lib/fit/exercises";
import { buildContext, defaultPair, gating, orderPair, toInsight } from "@/lib/fit/photoInsight";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useProgress } from "@/lib/fit/store/hooks";
import type { PhotoCheckIn, PhotoInsight } from "@/lib/fit/types";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ENGINE_VERSION } from "@/lib/progress";
import styles from "./PhotoInsight.module.scss";

type Stage = "closed" | "pick" | "consent" | "loading" | "result" | "error";

const ERROR_KEY: Record<PhotoInsightError, string> = {
	rate_limited: "fit.photoAi.errRateLimited",
	unavailable: "fit.photoAi.errUnavailable",
	failed: "fit.photoAi.errFailed",
	network: "fit.photoAi.errNetwork",
	invalid: "fit.photoAi.errInvalid",
};

function InsightBody({ insight }: { insight: PhotoInsight }) {
	const { t } = useI18n();
	return (
		<div className={styles.body}>
			<p className={styles.summary}>{insight.result.summary}</p>
			{insight.suitable ? (
				<>
					{insight.result.observations.length > 0 && (
						<>
							<h4 className={styles.h4}>{t("fit.photoAi.observations")}</h4>
							<ul className={styles.obs}>
								{insight.result.observations.map((o) => (
									<li key={`${o.area}-${o.text}`}>
										<strong>{o.area}</strong>
										<span>{o.text}</span>
									</li>
								))}
							</ul>
						</>
					)}
					<p className={styles.encourage}>{insight.result.encouragement}</p>
				</>
			) : (
				<p className={styles.note}>{t("fit.photoAi.unsuitable")}</p>
			)}
			<p className={styles.disclaimer}>{t("fit.photoAi.disclaimer")}</p>
		</div>
	);
}

/** Thumbnails of the compared photos that still exist on this device; deleted ones are simply omitted (the dates stay in the summary). */
function HistoryPhotos({ insight, photos }: { insight: PhotoInsight; photos: PhotoCheckIn[] }) {
	const { t } = useI18n();
	const found = [insight.beforePhotoId, insight.afterPhotoId].flatMap((id) => photos.find((p) => p.id === id) ?? []);
	if (found.length === 0) return null;
	return (
		<ul className={styles.historyPhotos}>
			{found.map((p) => (
				<li key={p.id}>
					{/* eslint-disable-next-line @next/next/no-img-element -- local data URL, not optimizable */}
					<img src={p.dataUrl} alt={t("fit.progress.photoAlt", { day: formatDay(p.date) })} />
				</li>
			))}
		</ul>
	);
}

export function PhotoInsightSection() {
	const { t, locale } = useI18n();
	const { state, dispatch } = useFit();
	const premium = usePremium();
	const progress = useProgress();
	const [stage, setStage] = useState<Stage>("closed");
	const [picked, setPicked] = useState<string[] | null>(null);
	const [remember, setRemember] = useState(false);
	const [error, setError] = useState<PhotoInsightError>("failed");
	const [current, setCurrent] = useState<PhotoInsight | null>(null);

	const photos = state.photos;
	const gate = gating(photos.length, state.photoInsights.length, premium);
	const ids = picked ?? (() => {
		const d = defaultPair(photos);
		return d ? [d.before.id, d.after.id] : [];
	})();
	const chosen = ids.flatMap((id) => photos.find((p) => p.id === id) ?? []);
	const pair = useMemo(() => (chosen[0] && chosen[1] ? orderPair(chosen[0], chosen[1]) : null), [chosen[0], chosen[1]]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!gate.showButton) return null;

	const toggle = (id: string) => {
		const cur = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2);
		setPicked(cur);
	};

	const run = async () => {
		if (!pair) return;
		setStage("loading");
		const context = buildContext({
			pair,
			bodyWeights: state.bodyWeights,
			consistency: progress.consistency.score,
			streakWeeks: progress.streak.current,
			records: progress.records,
			exerciseName: (id) => findExercise(id)?.name ?? id,
		});
		const outcome = await requestPhotoInsight({ token: state.progressToken, locale, pair, context, mock: mockAllowed(window.location.search) });
		if (!outcome.ok) {
			setError(outcome.error);
			setStage("error");
			return;
		}
		const insight = toInsight({
			id: `pi${Date.now()}`,
			now: new Date().toISOString(),
			pair,
			model: outcome.data.model ?? "gemini",
			engineVersion: ENGINE_VERSION,
			result: { suitable: outcome.data.suitable, summary: outcome.data.summary, observations: outcome.data.observations, encouragement: outcome.data.encouragement },
		});
		dispatch({ type: "add-photo-insight", insight });
		setCurrent(insight);
		setStage("result");
	};

	const analyze = () => {
		if (state.photoAiConsentAt) void run();
		else setStage("consent");
	};

	const confirm = () => {
		if (remember) dispatch({ type: "photo-ai-consent", at: new Date().toISOString() });
		void run();
	};

	const close = () => setStage("closed");
	const range = (i: { beforeDate: string; afterDate: string }) => t("fit.photoAi.period", { before: formatDay(i.beforeDate), after: formatDay(i.afterDate) });

	return (
		<div className={styles.section}>
			{gate.premiumGate ? (
				<PremiumGate title={t("fit.photoAi.lockedTitle")} body={t("fit.photoAi.lockedBody")} source="photo-ai">
					<span />
				</PremiumGate>
			) : (
				<Button variant="secondary" iconLeft={SparklesIcon} onClick={() => setStage("pick")}>
					{t("fit.photoAi.button")}
				</Button>
			)}

			{state.photoInsights.length > 0 && (
				<div>
					<h4 className={styles.h4}>{t("fit.photoAi.history")}</h4>
					<ul className={styles.history}>
						{state.photoInsights.map((i) => (
							<li key={i.id}>
								<details>
									<summary>{range(i)}</summary>
									<HistoryPhotos insight={i} photos={photos} />
									<InsightBody insight={i} />
								</details>
							</li>
						))}
					</ul>
				</div>
			)}

			<Sheet open={stage === "pick" || stage === "loading" || stage === "result" || stage === "error"} onClose={close} title={stage === "result" ? t("fit.photoAi.resultTitle") : t("fit.photoAi.title")} closeLabel={t("fit.photoAi.close")} modal={stage === "loading"}>
				{stage === "pick" && (
					<div className={styles.stack}>
						<h3 className={styles.h3}>{t("fit.photoAi.pickTitle")}</h3>
						<p className={styles.note}>{t("fit.photoAi.pickHint")}</p>
						<ul className={styles.grid}>
							{[...photos].sort((a, b) => a.date.localeCompare(b.date)).map((p) => {
								const on = ids.includes(p.id);
								const role = on && pair ? (pair.before.id === p.id ? t("fit.photoAi.selectedBefore") : t("fit.photoAi.selectedAfter")) : on ? t("fit.photoAi.selectedBefore") : t("fit.photoAi.notSelected");
								return (
									<li key={p.id}>
										<button type="button" className={styles.thumb} aria-pressed={on} onClick={() => toggle(p.id)}>
											{/* eslint-disable-next-line @next/next/no-img-element -- local data URL, not optimizable */}
											<img src={p.dataUrl} alt={t("fit.progress.photoAlt", { day: formatDay(p.date) })} />
											{on && (
												<span className={styles.tick} aria-hidden>
													<Icon icon={Tick02Icon} size={16} strokeWidth={3} />
												</span>
											)}
											<span className={styles.caption}>
												<strong>{formatDay(p.date)}</strong>
												<span>{role}</span>
											</span>
										</button>
									</li>
								);
							})}
						</ul>
						{!pair && <p className={styles.note}>{t("fit.photoAi.needTwo")}</p>}
					</div>
				)}
				{stage === "loading" && (
					<div className={styles.stack} role="status" aria-live="polite">
						<p className={styles.note}>{t("fit.photoAi.loading")}</p>
						<Skeleton height="2rem" />
						<Skeleton height="6rem" />
						<Skeleton height="4rem" />
					</div>
				)}
				{stage === "error" && (
					<div className={styles.stack} role="alert">
						<p className={styles.err}>{t(ERROR_KEY[error])}</p>
					</div>
				)}
				{stage === "result" && current && (
					<Card className={styles.result}>
						<Badge tone="accent">
							<Icon icon={SparklesIcon} size={12} /> {range(current)}
						</Badge>
						<InsightBody insight={current} />
					</Card>
				)}
				{stage === "pick" && (
					<div className={styles.actions}>
						<Button variant="secondary" onClick={close}>{t("fit.photoAi.consentCancel")}</Button>
						<Button disabled={!pair} onClick={analyze}>{t("fit.photoAi.run")}</Button>
					</div>
				)}
				{stage === "error" && (
					<div className={styles.actions}>
						<Button variant="secondary" onClick={close}>{t("fit.photoAi.close")}</Button>
						{error !== "rate_limited" && error !== "unavailable" && <Button onClick={analyze}>{t("fit.photoAi.retry")}</Button>}
					</div>
				)}
				{stage === "result" && (
					<div className={styles.actions}>
						<Button onClick={close}>{t("fit.photoAi.close")}</Button>
					</div>
				)}
			</Sheet>

			<Sheet
				open={stage === "consent"}
				onClose={() => setStage("pick")}
				title={t("fit.photoAi.consentTitle")}
				closeLabel={t("fit.photoAi.close")}
				variant="center"
				footer={
					<>
						<Button variant="secondary" onClick={() => setStage("pick")}>{t("fit.photoAi.consentCancel")}</Button>
						<Button onClick={confirm}>{t("fit.photoAi.consentSend")}</Button>
					</>
				}
			>
				<div className={styles.stack}>
					<p>{t("fit.photoAi.consentBody")}</p>
					<p className={styles.note}>{t("fit.photoAi.consentHttp")}</p>
					<Checkbox label={t("fit.photoAi.consentRemember")} checked={remember} onChange={(e) => setRemember(e.target.checked)} />
				</div>
			</Sheet>
		</div>
	);
}
