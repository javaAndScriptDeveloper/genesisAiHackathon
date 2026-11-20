import clsx from "clsx";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Pagination.module.scss";

interface PaginationProps {
	page: number;
	pageCount: number;
	onChange: (page: number) => void;
}

// Compact window: 1 … p-1 p p+1 … N
function pageList(page: number, count: number): (number | "gap")[] {
	const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
	const sorted = [...set].sort((a, b) => a - b);
	const out: (number | "gap")[] = [];
	sorted.forEach((p, i) => {
		const prev = sorted[i - 1];
		if (prev !== undefined && p - prev > 1) out.push("gap");
		out.push(p);
	});
	return out;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
	if (pageCount <= 1) return null;
	return (
		<nav className={styles.nav} aria-label="Пагінація">
			<IconButton icon={ArrowLeft01Icon} label="Попередня сторінка" disabled={page <= 1} onClick={() => onChange(page - 1)} />
			{pageList(page, pageCount).map((item, i) =>
				item === "gap" ? (
					<span key={`gap-${i}`} className={styles.gap} aria-hidden>
						…
					</span>
				) : (
					<button key={item} type="button" aria-current={item === page ? "page" : undefined} className={clsx(styles.page, item === page && styles.current)} onClick={() => onChange(item)}>
						{item}
					</button>
				),
			)}
			<IconButton icon={ArrowRight01Icon} label="Наступна сторінка" disabled={page >= pageCount} onClick={() => onChange(page + 1)} />
		</nav>
	);
}
