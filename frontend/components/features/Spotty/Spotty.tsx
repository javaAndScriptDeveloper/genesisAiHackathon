import clsx from "clsx";
import { useId, type ReactNode } from "react";
import styles from "./Spotty.module.scss";

/** idle = bouncing and curling, wave = greeting, think = waiting on AI, cheer = celebrating. */
export type SpottyMood = "idle" | "wave" | "think" | "cheer";

interface SpottyProps {
	mood?: SpottyMood;
	size?: "sm" | "lg";
	/** Speech bubble content. Announced politely so screen readers hear Spotty's reactions. */
	children?: ReactNode;
	className?: string;
}

/** One dumbbell, drawn around the hand at (0,0) with the bar along x. */
function Dumbbell({ x, y, angle }: { x: number; y: number; angle: number }) {
	return (
		<g transform={`translate(${x} ${y}) rotate(${angle})`}>
			<rect className={styles.bar} x="-11" y="-1.6" width="22" height="3.2" rx="1.6" />
			<rect className={styles.plate} x="-15" y="-7.5" width="6" height="15" rx="2" />
			<rect className={styles.plate} x="9" y="-7.5" width="6" height="15" rx="2" />
			<rect className={styles.plateCap} x="-18" y="-4.5" width="3.5" height="9" rx="1.5" />
			<rect className={styles.plateCap} x="14.5" y="-4.5" width="3.5" height="9" rx="1.5" />
		</g>
	);
}

// Spotty (a gym "spotter"), the app mascot: a bouncy volt bubble in a sweatband with two dumbbells.
// Inline SVG so it themes with tokens; moods are pure CSS animations.
export function Spotty({ mood = "idle", size = "sm", children, className }: SpottyProps) {
	const clipId = `spotty-${useId().replace(/:/g, "")}`;

	return (
		<div className={clsx(styles.root, styles[size], styles[mood], className)}>
			<svg className={styles.figure} viewBox="0 0 120 140" aria-hidden focusable="false">
				<defs>
					<clipPath id={clipId}>
						<ellipse cx="60" cy="86" rx="38" ry="40" />
					</clipPath>
				</defs>
				<ellipse className={styles.shadow} cx="60" cy="134" rx="30" ry="4" />
				<g className={styles.body}>
					<ellipse className={styles.skin} cx="45" cy="126" rx="9" ry="5" />
					<ellipse className={styles.skin} cx="75" cy="126" rx="9" ry="5" />

					<g className={styles.armLeft}>
						<polyline className={styles.limb} points="27,96 18,112" />
						<polyline className={styles.limbFill} points="27,96 18,112" />
						<Dumbbell x={17} y={113} angle={30} />
						<circle className={styles.skin} cx="17.5" cy="112.5" r="4.5" />
					</g>
					<g className={styles.armRight}>
						<polyline className={styles.limb} points="93,96 102,112" />
						<polyline className={styles.limbFill} points="93,96 102,112" />
						<Dumbbell x={103} y={113} angle={-30} />
						<circle className={styles.skin} cx="102.5" cy="112.5" r="4.5" />
					</g>

					<ellipse className={styles.skin} cx="60" cy="86" rx="38" ry="40" />
					<g clipPath={`url(#${clipId})`}>
						<ellipse className={styles.belly} cx="60" cy="104" rx="24" ry="20" />
						<rect className={styles.band} x="10" y="55" width="100" height="9" />
					</g>
					<path className={styles.band} d="M31 57 l-13 -7 l2 10 z M31 62 l-11 5 l5 7 z" />
					<ellipse className={styles.shine} cx="34" cy="80" rx="3.2" ry="7" transform="rotate(18 34 80)" />

					<g className={styles.eyes}>
						<ellipse className={styles.eye} cx="49" cy="82" rx="4" ry="5.5" />
						<ellipse className={styles.eye} cx="71" cy="82" rx="4" ry="5.5" />
						<circle className={styles.glint} cx="50.4" cy="80" r="1.5" />
						<circle className={styles.glint} cx="72.4" cy="80" r="1.5" />
					</g>
					<path className={styles.happyEyes} d="M44 84 q5 -7 10 0 M66 84 q5 -7 10 0" />
					<ellipse className={styles.cheek} cx="39" cy="92" rx="5" ry="3" />
					<ellipse className={styles.cheek} cx="81" cy="92" rx="5" ry="3" />
					<path className={styles.mouth} d="M53 95 q7 6 14 0" />
					<path className={styles.mouthOpen} d="M52 94 h16 q-1 10 -8 10 q-7 0 -8 -10 z" />

					<g className={styles.dots}>
						<circle cx="96" cy="34" r="2.8" />
						<circle cx="104" cy="25" r="2.8" />
						<circle cx="112" cy="16" r="2.8" />
					</g>
				</g>
			</svg>
			{children && (
				<p className={styles.bubble} aria-live="polite">
					{children}
				</p>
			)}
		</div>
	);
}
