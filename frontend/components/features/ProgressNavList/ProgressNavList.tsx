"use client";

import { Analytics01Icon, ArrowRight01Icon, Award01Icon, Calendar03Icon, Camera01Icon, Clock01Icon, WeightScaleIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Badge, Icon, type IconDefinition } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ProgressNavList.module.scss";

export interface ProgressNavItem {
	id: "calendar" | "weight" | "report" | "achievements" | "history" | "checkins";
	/** Null renders a quiet, non-interactive row (e.g. no report yet). */
	href: string | null;
	hint: string;
	/** "New" mark or a "+N" counter for unseen events. */
	mark?: string;
}

const ICON: Record<ProgressNavItem["id"], IconDefinition> = {
	calendar: Calendar03Icon,
	weight: WeightScaleIcon,
	report: Analytics01Icon,
	achievements: Award01Icon,
	history: Clock01Icon,
	checkins: Camera01Icon,
};

/** Rows to every Progress sub-screen. Unseen events show as a text mark, not color alone. */
export function ProgressNavList({ items }: { items: ProgressNavItem[] }) {
	const t = useT();
	return (
		<nav className={styles.root} aria-labelledby="progress-nav-title">
			<h2 id="progress-nav-title" className={styles.title}>
				{t("fit.progress.main.nav.title")}
			</h2>
			<ul className={styles.list}>
				{items.map((item) => {
					const body = (
						<>
							<span className={styles.icon}>
								<Icon icon={ICON[item.id]} size={20} />
							</span>
							<span className={styles.text}>
								<span className={styles.name}>{t(`fit.progress.main.nav.${item.id}`)}</span>
								<span className={styles.hint}>{item.hint}</span>
							</span>
							{item.mark && <Badge tone="accent">{item.mark}</Badge>}
							{item.href && <Icon icon={ArrowRight01Icon} size={18} className={styles.chevron} />}
						</>
					);
					return (
						<li key={item.id}>
							{item.href ? (
								<Link href={item.href} transitionTypes={["nav-forward"]} className={styles.row}>
									{body}
								</Link>
							) : (
								<span className={styles.row} data-disabled>
									{body}
								</span>
							)}
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
