"use client";

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
	/** Content laid over the top of the video (title, metrics). Switches to the taller hero frame and drops the caption links. */
	overlay?: ReactNode;
}

export function ExerciseVideo(props: ExerciseVideoProps) {
	return <ExercisePlayer key={props.exercise.id} {...props} />;
}

function ExercisePlayer({ exercise, compact = false, autoPlay = false, overlay }: ExerciseVideoProps) {
	const t = useT();
	const video = videoFor(exercise);
	const [playing, setPlaying] = useState(false);
	const player = useRef<HTMLIFrameElement>(null);
	const [paused, setPaused] = useState(false);
	const hero = !!overlay;
	// Hero mode hides YouTube's own chrome (title, controls) and drives the player through its postMessage API: only play/pause is exposed.
	const command = (func: string) => player.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: "" }), "*");
	const toggle = () => {
		command(paused ? "playVideo" : "pauseVideo");
		setPaused(!paused);
	};
	// Looping through the `playlist` param would bring back prev/next buttons, so restart on "ended" (state 0) ourselves.
	useEffect(() => {
		if (!hero) return;
		const onMessage = (event: MessageEvent) => {
			if (event.source !== player.current?.contentWindow || typeof event.data !== "string") return;
			try {
				const data: unknown = JSON.parse(event.data);
				if (typeof data === "object" && data !== null && "event" in data && "info" in data && data.event === "onStateChange" && data.info === 0) command("playVideo");
			} catch {
				// Not a player message.
			}
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	});
	const heroParams = hero ? `&controls=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1` : "";
	const title = video.relatedTitle ?? t("fit.video.title", { name: exercise.name });

	return (
		<figure className={styles.figure}>
			{!overlay && video.relatedTitle && <figcaption className={styles.related}>{t("fit.video.related", { name: video.relatedTitle })}</figcaption>}
			<div className={styles.frame} data-compact={compact || undefined} data-hero={overlay ? true : undefined}>
				{autoPlay || playing ? (
					<iframe
						ref={player}
						onLoad={() => player.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*")}
						className={styles.iframe}
						src={`${video.embedUrl}&autoplay=1${autoPlay ? "&mute=1" : ""}${heroParams}`}
						title={title}
						allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
						allowFullScreen
						referrerPolicy="strict-origin-when-cross-origin"
					/>
				) : (
					<button type="button" className={styles.poster} onClick={() => setPlaying(true)} aria-label={t("fit.video.play", { name: title })}>
						<Picture name={`training-${exercise.muscle}`} alt="" width={384} height={384} sizes="(max-width: 576px) 100vw, 420px" className={styles.cover} />
						<Icon icon={PlayCircleIcon} size={48} strokeWidth={1.5} />
						<span>{t("fit.video.playLabel")}</span>
					</button>
				)}
				{hero && <div className={styles.overlay}>{overlay}</div>}
				{hero && (autoPlay || playing) && (
					<button type="button" className={styles.toggle} aria-label={t(paused ? "fit.video.resume" : "fit.video.pause")} onClick={toggle}>
						<Icon icon={paused ? PlayIcon : PauseIcon} size={22} />
					</button>
				)}
			</div>
			{!overlay && <div className={styles.caption}>
				<a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
					{t("fit.video.openYoutube")}
				</a>
				{video.relatedTitle && (
					<a href={video.searchUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
						{t("fit.video.searchExact")}
					</a>
				)}
			</div>}
		</figure>
	);
}
