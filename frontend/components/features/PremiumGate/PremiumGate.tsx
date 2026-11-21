"use client";

import { CrownIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button, Card, Icon } from "@/components/ui";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./PremiumGate.module.scss";

/** Renders children for Premium users, a calm upgrade card otherwise. Never wraps training or safety features. */
export function PremiumGate({ children, title, body, source }: { children: ReactNode; title: string; body: string; source: string }) {
	const { state } = useFit();
	const t = useT();
	if (state.subscription.tier === "premium") return <>{children}</>;
	return (
		<Card className={styles.card}>
			<Badge tone="accent">
				<Icon icon={CrownIcon} size={12} /> {t("fit.common.premium")}
			</Badge>
			<h3>{title}</h3>
			<p>{body}</p>
			<Link href={`/subscription?from=${source}`} tabIndex={-1}>
				<Button size="sm">{t("fit.gate.cta")}</Button>
			</Link>
		</Card>
	);
}

export function usePremium(): boolean {
	return useFit().state.subscription.tier === "premium";
}
