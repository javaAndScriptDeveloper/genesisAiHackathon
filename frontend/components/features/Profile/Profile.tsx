"use client";

import { ArrowRight01Icon, CrownIcon, Dumbbell03Icon, Edit02Icon, Notification03Icon, Restaurant01Icon, Settings02Icon, SmartWatch01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Avatar, Badge, Button, Card, Icon, IconButton, type IconDefinition } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { bmi } from "@/lib/fit/stats";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useFitStats, useUnits } from "@/lib/fit/store/hooks";
import { fmtHeight } from "@/lib/fit/units";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";
import styles from "./Profile.module.scss";

const LINKS: { href: string; key: string; icon: IconDefinition }[] = [
	{ href: "/profile/edit", key: "preferences", icon: Edit02Icon },
	{ href: "/notifications", key: "notifications", icon: Notification03Icon },
	{ href: "/devices", key: "devices", icon: SmartWatch01Icon },
	{ href: "/nutrition", key: "nutrition", icon: Restaurant01Icon },
];

export function Profile() {
	const t = useT();
	const router = useRouter();
	const { state } = useFit();
	const { data: trainers } = useTrainers();
	const trainer = trainers?.find((tr) => tr.id === activeTrainerId(state));
	const stats = useFitStats();
	const u = useUnits();
	const p = state.profile;
	const premium = state.subscription.tier === "premium";
	if (!p) return null;
	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.profile.title")} actions={<IconButton icon={Settings02Icon} label={t("fit.profile.openSettings")} onClick={() => router.push("/settings", { transitionTypes: ["nav-forward"] })} />} />
			<div className={kit.content}>
				<Card className={kit.stack}>
					<div style={{ display: "flex", alignItems: "center", gap: "1.6rem" }}>
						<Avatar name={p.name} />
						<div>
							<h2 className={kit.h2}>{p.name}</h2>
							<p className={kit.note}>{t("fit.profile.levelLine", { level: stats.level.level, xp: stats.xp })}</p>
						</div>
						<Badge tone={premium ? "accent" : "neutral"}>{premium ? t("fit.common.premium") : t("fit.profile.free")}</Badge>
					</div>
					<div className={kit.chips}>
						<Badge tone="accent">
							<Icon icon={Dumbbell03Icon} size={12} />
							{t(`fit.opt.goal.${p.goal}.label`)}
						</Badge>
						<Badge>{t(`fit.opt.experience.${p.experience}.label`)}</Badge>
						<Badge>
							{p.daysPerWeek} {t("fit.profile.perWeek")}
						</Badge>
						<Badge>
							{p.durationMin} {t("fit.common.minShort")}
						</Badge>
					</div>
					<p className={kit.note}>{fmtHeight(p.heightCm, u.units)} · {u.fmtMass(p.weightKg, 1)} · BMI {bmi(p)}</p>
				</Card>
				<Button iconLeft={CrownIcon} variant={premium ? "secondary" : "primary"} onClick={() => router.push("/subscription", { transitionTypes: ["nav-forward"] })}>
					{premium ? t("fit.profile.managePremium") : t("fit.profile.goPremium")}
				</Button>
				<ul className={kit.list}>
					<li>
						<Link href="/profile/goal" transitionTypes={["nav-forward"]} className={kit.row}>
							<span className={kit.plate}>
								<Icon icon={Target02Icon} size={20} />
							</span>
							<span className={kit.rowText}>
								<strong>{t("fit.profile.goalRow")}</strong>
								<span className={styles.goalText}>{p.goalText ?? t(`fit.opt.goal.${p.goal}.label`)}</span>
							</span>
							<Icon icon={ArrowRight01Icon} size={16} />
						</Link>
					</li>
					<li>
						<Link href="/profile/trainer" transitionTypes={["nav-forward"]} className={kit.row}>
							<Avatar name={trainer?.name ?? t("fit.profile.trainerRow")} src={trainer?.pathToImage} size={44} />
							<span className={kit.rowText}>
								<strong>{t("fit.profile.trainerRow")}{trainer ? `: ${trainer.name}` : ""}</strong>
								<span>{trainer ? trainer.tov.split(". ")[0] : t("fit.profile.trainerHint")}</span>
							</span>
							<Icon icon={ArrowRight01Icon} size={16} />
						</Link>
					</li>
					{LINKS.map((l) => (
						<li key={l.href}>
							<Link href={l.href} transitionTypes={["nav-forward"]} className={kit.row}>
								<span className={kit.plate}>
									<Icon icon={l.icon} size={20} />
								</span>
								<span className={kit.rowText}>
									<strong>{t(`fit.profile.links.${l.key}.label`)}</strong>
									<span>{t(`fit.profile.links.${l.key}.hint`)}</span>
								</span>
								<Icon icon={ArrowRight01Icon} size={16} />
							</Link>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
