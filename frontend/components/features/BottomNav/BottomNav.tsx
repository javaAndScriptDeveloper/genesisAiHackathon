"use client";

import clsx from "clsx";
import { ChartUpIcon, Dumbbell03Icon, Home03Icon, UserIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconDefinition } from "@/components/ui";
import { useSlidingIndicator } from "@/lib/hooks/useSlidingIndicator";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./BottomNav.module.scss";

const TABS: { href: string; key: string; icon: IconDefinition }[] = [
	{ href: "/today", key: "today", icon: Home03Icon },
	{ href: "/training", key: "training", icon: Dumbbell03Icon },
	{ href: "/progress", key: "progress", icon: ChartUpIcon },
	{ href: "/profile", key: "profile", icon: UserIcon },
];

export function BottomNav() {
	const pathname = usePathname();
	const t = useT();
	const currentIndex = TABS.findIndex((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
	const { container, indicator, register } = useSlidingIndicator(TABS[currentIndex]?.href ?? "");
	return (
		<nav className={styles.nav} aria-label={t("fit.nav.label")} ref={container}>
			<span ref={indicator} className={styles.indicator} aria-hidden />
			{TABS.map((tab, index) => {
				const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
				// On the tab's own root page the link does nothing, so a tap can't reset the screen to its default state.
				const current = pathname === tab.href;
				return (
					<Link key={tab.href} ref={register(tab.href)} href={tab.href} transitionTypes={[index >= currentIndex ? "nav-forward" : "nav-back"]} className={clsx(styles.tab, active && styles.active, current && styles.current)} aria-current={active ? "page" : undefined} onClick={current ? (event) => event.preventDefault() : undefined}>
						<Icon icon={tab.icon} size={24} strokeWidth={active ? 2.2 : 1.75} />
						<span>{t(`fit.nav.${tab.key}`)}</span>
					</Link>
				);
			})}
		</nav>
	);
}
