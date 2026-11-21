"use client";

import { Alert02Icon, ArrowDown01Icon, Idea01Icon, HelpCircleIcon, LeftToRightListNumberIcon, WindIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useState } from "react";
import { Icon, IconButton, SegmentedControl, Sheet, type IconDefinition } from "@/components/ui";
import type { Exercise } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ExerciseGuide.module.scss";

type SectionId = "steps" | "tips" | "breathing" | "mistakes";
const ICONS: Record<SectionId, IconDefinition> = { steps: LeftToRightListNumberIcon, tips: Idea01Icon, breathing: WindIcon, mistakes: Alert02Icon };
const IDS: SectionId[] = ["steps", "tips", "breathing", "mistakes"];

interface Props {
	exercise: Exercise;
	/** `inline`: expandable sections on the page. `sheet`: one info icon button that opens a bottom sheet with tabs (keeps the workout screen focused). */
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
				<IconButton
					icon={HelpCircleIcon}
					label={t("fit.guide.title")}
					className={styles.trigger}
					onClick={() => {
						setSection("steps");
						setOpen("steps");
					}}
				/>
				<Sheet compactHeader open={open !== null} onClose={() => setOpen(null)} title={exercise.name} closeLabel={t("common.close")}>
					<SegmentedControl label={t("fit.guide.title")} value={section} onChange={setSection} options={IDS.map((id) => ({ id, label: t(`fit.guide.short.${id}`) }))} />
					<div className={styles.sheetIntro} data-section={section}>
						<span className={styles.introIcon}>
							<Icon icon={ICONS[section]} size={22} />
						</span>
						<div>
							<strong>{t(`fit.guide.${section}`)}</strong>
							<p>{t(`fit.guide.lead.${section}`)}</p>
						</div>
					</div>
					<GuideCards id={section} lines={bodies[section]} />
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

// Sheet version: one card per line. Steps are numbered, tips and breathing get an icon, mistakes a warning tint.
function GuideCards({ id, lines }: { id: SectionId; lines: string[] }) {
	return (
		<ol className={styles.cards} data-section={id}>
			{lines.map((line, i) => (
				<li key={line} className={styles.card}>
					<span className={styles.cardMark} aria-hidden>
						{id === "steps" ? i + 1 : <Icon icon={ICONS[id]} size={16} />}
					</span>
					<span>{line}</span>
				</li>
			))}
		</ol>
	);
}
