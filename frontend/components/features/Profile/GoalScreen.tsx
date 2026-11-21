"use client";

import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";
import { GoalCard } from "./GoalCard";

export function GoalScreen() {
	const t = useT();
	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.profile.goalRow")} back="/profile" />
			<div className={kit.content}>
				<GoalCard />
			</div>
		</div>
	);
}
