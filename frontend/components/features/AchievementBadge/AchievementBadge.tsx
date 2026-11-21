import clsx from "clsx";
import { Picture } from "@/components/ui";
import type { BadgeIcon } from "@/lib/fit/gamification";
import styles from "./AchievementBadge.module.scss";

const SPECIAL_TROPHIES: Readonly<Partial<Record<string, string>>> = {
	"ten-sessions": "champion",
	"streak-5": "phoenix",
	"listen-to-body": "recovery",
	"iron-month": "barbell",
};

export function AchievementBadge({ icon, awardId, locked = false, size = "md" }: { icon: BadgeIcon; awardId?: string; locked?: boolean; size?: "md" | "lg" | "xl" }) {
	return (
		<Picture
			name={`award-${(awardId && SPECIAL_TROPHIES[awardId]) || icon}`}
			alt=""
			width={400}
			height={400}
			sizes={size === "xl" ? "176px" : size === "lg" ? "96px" : "56px"}
			className={clsx(styles.badge, styles[size], locked && styles.locked)}
		/>
	);
}
