"use client";

import clsx from "clsx";
import { Chat01Icon, ChartUpIcon, Dumbbell03Icon, Home03Icon, UserIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconDefinition } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./BottomNav.module.scss";

const TABS: { href: string; key: string; icon: IconDefinition }[] = [
	{ href: "/today", key: "today", icon: Home03Icon },
	{ href: "/training", key: "training", icon: Dumbbell03Icon },
	{ href: "/progress", key: "progress", icon: ChartUpIcon },
	{ href: "/coach", key: "coach", icon: Chat01Icon },
	{ href: "/profile", key: "profile", icon: UserIcon },
];

export function BottomNav() {
	const pathname = usePathname();
	const t = useT();
	const currentIndex = TABS.findIndex((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
	return (
		<nav className={styles.nav} aria-label={t("fit.nav.label")}>
			{TABS.map((tab, index) => {
				const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
				return (
					<Link key={tab.href} href={tab.href} transitionTypes={[index >= currentIndex ? "nav-forward" : "nav-back"]} className={clsx(styles.tab, active && styles.active)} aria-current={active ? "page" : undefined}>
						<Icon icon={tab.icon} size={24} strokeWidth={active ? 2.2 : 1.75} />
						<span>{t(`fit.nav.${tab.key}`)}</span>
					</Link>
				);
			})}
		</nav>
	);
}
