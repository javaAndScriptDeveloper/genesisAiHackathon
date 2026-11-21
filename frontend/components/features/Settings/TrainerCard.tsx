"use client";

import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { Avatar, Card, Icon, Skeleton, useToast } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
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

	return (
		<Card className={kit.stack}>
			<h2 className={`${kit.h2} ${kit.heading}`}><Icon icon={UserGroupIcon} size={20} />{t("fit.settings.trainerTitle")}</h2>
			<p className={kit.note}>{t("fit.settings.trainerNote")}</p>
			{isPending && <Skeleton height="8rem" />}
			{isError && <p className={kit.note}>{t("fit.settings.trainerLoadFailed")}</p>}
			{trainers?.map((tr) => (
				<div key={tr.id} className={styles.item}>
					<Avatar name={tr.name} src={tr.pathToImage} size={48} />
					<OptionCard type="radio" name="trainer" label={tr.name} hint={tr.tov} checked={tr.id === selected} onChange={() => { dispatch({ type: "set-trainer", trainerId: tr.id }); toast.show(t("fit.settings.trainerSet", { name: tr.name }), "success"); }} />
				</div>
			))}
		</Card>
	);
}
