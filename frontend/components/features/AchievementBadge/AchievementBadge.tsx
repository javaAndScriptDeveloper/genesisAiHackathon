import clsx from "clsx";
import { Calendar03Icon, DropletIcon, FireIcon, FlashIcon, HeartCheckIcon, Medal01Icon, Shield01Icon, Target01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconDefinition } from "@/components/ui";
import type { BadgeIcon } from "@/lib/fit/gamification";
import styles from "./AchievementBadge.module.scss";

const ICONS: Record<BadgeIcon, IconDefinition> = { flame: FireIcon, medal: Medal01Icon, target: Target01Icon, heart: HeartCheckIcon, drop: DropletIcon, bolt: FlashIcon, calendar: Calendar03Icon, shield: Shield01Icon };

export function AchievementBadge({ icon, locked = false, size = "md" }: { icon: BadgeIcon; locked?: boolean; size?: "md" | "lg" }) {
	return (
		<span className={clsx(styles.badge, styles[size], locked && styles.locked)}>
			<Icon icon={ICONS[icon]} size={size === "lg" ? 40 : 24} />
		</span>
	);
}
