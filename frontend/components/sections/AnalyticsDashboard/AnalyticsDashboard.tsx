"use client";

import Link from "next/link";
import { Activity01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import { EconomicsPanel } from "./EconomicsPanel";
import { ProductActivity } from "./ProductActivity";
import styles from "./AnalyticsDashboard.module.scss";

export function AnalyticsDashboard() {
	const t = useT();

	return (
		<div className={styles.dashboard}>
			<header className={styles.topbar}>
				<div className={styles.frame}>
					<div className={styles.brand}>
						<span className={styles.brandMark}><Icon icon={Activity01Icon} size={22} /></span>
						<span>{t("analytics.brand")}</span>
					</div>
					<nav className={styles.nav} aria-label={t("analytics.title")}>
						<a href="#economics">{t("analytics.economics")}</a>
						<a href="#product-activity">{t("analytics.activity.title")}</a>
					</nav>
					<Link href="/today" className={styles.productLink}>
						{t("analytics.openApp")} <Icon icon={ArrowUpRight01Icon} size={16} />
					</Link>
				</div>
			</header>

			<main className={styles.frame}>
				<EconomicsPanel />
				<ProductActivity />
			</main>
		</div>
	);
}
