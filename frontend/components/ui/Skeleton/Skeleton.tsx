import clsx from "clsx";
import type { CSSProperties } from "react";
import styles from "./Skeleton.module.scss";

interface SkeletonProps {
	width?: string;
	height?: string;
	className?: string;
}

// Shape it like the real content. Pages load via `loading.tsx` + a `<Thing>Skeleton`, never a blank panel.
export function Skeleton({ width = "100%", height = "1.6rem", className }: SkeletonProps) {
	const style: CSSProperties = { width, height };
	return <span className={clsx(styles.skeleton, className)} style={style} aria-hidden />;
}
