"use client";

import { Calendar03Icon, Clock01Icon, Dumbbell01Icon, FireIcon, Idea01Icon, Medal01Icon, Share08Icon, StarIcon, Target02Icon, CrownIcon } from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import { AchievementBadge } from "@/components/features/AchievementBadge/AchievementBadge";
import { Button, EmptyState, Icon, ProgressBar, ProgressRing, Sheet, SportIcon, KIND_ICON, Textarea, useToast } from "@/components/ui";
import { awardInfo, tierOf, type Tier } from "@/lib/fit/awardsInfo";
import { formatDay } from "@/lib/fit/dates";
import { getExercise } from "@/lib/fit/exercises";
import { ACHIEVEMENTS } from "@/lib/fit/gamification";
import { shareText } from "@/lib/fit/share";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useFitStats, useUnits } from "@/lib/fit/store/hooks";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import styles from "./Awards.module.scss";

const LEVEL_RANKS = 8;
const DEMO_PERCENTILE = 0.892;

export function Awards() {
	const { t, locale } = useI18n();
	const u = useUnits();
	const toast = useToast();
	const { state } = useFit();
	const stats = useFitStats();
	const [openId, setOpenId] = useState<string | null>(null);
	const [shareOpen, setShareOpen] = useState(false);
	const [copyStatus, setCopyStatus] = useState<"copied" | "manual" | null>(null);
	const sharePreview = useRef<HTMLTextAreaElement>(null);
	const unlockedCount = ACHIEVEMENTS.filter((a) => state.unlocked[a.id]).length;
	const rank = Math.min(Math.max(stats.level.level, 1), LEVEL_RANKS);
	const minutes = Math.round(state.history.reduce((n, l) => n + l.durationSec, 0) / 60);
	const volume = state.history.reduce((n, l) => n + l.volumeKg, 0);
	const current = ACHIEVEMENTS.find((a) => a.id === openId);
	const shareSummary = t("fit.progress.shareAwards", { level: stats.level.level, xp: stats.xp, badges: unlockedCount });

	async function copySummary() {
		try {
			await navigator.clipboard.writeText(shareSummary);
			setCopyStatus("copied");
		} catch {
			sharePreview.current?.focus();
			sharePreview.current?.select();
			setCopyStatus("manual");
		}
	}

	const share = async (text: string) => {
		const r = await shareText(t("fit.progress.shareTitle"), text);
		toast.show(r === "copied" ? t("fit.common.copied") : r === "failed" ? t("fit.common.shareFailed") : t("fit.progress.shared"), r === "failed" ? "danger" : "success");
	};

	return (
		<>
			<section className={styles.hero} aria-label={t("fit.awards.level")}>
				<span className={styles.heroGlow} aria-hidden />
				<div className={styles.heroTop}>
					<ProgressRing value={stats.level.pct} label={t("fit.awards.level")} size={112} stroke={9}>
						<span className={styles.ringNum}>{stats.level.level}</span>
						<span className={styles.ringLabel}>{t("fit.awards.level")}</span>
					</ProgressRing>
					<div className={styles.heroText}>
						<p className={styles.rankName}>{t(`fit.awards.rank.${rank}`)}</p>
						<strong className={styles.xp}>{stats.xp.toLocaleString("en-US")} XP</strong>
						<span>{t("fit.progress.toNext", { n: stats.level.span - stats.level.into })}</span>
					</div>
				</div>
				<div className={styles.ranking}>
					<span className={styles.rankIcon}>
						<Icon icon={CrownIcon} size={22} />
					</span>
					<div className={styles.rankBody}>
						<strong>{t("fit.awards.aheadOf", { percent: new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: 1 }).format(DEMO_PERCENTILE) })}</strong>
						<span className={styles.rankTrack} aria-hidden>
							<span className={styles.rankFill} style={{ width: `${DEMO_PERCENTILE * 100}%` }} />
						</span>
					</div>
				</div>
				<ul className={styles.overall} aria-label={t("fit.awards.overall")}>
					<li>
						<Icon icon={Calendar03Icon} size={16} />
						<strong>{state.history.length}</strong>
						<span>{t("fit.awards.workouts")}</span>
					</li>
					<li>
						<Icon icon={Clock01Icon} size={16} />
						<strong>{minutes}</strong>
						<span>{t("fit.awards.minutes")}</span>
					</li>
					<li>
						{volume > 0 ? <Icon icon={Dumbbell01Icon} size={16} /> : <Icon icon={Medal01Icon} size={16} />}
						<strong>{volume > 0 ? u.mass(volume).toLocaleString("en-US") : unlockedCount}</strong>
						<span>{volume > 0 ? u.unit : t("fit.awards.badges")}</span>
					</li>
					<li>
						<Icon icon={FireIcon} size={16} />
						<strong>{stats.streak.longest}</strong>
						<span>{t("fit.awards.bestStreak")}</span>
					</li>
				</ul>
			</section>

			<section className={styles.challenge}>
				<span className={styles.challengeIcon}>
					<Icon icon={Target02Icon} size={22} />
				</span>
				<div className={styles.challengeBody}>
					<p className={styles.eyebrow}>{t("fit.today.challenge")}</p>
					<h3>{stats.challenge.title}</h3>
					<p>{stats.challenge.description}</p>
					<ProgressBar value={(stats.challenge.progress / stats.challenge.target) * 100} label={stats.challenge.title} tone={stats.challenge.complete ? "success" : "accent"} />
					<span className={styles.count}>
						{Math.round(stats.challenge.progress).toLocaleString("en-US")} / {stats.challenge.target.toLocaleString("en-US")} {stats.challenge.unit}
					</span>
				</div>
			</section>

			<div className={styles.sectionHead}>
				<h2>{t("fit.awards.collection")}</h2>
				<span>{t("fit.awards.collected", { n: unlockedCount, total: ACHIEVEMENTS.length })}</span>
			</div>
			<ProgressBar value={(unlockedCount / ACHIEVEMENTS.length) * 100} label={t("fit.awards.collection")} tone="accent" />

			<ul className={styles.grid}>
				{ACHIEVEMENTS.map((a) => {
					const when = state.unlocked[a.id];
					const info = awardInfo(a.id);
					const tier = tierOf(info.rarityPct);
					return (
						<li key={a.id}>
							<button type="button" className={styles.card} data-locked={!when || undefined} data-tier={tier} onClick={() => setOpenId(a.id)}>
								<AchievementBadge icon={a.icon} awardId={a.id} locked={!when} size="lg" />
								<strong>{a.title}</strong>
								<TierChip tier={tier} label={t(`fit.awards.tier.${tier}`)} />
								<span className={styles.cardHint}>{when ? t("fit.progress.unlockedOn", { day: formatDay(when) }) : a.description}</span>
							</button>
						</li>
					);
				})}
			</ul>

			<div className={styles.sectionHead}>
				<h2>{t("fit.progress.records")}</h2>
			</div>
			{stats.records.length === 0 ? (
				<EmptyState title={t("fit.progress.recordsEmpty")} description={t("fit.progress.recordsEmptyBody")} />
			) : (
				<ul className={styles.records}>
					{stats.records.slice(0, 8).map((r) => (
						<li key={r.exerciseId} className={styles.record}>
							<span className={styles.recordIcon}>
								<SportIcon name={KIND_ICON[getExercise(r.exerciseId).kind]} size={20} />
							</span>
							<span className={styles.recordText}>
								<strong>{getExercise(r.exerciseId).name}</strong>
								<span>{formatDay(r.date)}</span>
							</span>
							<span className={styles.recordValue}>
								<Icon icon={Medal01Icon} size={16} />
								{r.unit === "kg" ? u.fmtLoad(r.best) : `${r.best} ${r.unit}`}
							</span>
						</li>
					))}
				</ul>
			)}

			<Button variant="secondary" iconLeft={Share08Icon} onClick={() => { setCopyStatus(null); setShareOpen(true); }}>
				{t("fit.progress.shareAchievements")}
			</Button>
			<Sheet
				open={shareOpen}
				onClose={() => setShareOpen(false)}
				title={t("fit.progress.shareAchievements")}
				closeLabel={t("fit.awards.close")}
				footer={<Button onClick={copySummary}>{t("fit.awards.copySummary")}</Button>}
			>
				<div className={styles.sharePreview}>
					<AchievementBadge icon="medal" size="lg" />
					<Textarea ref={sharePreview} readOnly rows={2} label={t("fit.awards.sharePreview")} value={shareSummary} />
					{copyStatus && <p role="status">{t(copyStatus === "copied" ? "fit.common.copied" : "fit.awards.copyManually")}</p>}
				</div>
			</Sheet>

			<Sheet
				open={!!current}
				onClose={() => setOpenId(null)}
				title={current?.title ?? ""}
				closeLabel={t("fit.awards.close")}
				variant="full"
				footer={
					current && (
						<>
							<Button variant="secondary" onClick={() => setOpenId(null)}>{t("fit.awards.close")}</Button>
							{state.unlocked[current.id] && (
								<Button iconLeft={Share08Icon} onClick={() => share(t("fit.awards.shareText", { title: current.title }))}>{t("fit.awards.share")}</Button>
							)}
						</>
					)
				}
			>
				{current && <AwardDetail id={current.id} />}
			</Sheet>
		</>
	);
}

