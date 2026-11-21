"use client";

import { Avatar, Button, Card } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useActionNavigate } from "@/lib/fit/store/hooks";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./TrainerNudge.module.scss";

/** The newest unread notification the trainer speaks, as a card at the top of Today. */
export function TrainerNudge() {
	const t = useT();
	const { state, dispatch } = useFit();
	const go = useActionNavigate();
	const { data: trainers } = useTrainers();
	const note = state.notifications.find((n) => n.nudge !== undefined && !n.read);
	if (!note) return null;
	const trainer = trainers?.find((tr) => tr.id === activeTrainerId(state));
	const name = trainer?.name ?? "";
	return (
		<Card className={styles.card}>
			<div className={styles.head}>
				{trainer && <Avatar name={trainer.name} src={trainer.pathToImage} size={40} />}
				<strong>{name ? t("fit.nudges.fromTrainer", { name }) : note.title}</strong>
			</div>
			<p className={styles.text}>{note.aiText ?? note.body}</p>
			<div className={styles.actions}>
				{note.href && <Button size="sm" onClick={() => go(note.href ?? "/today", { type: "notification-read", id: note.id })}>{t("fit.nudges.open")}</Button>}
				<Button size="sm" variant="ghost" onClick={() => dispatch({ type: "notification-read", id: note.id })}>{t("fit.nudges.dismiss")}</Button>
			</div>
		</Card>
	);
}
