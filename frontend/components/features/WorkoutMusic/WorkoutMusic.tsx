"use client";

import { ArrowLeft02Icon, ArrowRight02Icon, PauseIcon, PlayIcon, VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { Button, IconButton, Sheet } from "@/components/ui";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./WorkoutMusic.module.scss";

const TRACKS = ["steady", "drive", "cooldown"] as const;

export function WorkoutMusic({ open, onClose }: { open: boolean; onClose: () => void }) {
	const t = useT();
	const audio = useRef<HTMLAudioElement>(null);
	const [index, setIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [volume, setVolume] = useState(70);
	const [error, setError] = useState(false);

	function play(player: HTMLAudioElement) {
		setError(false);
		player.volume = volume / 100;
		void player.play().catch((reason: unknown) => {
			if (reason instanceof DOMException && reason.name === "AbortError") return;
			setError(true);
		});
	}

	function selectTrack(next: number) {
		const player = audio.current;
		if (!player) return;
		if (index !== next) player.src = `/audio/${TRACKS[next]}.mp3`;
		setIndex(next);
		play(player);
	}

	function stop() {
		const player = audio.current;
		if (!player) return;
		player.pause();
		player.currentTime = 0;
		setError(false);
	}

	return (
		<>
			<audio ref={audio} src="/audio/steady.mp3" preload="none" loop muted={muted}
				onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setError(true); }} />
			<Sheet open={open} onClose={onClose} title={t("fit.music.title")} closeLabel={t("fit.music.close")}>
				<div className={styles.player}>
					<div className={styles.nowPlaying}>
						<strong>{t(`fit.music.tracks.${TRACKS[index]}`)}</strong>
						<span>{t(playing ? "fit.music.playing" : "fit.music.paused")}</span>
					</div>
					<div className={styles.controls}>
						<IconButton icon={ArrowLeft02Icon} label={t("fit.music.previous")} onClick={() => selectTrack((index + TRACKS.length - 1) % TRACKS.length)} />
						<IconButton icon={playing ? PauseIcon : PlayIcon} label={t(playing ? "fit.music.pause" : "fit.music.play")} variant="secondary" onClick={() => {
							const player = audio.current;
							if (!player) return;
							if (player.paused) play(player);
							else player.pause();
						}} />
						<IconButton icon={ArrowRight02Icon} label={t("fit.music.next")} onClick={() => selectTrack((index + 1) % TRACKS.length)} />
						<IconButton icon={muted ? VolumeOffIcon : VolumeHighIcon} label={t(muted ? "fit.music.unmute" : "fit.music.mute")} onClick={() => setMuted(!muted)} />
					</div>
					<label className={styles.volume}>
						{t("fit.music.volume")}
						<input type="range" min={0} max={100} value={volume} onChange={(event) => {
							const next = event.currentTarget.valueAsNumber;
							if (audio.current) audio.current.volume = next / 100;
							setVolume(next);
						}} />
					</label>
					<div className={styles.tracks} role="group" aria-label={t("fit.music.choose")}>
						{TRACKS.map((track, i) => (
							<Button key={track} variant={i === index ? "secondary" : "ghost"} aria-pressed={i === index} onClick={() => selectTrack(i)}>
								{t(`fit.music.tracks.${track}`)}
							</Button>
						))}
					</div>
					{error && <p role="alert">{t("fit.music.error")}</p>}
					<Button variant="ghost" onClick={stop}>{t("fit.music.off")}</Button>
				</div>
			</Sheet>
		</>
	);
}
