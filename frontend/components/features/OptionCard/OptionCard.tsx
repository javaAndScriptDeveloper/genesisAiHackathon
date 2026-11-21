import clsx from "clsx";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui";
import styles from "./OptionCard.module.scss";

interface OptionCardProps {
	type: "radio" | "checkbox";
	name: string;
	label: string;
	hint?: string;
	checked: boolean;
	onChange: () => void;
	compact?: boolean;
}

// Large selectable card backed by a real radio/checkbox, so it works with keyboard and screen readers.
export function OptionCard({ type, name, label, hint, checked, onChange, compact }: OptionCardProps) {
	return (
		<label className={clsx(styles.card, checked && styles.checked, compact && styles.compact)}>
			<input className={styles.input} type={type} name={name} checked={checked} onChange={onChange} />
			<span className={styles.text}>
				<span className={styles.label}>{label}</span>
				{hint && <span className={styles.hint}>{hint}</span>}
			</span>
			<span className={styles.mark} aria-hidden>
				{checked && <Icon icon={Tick02Icon} size={16} strokeWidth={3} />}
			</span>
		</label>
	);
}
