"use client";

import { Button } from "@/components/ui";
import { profileDiff, type ChangeValue, type ProfileChange } from "@/lib/fit/coachChat";
import type { CoachMessage, Profile } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./RebuildCard.module.scss";

interface Props {
	rebuild: NonNullable<CoachMessage["rebuild"]>;
	profile: Profile;
	applied: boolean;
	busy: boolean;
	onRecreate: () => void;
}

export function RebuildCard({ rebuild, profile, applied, busy, onRecreate }: Props) {
	const t = useT();
	const changes = profileDiff(profile, rebuild.profileChanges);

	const label = (c: ProfileChange, v: ChangeValue): string => {
		if (Array.isArray(v)) {
			if (!v.length) return t("fit.ai.none");
			return v.map((id) => (c.field === "limitations" ? t(`fit.opt.limitation.${id}.label`) : t(`fit.opt.equipment.${id}`))).join(", ");
		}
		if (c.field === "location") return t(`fit.opt.location.${v}.label`);
		if (c.field === "goal") return t(`fit.opt.goal.${v}.label`);
		return String(v) || t("fit.ai.none");
	};

	return (
		<div className={styles.root}>
			<p className={styles.summary}>{rebuild.summary}</p>
			{changes.length > 0 && (
				<ul className={styles.changes}>
					{changes.map((c) => (
						<li key={c.field}>{t(`fit.ai.change.${c.field}`, { from: label(c, c.from), to: label(c, c.to) })}</li>
					))}
				</ul>
			)}
			<Button size="sm" disabled={applied || busy} loading={busy && !applied} onClick={onRecreate}>
				{applied ? t("fit.coach.applied") : t("fit.ai.recreate")}
			</Button>
		</div>
	);
}
