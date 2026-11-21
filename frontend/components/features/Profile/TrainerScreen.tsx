"use client";

import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";
import { TrainerCard } from "./TrainerCard";

export function TrainerScreen() {
	const t = useT();
	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.profile.trainerRow")} back="/profile" />
			<div className={kit.content}>
				<TrainerCard />
			</div>
		</div>
	);
}
