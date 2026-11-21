import { IconBarbell, IconDumbbell, IconFlame, IconGymnastics, IconHeartbeat, IconRun, IconStopwatch, IconStretching2, IconTrophy, IconYoga } from "@tabler/icons-react";
import type { ExerciseKind } from "@/lib/fit/types";

// Sport pictograms (Tabler Icons, MIT). Hugeicons has no sport set, so training types and effort metrics use these;
// every other icon in the app stays Hugeicons via <Icon>.
const ICONS = {
	barbell: IconBarbell,
	dumbbell: IconDumbbell,
	run: IconRun,
	yoga: IconYoga,
	stretch: IconStretching2,
	gymnastics: IconGymnastics,
	flame: IconFlame,
	stopwatch: IconStopwatch,
	heartbeat: IconHeartbeat,
	trophy: IconTrophy,
} as const;

export type SportIconName = keyof typeof ICONS;

/** Default pictogram for an exercise kind. */
export const KIND_ICON: Record<ExerciseKind, SportIconName> = { strength: "barbell", bodyweight: "gymnastics", cardio: "run", mobility: "yoga" };

interface SportIconProps {
	name: SportIconName;
	size?: number;
	stroke?: number;
	className?: string;
	label?: string;
}

export function SportIcon({ name, size = 20, stroke = 1.75, className, label }: SportIconProps) {
	const Glyph = ICONS[name];
	return <Glyph size={size} stroke={stroke} className={className} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} />;
}
