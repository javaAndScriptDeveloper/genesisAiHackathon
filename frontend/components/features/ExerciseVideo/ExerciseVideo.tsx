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
	/** Freeze the clip while something else covers it (rest screen, pause), so it doesn't decode in the background. */
	hold?: boolean;
}

export function ExerciseVideo(props: ExerciseVideoProps) {
	return <ExercisePlayer key={props.exercise.id} {...props} />;
}

function ExercisePlayer({ exercise, compact = false, autoPlay = false, fullWidth = false, className, header, hold = false }: ExerciseVideoProps) {
	const t = useT();
	const video = videoFor(exercise);
	const [playing, setPlaying] = useState(false);
	const player = useRef<HTMLIFrameElement>(null);
	// Last player state reported by YouTube (-1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued).
	const [state, setState] = useState<number | null>(null);
	const [silent, setSilent] = useState(false);
	// True once the player has been playing long enough for YouTube to auto-hide its own overlay.
	const [revealed, setRevealed] = useState(false);
	const revealTimer = useRef(0);
	const paused = state === 2;
	const hero = !!header;
	const playerOrigin = new URL(video.embedUrl).origin;
	// Workout playback has a separate app control outside the player UI.
	const command = (func: string) => player.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), playerOrigin);
	const toggle = () => {
		command(paused ? "playVideo" : "pauseVideo");
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
				if (typeof info === "object" && info !== null && "playerState" in info && typeof info.playerState === "number") {
					setState(info.playerState);
					if (info.playerState === 1) {
						if (!revealTimer.current) revealTimer.current = window.setTimeout(() => setRevealed(true), 4500);
					} else if (info.playerState !== 3) {
						window.clearTimeout(revealTimer.current);
						revealTimer.current = 0;
						setRevealed(false);
					}
				}
				if (typeof info === "object" && info !== null && "playerState" in info && info.playerState === 0) {
					// Reload the same clip: seekTo/playVideo on an ended player is unreliable and ends again at once.
					iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "loadVideoById", args: [video.id] }), playerOrigin);
				}
			} catch {
				// Ignore non-JSON player messages.
			}
		};
		window.addEventListener("message", onMessage);
		return () => {
			window.removeEventListener("message", onMessage);
			window.clearTimeout(revealTimer.current);
			revealTimer.current = 0;
		};
	}, [playerOrigin, video.id, autoPlay, playing]);
	// If the player never reports a state (blocked API), stop shielding so the video is not hidden forever.
	useEffect(() => {
		if (!(autoPlay || playing)) return;
		const id = window.setTimeout(() => setSilent(true), 6000);
		return () => window.clearTimeout(id);
	}, [autoPlay, playing]);
	// YouTube draws its own title, "more videos" and share UI while loading, paused or ended. That UI can't be turned off,
	// so an opaque cover hides the player in exactly those states.
	// Right after playback starts or resumes it also flashes the title bar and share buttons for ~4 s, so the cover stays until then.
	const shielded = (autoPlay || playing) && (state === null ? !silent : !revealed);
	const title = video.relatedTitle ?? t("fit.video.title", { name: exercise.name });

	return (
		<figure className={clsx(styles.figure, className)} data-full-width={fullWidth || undefined}>
			<div className={styles.frame} data-hero={hero || undefined}>
				{hero && <div className={styles.header}>{header}</div>}
				<div className={styles.media} data-compact={compact || undefined}>
					{video.src ? (
						<LocalClip hold={hold} src={video.src} title={title} poster={`/img/training-${exercise.muscle}.webp`} />
					) : autoPlay || playing ? (
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
					{!video.src && (autoPlay || playing) && (
						<div className={styles.shield} data-hidden={!shielded || undefined} aria-hidden>
							<Picture name={`training-${exercise.muscle}`} alt="" width={384} height={384} sizes="(max-width: 576px) 100vw, 420px" className={styles.cover} />
						</div>
					)}
					{!video.src && (autoPlay || playing) && (
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

// Self-hosted clip: muted, looped, no third-party UI. The only control is play / pause.
function LocalClip({ src, title, poster, hold }: { src: string; title: string; poster: string; hold: boolean }) {
	const t = useT();
	const ref = useRef<HTMLVideoElement>(null);
	const [paused, setPaused] = useState(false);
	useEffect(() => {
		const video = ref.current;
		if (!video) return;
		if (hold) video.pause();
		else void video.play().catch(() => undefined);
	}, [hold]);
	return (
		<>
			<video ref={ref} className={styles.iframe} src={src} title={title} poster={poster} autoPlay muted loop playsInline preload="auto" onPlay={() => setPaused(false)} onPause={() => setPaused(true)} />
			<button
				type="button"
				className={styles.toggle}
				aria-label={t(paused ? "fit.video.resume" : "fit.video.pause")}
				onClick={() => {
					const video = ref.current;
					if (!video) return;
					if (video.paused) void video.play();
					else video.pause();
				}}
			>
				<Icon icon={paused ? PlayIcon : PauseIcon} size={22} />
			</button>
		</>
	);
}
