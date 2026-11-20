import { InboxIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { Icon, type IconDefinition } from "../Icon/Icon";
import styles from "./EmptyState.module.scss";

interface EmptyStateProps {
	title: string;
	description?: string;
	icon?: IconDefinition;
	action?: ReactNode;
}

export function EmptyState({ title, description, icon = InboxIcon, action }: EmptyStateProps) {
	return (
		<div className={styles.empty}>
			<span className={styles.iconWrap}>
				<Icon icon={icon} size={24} />
			</span>
			<h3 className={styles.title}>{title}</h3>
			{description && <p className={styles.description}>{description}</p>}
			{action}
		</div>
	);
}
