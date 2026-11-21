"use client";

import clsx from "clsx";
import { PauseIcon, PlayCircleIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Picture } from "@/components/ui";
import { videoFor } from "@/lib/fit/videos";
import type { Exercise } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ExerciseVideo.module.scss";

interface ExerciseVideoProps {
	exercise: Exercise;
	compact?: boolean;
	autoPlay?: boolean;
	fullWidth?: boolean;
	className?: string;
	/** Workout title and metrics rendered above the video. */
	header?: ReactNode;
}

export function ExerciseVideo(props: ExerciseVideoProps) {
	return <ExercisePlayer key={props.exercise.id} {...props} />;
}

function ExercisePlayer({ exercise, compact = false, autoPlay = false, fullWidth = false, className, header }: ExerciseVideoProps) {
	const t = useT();
	const video = videoFor(exercise);
	const [playing, setPlaying] = useState(false);
	const player = useRef<HTMLIFrameElement>(null);
	const [paused, setPaused] = useState(false);
	const hero = !!header;
	const playerOrigin = new URL(video.embedUrl).origin;
	// Workout playback has a separate app control outside the player UI.
	const command = (func: string) => player.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), playerOrigin);
	const toggle = () => {
		command(paused ? "playVideo" : "pauseVideo");
		setPaused(!paused);
	};
	// Every mode hides the YouTube UI and uses the same minimal controls: our own play / pause button, and a loop.
	const playerParams = "&enablejsapi=1&disablekb=1&modestbranding=1&playsinline=1";
	// Restart the workout demo without creating a playlist and its previous/next buttons.
	useEffect(() => {
		const iframe = player.current;
		const onMessage = (event: MessageEvent) => {
			if (event.origin !== playerOrigin || event.source !== iframe?.contentWindow || typeof event.data !== "string") return;
			try {
				const message: unknown = JSON.parse(event.data);
				// The widget reports state through `infoDelivery` messages carrying `info.playerState` (0 = ended).
				const info: unknown = typeof message === "object" && message !== null && "info" in message ? message.info : null;
				if (typeof info === "object" && info !== null && "playerState" in info && info.playerState === 0) {
					// Reload the same clip: seekTo/playVideo on an ended player is unreliable and ends again at once.
					iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "loadVideoById", args: [video.id] }), playerOrigin);
				}
			} catch {
				// Ignore non-JSON player messages.
			}
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [playerOrigin, video.id, autoPlay, playing]);
	const title = video.relatedTitle ?? t("fit.video.title", { name: exercise.name });

	return (
		<figure className={clsx(styles.figure, className)} data-full-width={fullWidth || undefined}>
			<div className={styles.frame} data-hero={hero || undefined}>
				{hero && <div className={styles.header}>{header}</div>}
				<div className={styles.media} data-compact={compact || undefined}>
					{autoPlay || playing ? (
						<iframe
							ref={player}
							onLoad={() => player.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), playerOrigin)}
							className={styles.iframe}
							src={`${video.embedUrl}&autoplay=1&controls=0&fs=0&iv_load_policy=3${autoPlay ? "&mute=1" : ""}${playerParams}`}
							title={title}
							allow="autoplay; encrypted-media"
							referrerPolicy="strict-origin-when-cross-origin"
						/>
					) : (
						<button type="button" className={styles.poster} onClick={() => setPlaying(true)} aria-label={t("fit.video.play", { name: title })}>
							<Picture name={`training-${exercise.muscle}`} alt="" width={384} height={384} sizes="(max-width: 576px) 100vw, 420px" className={styles.cover} />
							<Icon icon={PlayCircleIcon} size={48} strokeWidth={1.5} />
							<span>{t("fit.video.playLabel")}</span>
						</button>
					)}
					{(autoPlay || playing) && (
						<button type="button" className={styles.toggle} aria-label={t(paused ? "fit.video.resume" : "fit.video.pause")} onClick={toggle}>
							<Icon icon={paused ? PlayIcon : PauseIcon} size={22} />
						</button>
					)}
				</div>
			</div>
			{!hero && video.relatedTitle && <figcaption className={styles.related}>{t("fit.video.related", { name: video.relatedTitle })}</figcaption>}
		</figure>
	);
}
