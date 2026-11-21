"use client";

import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { Avatar, Card, Icon, Skeleton, useToast } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { useAiPlan } from "@/lib/fit/store/useAiPlan";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import { OptionCard } from "../OptionCard/OptionCard";
import kit from "../ScreenKit/ScreenKit.module.scss";
import styles from "./TrainerCard.module.scss";

export function TrainerCard() {
	const t = useT();
	const toast = useToast();
	const { state, dispatch } = useFit();
	const { data: trainers, isPending, isError } = useTrainers();
	const selected = activeTrainerId(state);
	const { rebuild } = useAiPlan();

	const choose = async (id: string, name: string) => {
		dispatch({ type: "set-trainer", trainerId: id });
		toast.show(t("fit.settings.trainerSet", { name }), "success");
		toast.show(t("fit.ai.rebuilding"), "info");
		const result = await rebuild({ trainerSlug: id });
		toast.show(t(result === "failed" ? "fit.ai.rebuildFailed" : "fit.ai.rebuilt"), result === "failed" ? "danger" : "success");
	};

	return (
		<Card className={kit.stack}>
			<h2 className={`${kit.h2} ${kit.heading}`}><Icon icon={UserGroupIcon} size={20} />{t("fit.settings.trainerTitle")}</h2>
			<p className={kit.note}>{t("fit.settings.trainerNote")}</p>
			{isPending && <Skeleton height="8rem" />}
			{isError && <p className={kit.note}>{t("fit.settings.trainerLoadFailed")}</p>}
			{trainers?.map((tr) => (
				<div key={tr.id} className={styles.item}>
					<Avatar name={tr.name} src={tr.pathToImage} size={48} />
					<OptionCard type="radio" name="trainer" label={tr.name} hint={tr.tov} checked={tr.id === selected} onChange={() => void choose(tr.id, tr.name)} />
				</div>
			))}
		</Card>
	);
}
