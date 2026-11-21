"use client";

import { Awards } from "@/components/features/Awards/Awards";
import { CheckIns } from "@/components/features/CheckIns/CheckIns";
import { History } from "@/components/features/History/History";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ProgressSection.module.scss";

export type ProgressSectionId = "history" | "checkins" | "achievements";

/** The former Progress tabs (History, Check-ins, Awards) as their own screens, reached from the Progress list. */
export function ProgressSection({ section }: { section: ProgressSectionId }) {
	const t = useT();
	return (
		<div className={styles.root}>
			<ScreenHeader title={t(`fit.progress.main.nav.${section}`)} back="/progress" />
			<div className={styles.content}>
				{section === "history" && <History />}
				{section === "checkins" && <CheckIns />}
				{section === "achievements" && <Awards />}
			</div>
		</div>
	);
}
