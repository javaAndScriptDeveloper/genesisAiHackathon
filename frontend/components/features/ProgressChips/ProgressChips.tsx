"use client";

import { FireIcon, Medal01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Badge, Icon } from "@/components/ui";
import { useFit } from "@/lib/fit/store/FitProvider";
import { progressOf } from "@/lib/fit/store/progressStats";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ProgressChips.module.scss";

/** Streak (weeks at goal) and level at a glance in the Today header; both open Progress. */
export function ProgressChips() {
	const t = useT();
	const { state, today } = useFit();
	const { streak, level } = progressOf(state, today);
	return (
		<span className={styles.chips}>
			<Link href="/progress" transitionTypes={["nav-forward"]} className={styles.chip} aria-label={t("fit.nudges.streakChip", { n: streak.current })}>
				<Badge tone={streak.current > 0 ? "accent" : "neutral"}><Icon icon={FireIcon} size={12} /> {streak.current}</Badge>
			</Link>
			<Link href="/progress" transitionTypes={["nav-forward"]} className={styles.chip} aria-label={t("fit.nudges.levelChip", { n: level.level })}>
				<Badge><Icon icon={Medal01Icon} size={12} /> {level.level}</Badge>
			</Link>
		</span>
	);
}
