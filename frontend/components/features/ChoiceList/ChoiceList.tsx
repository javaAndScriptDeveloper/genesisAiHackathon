import clsx from "clsx";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconDefinition } from "@/components/ui";
import styles from "./ChoiceList.module.scss";

export interface Choice {
	key: string;
	icon: IconDefinition;
	title: string;
	hint?: string;
	onClick: () => void;
	disabled?: boolean;
	tone?: "default" | "danger";
	current?: boolean;
}

// One look for every "pick an action" sheet: icon plate, title, hint, chevron. Keeps Adjust, Move, Skip and Replace consistent.
export function ChoiceList({ items, ordered = false }: { items: Choice[]; ordered?: boolean }) {
	const List = ordered ? "ol" : "ul";
	return (
		<List className={styles.list}>
			{items.map((item) => (
				<li key={item.key}>
					<button type="button" className={clsx(styles.choice, item.tone === "danger" && styles.danger)} disabled={item.disabled} aria-current={item.current ? "step" : undefined} onClick={item.onClick}>
						<span className={styles.plate}>
							<Icon icon={item.icon} size={20} />
						</span>
						<span className={styles.text}>
							<strong>{item.title}</strong>
							{item.hint && <span>{item.hint}</span>}
						</span>
						<Icon icon={ArrowRight01Icon} size={16} className={styles.chevron} />
					</button>
				</li>
			))}
		</List>
	);
}
