"use client";

import { Alert02Icon, ChartUpIcon, Chat01Icon, Dumbbell03Icon, FireIcon, Medal01Icon, Share08Icon, Moon01Icon, Notification01Icon, Settings02Icon, Target01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Avatar, Badge, Button, EmptyState, Icon, IconButton, type IconDefinition } from "@/components/ui";
import { useTrainers } from "@/lib/api/trainers";
import { activeTrainerId } from "@/lib/fit/options";
import { track } from "@/lib/fit/analytics";
import type { NotificationKind } from "@/lib/fit/types";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useActionNavigate } from "@/lib/fit/store/hooks";
import { useShare } from "@/lib/hooks/useShare";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";
import styles from "./Notifications.module.scss";

const KIND_ICONS: Record<NotificationKind, IconDefinition> = { workout: Dumbbell03Icon, missed: Alert02Icon, achievement: Medal01Icon, "weekly-goal": Target01Icon, recovery: Moon01Icon, coach: Chat01Icon, "weekly-summary": ChartUpIcon, streak: FireIcon };

function ago(iso: string, t: (k: string, p?: Record<string, number>) => string): string {
	const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
	if (mins < 1) return t("fit.notifications.now");
	if (mins < 60) return t("fit.notifications.minAgo", { n: mins });
	if (mins < 1440) return t("fit.notifications.hourAgo", { n: Math.round(mins / 60) });
	return t("fit.notifications.dayAgo", { n: Math.round(mins / 1440) });
}

export function Notifications() {
	const t = useT();
	const router = useRouter();
	const { state, dispatch } = useFit();
	const go = useActionNavigate();
	const shareWith = useShare();
	const unread = state.notifications.filter((n) => !n.read).length;
	const { data: trainers } = useTrainers();
	const trainer = trainers?.find((tr) => tr.id === activeTrainerId(state));
	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.notifications.title")} back actions={<IconButton icon={Settings02Icon} label={t("fit.notifications.settings")} onClick={() => router.push("/settings")} />} />
			<div className={kit.content}>
				{state.notifications.length === 0 ? (
					<EmptyState icon={Notification01Icon} title={t("fit.notifications.empty")} description={t("fit.notifications.emptyBody")} />
				) : (
					<>
						<ul className={kit.list}>
							{state.notifications.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										className={`${kit.row} ${n.read ? "" : kit.unread}`}
										onClick={() => {
											track("notification_opened", { id: n.id, kind: n.kind });
											if (n.href) go(n.href, { type: "notification-read", id: n.id });
											else dispatch({ type: "notification-read", id: n.id });
										}}
									>
										<span className={kit.plate}>
											{n.nudge && trainer ? <Avatar name={trainer.name} src={trainer.pathToImage} size={32} /> : <Icon icon={KIND_ICONS[n.kind]} size={20} />}
										</span>
										<span className={kit.rowText}>
											<strong>{n.title}</strong>
											<span>{n.aiText ?? n.body}</span>
											<span>{ago(n.createdAt, t)}</span>
										</span>
										{!n.read && <Badge tone="accent">{t("fit.notifications.new")}</Badge>}
									</button>
									{n.nudge && (n.kind === "achievement" || n.kind === "streak") && (
										<IconButton icon={Share08Icon} label={t("fit.nudges.share")} onClick={() => void shareWith(n.title, n.aiText ?? n.body, { headline: t(n.kind === "streak" ? "fit.nudges.streakHeadline" : "fit.nudges.achievementHeadline"), value: n.nudge?.facts.streak !== undefined ? String(n.nudge.facts.streak) : n.nudge?.facts.title ?? "", line: "Personal Coach" })} />
									)}
								</li>
							))}
						</ul>
						<div className={styles.stickyBar}>
							<Button variant="secondary" iconLeft={TickDouble02Icon} disabled={unread === 0} onClick={() => dispatch({ type: "notifications-read-all" })}>{t("fit.notifications.markAll")}</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
