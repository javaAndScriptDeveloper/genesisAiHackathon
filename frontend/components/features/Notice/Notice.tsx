import clsx from "clsx";
import { Alert01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import styles from "./Notice.module.scss";

// Inline banner for demo disclaimers, warnings and tips. One look everywhere.
export function Notice({ tone = "warning", children }: { tone?: "warning" | "info"; children: ReactNode }) {
	return (
		<div className={clsx(styles.notice, styles[tone])} role="note">
			<Icon icon={tone === "warning" ? Alert01Icon : InformationCircleIcon} size={18} />
			<p>{children}</p>
		</div>
	);
}
