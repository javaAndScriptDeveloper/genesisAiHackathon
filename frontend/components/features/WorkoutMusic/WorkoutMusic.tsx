"use client";

import { MusicNote01Icon, NextIcon, PauseIcon, PlayIcon, PowerIcon, PreviousIcon, RepeatIcon, VolumeHighIcon, VolumeOffIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { useRef, useState } from "react";
import { Button, Icon, IconButton, SegmentedControl, Sheet } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./WorkoutMusic.module.scss";

const TRACKS = ["steady", "drive", "cooldown"] as const;
type Track = (typeof TRACKS)[number];
const BARS = [0.5, 0.8, 0.4, 1, 0.65, 0.9, 0.45];

export function WorkoutMusic({ open, onClose }: { open: boolean; onClose: () => void }) {
	const t = useT();
	const audio = useRef<HTMLAudioElement>(null);
	const [index, setIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [repeat, setRepeat] = useState(true);
	const [volume, setVolume] = useState(70);
	const [time, setTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState(false);
	const track: Track = TRACKS[index] ?? "steady";
	const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

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
		if (index !== next) {
			player.src = `/audio/${TRACKS[next]}.mp3`;
			setTime(0);
			setDuration(0);
		}
		setIndex(next);
		play(player);
	}

	function stop() {
		const player = audio.current;
		if (!player) return;
		player.pause();
		player.currentTime = 0;
		setTime(0);
		setError(false);
	}

	return (
		<>
			<audio
				ref={audio}
				src="/audio/steady.mp3"
				preload="none"
				loop={repeat}
				muted={muted}
				onPlay={() => setPlaying(true)}
				onPause={() => setPlaying(false)}
				onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
				onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
				onEnded={() => selectTrack((index + 1) % TRACKS.length)}
				onError={() => {
					setPlaying(false);
					setError(true);
				}}
			/>
			<Sheet open={open} onClose={onClose} title={t("fit.music.title")} closeLabel={t("fit.music.close")}>
				<div className={styles.player} data-track={track} data-playing={playing || undefined}>
					<div className={styles.stage}>
						<svg className={styles.wave} viewBox="0 0 400 80" preserveAspectRatio="none" aria-hidden>
							<path d="M0 40 C 33 0, 67 0, 100 40 S 167 80, 200 40 S 267 0, 300 40 S 367 80, 400 40" />
						</svg>
						<span className={clsx(styles.dot, styles.dotA)} aria-hidden />
						<span className={clsx(styles.dot, styles.dotB)} aria-hidden />
						<div className={styles.cover} aria-hidden>
							<div className={styles.bars}>
								{BARS.map((height, i) => (
									<span key={i} style={{ "--h": height, "--d": `${i * 0.12}s` } as React.CSSProperties} />
								))}
							</div>
						</div>
					</div>

					<div className={styles.nowPlaying}>
						<strong>{t(`fit.music.tracks.${track}`)}</strong>
						<span>
							<Icon icon={repeat ? RepeatIcon : MusicNote01Icon} size={16} />
							{t(playing ? (repeat ? "fit.music.playing" : "fit.music.playingNext") : "fit.music.paused")}
						</span>
					</div>

					<div className={styles.seek}>
						<span>{formatClock(Math.floor(time))}</span>
						<input
							type="range"
							min={0}
							max={duration || 1}
							step={0.1}
							value={Math.min(time, duration || 1)}
							aria-label={t("fit.music.seek")}
							style={{ "--p": `${progress}%` } as React.CSSProperties}
							onChange={(event) => {
								const next = event.currentTarget.valueAsNumber;
								if (audio.current) audio.current.currentTime = next;
								setTime(next);
							}}
						/>
						<span>{formatClock(Math.floor(duration))}</span>
					</div>

					<div className={styles.controls}>
						<IconButton className={clsx(styles.side, repeat && styles.sideOn)} icon={RepeatIcon} label={t("fit.music.repeat")} aria-pressed={repeat} variant="secondary" onClick={() => setRepeat(!repeat)} />
						<IconButton className={styles.side} icon={PreviousIcon} label={t("fit.music.previous")} variant="secondary" onClick={() => selectTrack((index + TRACKS.length - 1) % TRACKS.length)} />
						<button
							type="button"
							className={styles.playBtn}
							aria-label={t(playing ? "fit.music.pause" : "fit.music.play")}
							onClick={() => {
								const player = audio.current;
								if (!player) return;
								if (player.paused) play(player);
								else player.pause();
							}}
						>
							<Icon icon={playing ? PauseIcon : PlayIcon} size={30} />
						</button>
						<IconButton className={styles.side} icon={NextIcon} label={t("fit.music.next")} variant="secondary" onClick={() => selectTrack((index + 1) % TRACKS.length)} />
						<IconButton className={styles.side} icon={muted ? VolumeOffIcon : VolumeHighIcon} label={t(muted ? "fit.music.unmute" : "fit.music.mute")} variant="secondary" onClick={() => setMuted(!muted)} />
					</div>

					<label className={styles.volume}>
						<span className={styles.srOnly}>{t("fit.music.volume")}</span>
						<input
							type="range"
							min={0}
							max={100}
							value={volume}
							style={{ "--p": `${volume}%` } as React.CSSProperties}
							onChange={(event) => {
								const next = event.currentTarget.valueAsNumber;
								if (audio.current) audio.current.volume = next / 100;
								setVolume(next);
							}}
						/>
					</label>

					<SegmentedControl label={t("fit.music.choose")} value={track} onChange={(id) => selectTrack(TRACKS.indexOf(id))} options={TRACKS.map((id) => ({ id, label: t(`fit.music.tracks.${id}`) }))} />
					{error && <p role="alert" className={styles.error}>{t("fit.music.error")}</p>}
					<Button variant="secondary" iconLeft={PowerIcon} onClick={stop}>{t("fit.music.off")}</Button>
				</div>
			</Sheet>
		</>
	);
}
