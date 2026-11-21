"use client";

import { PlayCircleIcon, YoutubeIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icon } from "@/components/ui";
import { videoFor } from "@/lib/fit/videos";
import type { Exercise } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ExerciseVideo.module.scss";

// Official YouTube embed from the Leap Fitness channel when a video is mapped; a channel-search link otherwise.
// The player loads only after a tap, so a workout screen never pays for an iframe the user did not ask for.
export function ExerciseVideo({ exercise, compact = false }: { exercise: Exercise; compact?: boolean }) {
	const t = useT();
	const video = videoFor(exercise.id, exercise.name);
	const [playing, setPlaying] = useState(false);

	if (!video.embedUrl) {
		return (
			<div className={styles.frame} data-compact={compact || undefined}>
				<div className={styles.fallback}>
					<Icon icon={YoutubeIcon} size={28} />
					<p>{t("fit.video.none")}</p>
					<a href={video.searchUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
						{t("fit.video.search")}
					</a>
				</div>
			</div>
		);
	}

	return (
		<figure className={styles.figure}>
			<div className={styles.frame} data-compact={compact || undefined}>
				{playing ? (
					<iframe
						className={styles.iframe}
						src={`${video.embedUrl}&autoplay=1`}
						title={t("fit.video.title", { name: exercise.name })}
						allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						referrerPolicy="strict-origin-when-cross-origin"
					/>
				) : (
					<button type="button" className={styles.poster} onClick={() => setPlaying(true)} aria-label={t("fit.video.play", { name: exercise.name })}>
						<Icon icon={PlayCircleIcon} size={56} strokeWidth={1.25} />
						<span>{t("fit.video.playLabel")}</span>
					</button>
				)}
			</div>
			<figcaption className={styles.caption}>
				{t("fit.video.credit")}{" "}
				<a href={video.watchUrl ?? video.searchUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
					{t("fit.video.openYoutube")}
				</a>
			</figcaption>
		</figure>
	);
}