function TierChip({ tier, label }: { tier: Tier; label: string }) {
	return (
		<span className={styles.tierChip} data-tier={tier}>
			<Icon icon={StarIcon} size={12} />
			{label}
		</span>
	);
}

// Full-screen view of one achievement: big medallion, how rare it is, and a motivating note.
function AwardDetail({ id }: { id: string }) {
	const t = useT();
	const { state } = useFit();
	const a = ACHIEVEMENTS.find((x) => x.id === id);
	if (!a) return null;
	const info = awardInfo(id);
	const tier = tierOf(info.rarityPct);
	const when = state.unlocked[id];
	return (
		<div className={styles.detail} data-tier={tier}>
			<div className={styles.stage}>
				<span className={styles.stageGlow} aria-hidden />
				{Array.from({ length: 10 }, (_, i) => (
					<span key={i} className={styles.spark} aria-hidden />
				))}
				<AchievementBadge icon={a.icon} awardId={a.id} locked={!when} size="xl" />
			</div>
			<span className={styles.tierPill} data-tier={tier}>{t(`fit.awards.tier.${tier}`)}</span>
			<h2 className={styles.detailTitle}>{a.title}</h2>
			<p className={styles.rarity}>
				<Icon icon={StarIcon} size={18} />
				{t("fit.awards.demoRarity", { pct: info.rarityPct })}
			</p>
			<p className={styles.detailDesc}>{a.description}</p>
			<ul className={styles.facts}>
				<li>
					<span>{when ? t("fit.awards.status") : t("fit.awards.howTo")}</span>
					<strong>{when ? t("fit.progress.unlockedOn", { day: formatDay(when) }) : t("fit.awards.locked")}</strong>
				</li>
				<li>
					<span>{t("fit.awards.reward")}</span>
					<strong>+{a.xp} XP</strong>
				</li>
			</ul>
			<div className={styles.tip}>
				<span className={styles.tipIcon}>
					<Icon icon={Idea01Icon} size={20} />
				</span>
				<div>
					<strong>{t("fit.awards.tipTitle")}</strong>
					<p>{info.tip}</p>
				</div>
			</div>
		</div>
	);
}
