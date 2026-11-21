"use client";

import { PlayCircleIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Icon, Picture } from "@/components/ui";
import { videoFor } from "@/lib/fit/videos";
import type { Exercise } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./ExerciseVideo.module.scss";

interface ExerciseVideoProps {
	exercise: Exercise;
	compact?: boolean;
	autoPlay?: boolean;
}

export function ExerciseVideo(props: ExerciseVideoProps) {
	return <ExercisePlayer key={props.exercise.id} {...props} />;
}

function ExercisePlayer({ exercise, compact = false, autoPlay = false }: ExerciseVideoProps) {
	const t = useT();
	const video = videoFor(exercise);
	const [playing, setPlaying] = useState(false);
	const title = video.relatedTitle ?? t("fit.video.title", { name: exercise.name });

	return (
		<figure className={styles.figure}>
			{video.relatedTitle && <figcaption className={styles.related}>{t("fit.video.related", { name: video.relatedTitle })}</figcaption>}
			<div className={styles.frame} data-compact={compact || undefined}>
				{autoPlay || playing ? (
					<iframe
						className={styles.iframe}
						src={`${video.embedUrl}&autoplay=1${autoPlay ? "&mute=1" : ""}`}
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
			</div>
			<div className={styles.caption}>
				<a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
					{t("fit.video.openYoutube")}
				</a>
				{video.relatedTitle && (
					<a href={video.searchUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
						{t("fit.video.searchExact")}
					</a>
				)}
			</div>
		</figure>
	);
}
