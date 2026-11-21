"use client";

import { CrownIcon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef } from "react";
import { Notice } from "@/components/features/Notice/Notice";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Badge, Button, Card, Icon, useToast } from "@/components/ui";
import { track } from "@/lib/fit/analytics";
import { formatDay } from "@/lib/fit/dates";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";
import styles from "./Subscription.module.scss";

const FREE = ["plan", "workouts", "library", "coach", "progress", "safety"];
const PREMIUM = ["adaptive", "insights", "rebuild", "photos", "partners"];

export function Subscription({ source }: { source: string }) {
	const t = useT();
	const toast = useToast();
	const { state, dispatch } = useFit();
	const premium = state.subscription.tier === "premium";
	const viewedSource = useRef<string | null>(null);
	useEffect(() => {
		if (viewedSource.current === source) return;
		viewedSource.current = source;
		track("subscription_viewed", { source });
	}, [source]);

	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.subscription.title")} back />
			<div className={kit.content}>
				<Notice>{t("fit.subscription.demoNotice")}</Notice>

				{premium && (
					<Card className={styles.active}>
						<Badge tone="success">{t("fit.subscription.active")}</Badge>
						<p className={kit.p}>{state.subscription.trialEndsAt ? t("fit.subscription.trialUntil", { day: formatDay(state.subscription.trialEndsAt.slice(0, 10)) }) : t("fit.subscription.premiumOn")}</p>
					</Card>
				)}

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.subscription.freeTitle")}</h2>
					<p className={kit.note}>{t("fit.subscription.freeNote")}</p>
					<ul className={styles.features}>
						{FREE.map((f) => <li key={f}><Icon icon={Tick02Icon} size={16} />{t(`fit.subscription.free.${f}`)}</li>)}
					</ul>
				</Card>

				<Card className={`${kit.stack} ${styles.premium}`}>
					<Badge tone="accent"><Icon icon={CrownIcon} size={12} /> {t("fit.common.premium")}</Badge>
					<h2 className={kit.h2}>{t("fit.subscription.premiumTitle")}</h2>
					<ul className={styles.features}>
						{PREMIUM.map((f) => (
							<li key={f}>
								<Icon icon={Tick02Icon} size={16} />
								<span><strong>{t(`fit.subscription.premium.${f}.title`)}</strong><span>{t(`fit.subscription.premium.${f}.body`)}</span></span>
							</li>
						))}
					</ul>
					{premium ? (
						<Button variant="secondary" onClick={() => { dispatch({ type: "end-premium" }); toast.show(t("fit.subscription.ended"), "info"); }}>{t("fit.subscription.end")}</Button>
					) : (
						<>
							<Button size="lg" onClick={() => { dispatch({ type: "start-trial", now: new Date().toISOString() }); toast.show(t("fit.subscription.started"), "success"); }}>{t("fit.subscription.start")}</Button>
							<p className={kit.note}>{t("fit.subscription.priceNote")}</p>
						</>
					)}
				</Card>
				<p className={kit.note}>{t("fit.subscription.safetyPromise")}</p>
			</div>
		</div>
	);
}
