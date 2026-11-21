"use client";

import { useEffect, useRef } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Avatar, Badge, Button, Card, useToast } from "@/components/ui";
import { PremiumGate } from "@/components/features/PremiumGate/PremiumGate";
import { formatDay } from "@/lib/fit/dates";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

// Sample profiles for the demo. A real version needs accounts and a backend (see docs).
const PARTNERS = [
	{ id: "maya", name: "Maya K.", goal: "build-muscle", days: "Mon · Wed · Fri", level: 4 },
	{ id: "leo", name: "Leo P.", goal: "lose-fat", days: "Tue · Thu · Sat", level: 3 },
	{ id: "sam", name: "Sam R.", goal: "stay-fit", days: "Mon · Thu", level: 6 },
] as const;

export function Partners() {
	const t = useT();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const timers = useRef<number[]>([]);
	useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
	const next = state.planned.filter((w) => w.status === "planned" && w.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
	const premium = state.subscription.tier === "premium";

	const invite = (id: string, name: string) => {
		dispatch({ type: "partner", id, status: "invited" });
		toast.show(t("fit.partners.invited", { name }), "info");
		timers.current.push(window.setTimeout(() => {
			dispatch({ type: "partner", id, status: "accepted" });
			toast.show(t("fit.partners.accepted", { name }), "success");
		}, 1500));
	};

	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.partners.title")} back />
			<div className={kit.content}>
				<p className={kit.warn}>{t("fit.partners.demoNote")}</p>
				<ul className={kit.list}>
					{PARTNERS.map((p) => {
						const status = state.partners[p.id];
						const joint = next?.partnerId === p.id;
						return (
							<li key={p.id}>
								<Card className={kit.stack}>
									<div style={{ display: "flex", alignItems: "center", gap: "1.2rem" }}>
										<Avatar name={p.name} />
										<span className={kit.rowText}>
											<strong>{p.name}</strong>
											<span>{t(`fit.opt.goal.${p.goal}.label`)} · {p.days} · {t("fit.partners.level", { n: p.level })}</span>
										</span>
										{status && <Badge tone={status === "accepted" ? "success" : "warning"}>{t(`fit.partners.status.${status}`)}</Badge>}
									</div>
									{!status && <Button size="sm" variant="secondary" onClick={() => invite(p.id, p.name)}>{t("fit.partners.invite")}</Button>}
									{status === "accepted" && next && (
										premium ? (
											<Button size="sm" variant={joint ? "secondary" : "primary"} onClick={() => { dispatch({ type: "joint-workout", workoutId: next.id, partnerId: joint ? null : p.id }); toast.show(joint ? t("fit.partners.unscheduled") : t("fit.partners.scheduled", { name: p.name, day: formatDay(next.date) }), "success"); }}>
												{joint ? t("fit.partners.cancelJoint") : t("fit.partners.schedule", { title: next.title, day: formatDay(next.date) })}
											</Button>
										) : (
											<PremiumGate title={t("fit.partners.lockedTitle")} body={t("fit.partners.lockedBody")} source="partners"><span /></PremiumGate>
										)
									)}
									{joint && <p className={kit.note}>{t("fit.partners.jointNote", { name: p.name })}</p>}
									{status && <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "partner", id: p.id, status: null })}>{t("fit.partners.remove")}</Button>}
								</Card>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
