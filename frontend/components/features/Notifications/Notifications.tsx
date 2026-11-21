"use client";

import { Notification01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Badge, Button, EmptyState, IconButton } from "@/components/ui";
import { track } from "@/lib/fit/analytics";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

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
	const unread = state.notifications.filter((n) => !n.read).length;
	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.notifications.title")} back actions={<IconButton icon={Settings02Icon} label={t("fit.notifications.settings")} onClick={() => router.push("/settings")} />} />
			<div className={kit.content}>
				{state.notifications.length === 0 ? (
					<EmptyState icon={Notification01Icon} title={t("fit.notifications.empty")} description={t("fit.notifications.emptyBody")} />
				) : (
					<>
						<Button variant="secondary" size="sm" disabled={unread === 0} onClick={() => dispatch({ type: "notifications-read-all" })}>{t("fit.notifications.markAll")}</Button>
						<ul className={kit.list}>
							{state.notifications.map((n) => (
								<li key={n.id}>
									<button
										type="button"
										className={`${kit.row} ${n.read ? "" : kit.unread}`}
										onClick={() => {
											dispatch({ type: "notification-read", id: n.id });
											track("notification_opened", { id: n.id, kind: n.kind });
											if (n.href) router.push(n.href);
										}}
									>
										<span className={kit.rowText}>
											<strong>{n.title}</strong>
											<span>{n.body}</span>
											<span>{ago(n.createdAt, t)}</span>
										</span>
										<Badge tone={n.read ? "neutral" : "accent"}>{t(`fit.notifications.kind.${n.kind}`)}</Badge>
									</button>
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</div>
	);
}
