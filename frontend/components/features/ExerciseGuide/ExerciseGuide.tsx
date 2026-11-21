"use client";

import { Alert02Icon, ArrowDown01Icon, Idea01Icon, LeftToRightListNumberIcon, WindIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useState } from "react";
import { Icon, SegmentedControl, Sheet, type IconDefinition } from "@/components/ui";
import type { Exercise } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ExerciseGuide.module.scss";

type SectionId = "steps" | "tips" | "breathing" | "mistakes";
const ICONS: Record<SectionId, IconDefinition> = { steps: LeftToRightListNumberIcon, tips: Idea01Icon, breathing: WindIcon, mistakes: Alert02Icon };
const IDS: SectionId[] = ["steps", "tips", "breathing", "mistakes"];

interface Props {
	exercise: Exercise;
	/** `inline`: expandable sections on the page. `sheet`: four icon buttons that open a bottom sheet (keeps the workout screen focused). */
	variant?: "inline" | "sheet";
	defaultOpen?: SectionId | null;
}

export function ExerciseGuide({ exercise, variant = "inline", defaultOpen = "steps" }: Props) {
	const t = useT();
	const bodies: Record<SectionId, string[]> = { steps: exercise.steps, tips: exercise.tips, breathing: [exercise.breathing], mistakes: exercise.mistakes };
	const [open, setOpen] = useState<SectionId | null>(null);
	const [section, setSection] = useState<SectionId>("steps");

	if (variant === "sheet") {
		return (
			<>
				<div className={styles.chips} role="group" aria-label={t("fit.guide.title")}>
					{IDS.map((id) => (
						<button
							key={id}
							type="button"
							className={styles.chip}
							onClick={() => {
								setSection(id);
								setOpen(id);
							}}
						>
							<span className={styles.chipIcon}>
								<Icon icon={ICONS[id]} size={20} />
							</span>
							{t(`fit.guide.short.${id}`)}
						</button>
					))}
				</div>
				<Sheet open={open !== null} onClose={() => setOpen(null)} title={exercise.name} closeLabel={t("common.close")}>
					<SegmentedControl label={t("fit.guide.title")} value={section} onChange={setSection} options={IDS.map((id) => ({ id, label: t(`fit.guide.short.${id}`) }))} />
					<GuideList id={section} lines={bodies[section]} />
				</Sheet>
			</>
		);
	}

	return (
		<div className={styles.root}>
			{IDS.map((id) => (
				<details key={id} className={styles.item} open={defaultOpen === id}>
					<summary className={styles.summary}>
						<span className={styles.summaryIcon}>
							<Icon icon={ICONS[id]} size={18} />
						</span>
						{t(`fit.guide.${id}`)}
						<Icon icon={ArrowDown01Icon} size={18} className={styles.chevron} />
					</summary>
					<GuideList id={id} lines={bodies[id]} />
				</details>
			))}
		</div>
	);
}

function GuideList({ id, lines }: { id: SectionId; lines: string[] }) {
	const Tag = id === "steps" ? "ol" : "ul";
	return (
		<Tag className={clsx(styles.list, id === "steps" ? styles.ordered : styles.bullets)}>
			{lines.map((line) => (
				<li key={line}>{line}</li>
			))}
		</Tag>
	);
}
