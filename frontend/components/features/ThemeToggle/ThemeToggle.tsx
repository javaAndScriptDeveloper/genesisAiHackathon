"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { Icon } from "@/components/ui";
import { useTheme } from "@/lib/hooks/useTheme";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ThemeToggle.module.scss";

// Small header pill that switches the Training UI theme. The knob sits on the active mode's icon.
export function ThemeToggle({ className }: { className?: string }) {
	const t = useT();
	const { theme, setTheme } = useTheme();
	const dark = theme === "dark";
	return (
		<button type="button" role="switch" aria-checked={dark} aria-label={t("fit.theme.dark")} title={dark ? t("fit.theme.toLight") : t("fit.theme.toDark")} className={clsx(styles.root, dark && styles.dark, className)} onClick={() => setTheme(dark ? "light" : "dark")}>
			<span className={styles.track}>
				<span className={styles.knob} />
				<Icon icon={Sun03Icon} size={14} className={clsx(styles.icon, !dark && styles.iconOn)} />
				<Icon icon={Moon02Icon} size={14} className={clsx(styles.icon, dark && styles.iconOn)} />
			</span>
		</button>
	);
}
