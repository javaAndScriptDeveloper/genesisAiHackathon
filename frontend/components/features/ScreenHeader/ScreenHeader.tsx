"use client";

import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/features/ThemeToggle/ThemeToggle";
import { IconButton } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ScreenHeader.module.scss";

interface ScreenHeaderProps {
	title: string;
	subtitle?: string;
	/** Show a back button. A string overrides the destination, otherwise history back. */
	back?: boolean | string;
	actions?: ReactNode;
}

export function ScreenHeader({ title, subtitle, back, actions }: ScreenHeaderProps) {
	const router = useRouter();
	const t = useT();
	return (
		<header className={styles.header}>
			{back && <IconButton icon={ArrowLeft02Icon} label={t("fit.common.back")} onClick={() => (typeof back === "string" ? router.push(back) : router.back())} />}
			<div className={styles.titles}>
				<h1 className={styles.title}>{title}</h1>
				{subtitle && <p className={styles.subtitle}>{subtitle}</p>}
			</div>
			<div className={styles.actions}>
				{actions}
				<ThemeToggle />
			</div>
		</header>
	);
}
