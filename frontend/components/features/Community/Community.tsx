"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Avatar, Badge, Button, Card, Icon, useToast } from "@/components/ui";
import { BUDDIES, type Buddy } from "@/lib/fit/community";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

export function Community() {
	const t = useT();
	const toast = useToast();
	const { state, dispatch } = useFit();
	const waiting = BUDDIES.some((b) => state.partners[b.id] === "invited");

	// Approval is derived from the invite time, so polling here only moves the clock forward.
	useEffect(() => {
		if (!waiting) return;
		const id = window.setInterval(() => dispatch({ type: "partners-sync", now: new Date().toISOString() }), 1000);
		dispatch({ type: "partners-sync", now: new Date().toISOString() });
		return () => window.clearInterval(id);
	}, [waiting, dispatch]);

	// Tell the user when a request they sent while on this screen gets approved.
	const seen = useRef(state.partners);
	useEffect(() => {
		for (const b of BUDDIES) if (seen.current[b.id] === "invited" && state.partners[b.id] === "accepted") toast.show(t("fit.community.approved", { name: b.name }), "success");
		seen.current = state.partners;
	}, [state.partners, toast, t]);

	const connect = (b: Buddy) => {
		dispatch({ type: "partner", id: b.id, status: "invited", now: new Date().toISOString() });
		toast.show(t("fit.community.requestSent", { name: b.name }), "info");
	};
	const when = (daysAgo: number) => (daysAgo === 0 ? t("fit.community.when.today") : daysAgo === 1 ? t("fit.community.when.yesterday") : t("fit.community.when.daysAgo", { n: daysAgo }));
	const byStatus = (status: "accepted" | "invited" | undefined) => BUDDIES.filter((b) => state.partners[b.id] === status);
	const connected = byStatus("accepted");
	const awaiting = byStatus("invited");
	const others = byStatus(undefined);

	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.community.title")} />
			<div className={kit.content}>

				{connected.length > 0 && (
					<section className={kit.stack}>
						<h2 className={kit.h2}>{t("fit.community.connectedTitle")}</h2>
						<ul className={kit.list}>
							{connected.map((b) => (
								<li key={b.id}>
									<Link href={`/community/${b.id}`} transitionTypes={["nav-forward"]} className={kit.row}>
										<Avatar name={b.name} />
										<span className={kit.rowText}>
											<strong>{b.name}</strong>
											<span>{t("fit.community.lastWorkout", { title: b.results.lastWorkout.title, when: when(b.results.lastWorkout.daysAgo) })}</span>
										</span>
										<Icon icon={ArrowRight01Icon} size={16} />
									</Link>
								</li>
							))}
						</ul>
					</section>
				)}

				{awaiting.length > 0 && (
					<section className={kit.stack}>
						<h2 className={kit.h2}>{t("fit.community.awaitingTitle")}</h2>
						<ul className={kit.list}>
							{awaiting.map((b) => (
								<li key={b.id}>
									<Card className={kit.stack}>
										<div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
											<Avatar name={b.name} />
											<span className={kit.rowText}>
												<strong>{b.name}</strong>
												<span>{t(`fit.opt.goal.${b.goal}.label`)} · {t("fit.community.level", { n: b.level })}</span>
											</span>
											<Badge tone="warning">{t("fit.community.awaiting")}</Badge>
										</div>
										<Button size="sm" variant="ghost" onClick={() => dispatch({ type: "partner", id: b.id, status: null })}>{t("fit.community.cancelRequest")}</Button>
									</Card>
								</li>
							))}
						</ul>
					</section>
				)}

				{others.length > 0 && (
					<section className={kit.stack}>
						<h2 className={kit.h2}>{t("fit.community.findTitle")}</h2>
						<ul className={kit.list}>
							{others.map((b) => (
								<li key={b.id}>
									<Card className={kit.stack}>
										<div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
											<Avatar name={b.name} />
											<span className={kit.rowText}>
												<strong>{b.name}</strong>
												<span>{t(`fit.opt.goal.${b.goal}.label`)} · {b.days} · {t("fit.community.level", { n: b.level })}</span>
											</span>
										</div>
										<Button size="sm" variant="secondary" onClick={() => connect(b)}>{t("fit.community.connect")}</Button>
									</Card>
								</li>
							))}
						</ul>
					</section>
				)}
			</div>
		</div>
	);
}
