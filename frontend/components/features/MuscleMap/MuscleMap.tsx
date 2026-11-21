"use client";

import Model from "react-body-highlighter";
import clsx from "clsx";
import { SportIcon } from "@/components/ui";
import { BODY_MAP } from "@/lib/fit/muscles";
import type { Muscle } from "@/lib/fit/types";
import styles from "./MuscleMap.module.scss";

interface MuscleMapProps {
	muscles: Muscle[];
	/** `badge`: one round thumbnail. `pair`: front and back views side by side. */
	variant?: "badge" | "pair";
	size?: number;
	label: string;
	selected?: boolean;
}

const BODY = "#d5d8e0";
const LIT = ["#e5242e"];

// Anatomical diagram (react-body-highlighter, MIT) with the trained regions in the accent colour.
export function MuscleMap({ muscles, variant = "badge", size = 72, label, selected }: MuscleMapProps) {
	const parts = muscles.flatMap((m) => BODY_MAP[m]?.parts ?? []);
	const data = [{ name: label, muscles: parts }];

	if (variant === "pair") {
		return (
			<div className={styles.pair} role="img" aria-label={label}>
				<Model type="anterior" data={data} bodyColor={BODY} highlightedColors={LIT} style={{ width: "100%", maxWidth: "11rem" }} />
				<Model type="posterior" data={data} bodyColor={BODY} highlightedColors={LIT} style={{ width: "100%", maxWidth: "11rem" }} />
			</div>
		);
	}

	const first = muscles[0] ? BODY_MAP[muscles[0]] : null;
	return (
		<span className={clsx(styles.badge, selected && styles.selected)} style={{ width: size, height: size }} role="img" aria-label={label}>
			{first || muscles.length > 1 ? (
				<Model type={first?.view ?? "anterior"} data={data} bodyColor={BODY} highlightedColors={LIT} style={{ width: "62%", height: "88%" }} svgStyle={{ width: "100%", height: "100%" }} />
			) : (
				<SportIcon name={muscles[0] === "cardio" ? "run" : "yoga"} size={size * 0.46} />
			)}
		</span>
	);
}
