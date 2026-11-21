"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Button, Card, Input, Select, Sheet, Switch, useToast } from "@/components/ui";
import { NOTIFICATION_LABELS } from "@/lib/fit/notifications";
import { useFit } from "@/lib/fit/store/FitProvider";
import type { NotificationKind } from "@/lib/fit/types";
import { LOCALES, LOCALE_LABELS, isLocale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

type Confirm = null | "demo" | "reset";

export function Settings() {
	const { t, locale, setLocale } = useI18n();
	const router = useRouter();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const [confirm, setConfirm] = useState<Confirm>(null);
	const s = state.notificationSettings;
	const kinds = Object.keys(NOTIFICATION_LABELS) as NotificationKind[];

	const setPush = async (on: boolean) => {
		if (on) {
			if (typeof Notification === "undefined") return toast.show(t("fit.settings.pushUnsupported"), "danger");
			const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
			if (permission !== "granted") return toast.show(t("fit.settings.pushDenied"), "danger");
		}
		dispatch({ type: "notification-settings", settings: { ...s, browserPush: on } });
		toast.show(on ? t("fit.settings.pushOn") : t("fit.settings.pushOff"), "success");
	};

	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.settings.title")} back />
			<div className={kit.content}>
				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.settings.language")}</h2>
					<Select label={t("fit.settings.language")} value={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] }))} onChange={(v) => isLocale(v) && setLocale(v)} />
					<p className={kit.note}>{t("fit.settings.languageNote")}</p>
				</Card>

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.settings.reminders")}</h2>
					<p className={kit.note}>{t("fit.settings.remindersNote")}</p>
					{kinds.map((k) => (
						<div key={k}>
							<Switch label={NOTIFICATION_LABELS[k].label} checked={s.enabled[k]} onChange={(e) => dispatch({ type: "notification-settings", settings: { ...s, enabled: { ...s.enabled, [k]: e.target.checked } } })} />
							<p className={kit.note}>{NOTIFICATION_LABELS[k].hint}</p>
						</div>
					))}
					<Input label={t("fit.settings.reminderTime")} type="time" value={s.reminderTime} onChange={(e) => e.target.value && dispatch({ type: "notification-settings", settings: { ...s, reminderTime: e.target.value } })} />
					<Switch label={t("fit.settings.push")} checked={s.browserPush} onChange={(e) => setPush(e.target.checked)} />
					<p className={kit.note}>{t("fit.settings.pushNote")}</p>
				</Card>

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.settings.data")}</h2>
					<p className={kit.note}>{t("fit.settings.dataNote")}</p>
					<Button variant="secondary" disabled={!state.hasDemoHistory} onClick={() => setConfirm("demo")}>{t("fit.settings.removeDemo")}</Button>
					<Button variant="danger" onClick={() => setConfirm("reset")}>{t("fit.settings.reset")}</Button>
				</Card>
			</div>

			<Sheet open={confirm === "demo"} onClose={() => setConfirm(null)} title={t("fit.settings.removeDemoTitle")} closeLabel={t("common.close")} variant="center" footer={
				<>
					<Button variant="secondary" onClick={() => setConfirm(null)}>{t("fit.common.cancel")}</Button>
					<Button variant="danger" onClick={() => { dispatch({ type: "clear-demo-history", today }); setConfirm(null); toast.show(t("fit.settings.demoRemoved"), "success"); }}>{t("fit.settings.removeDemoConfirm")}</Button>
				</>
			}><p>{t("fit.settings.removeDemoBody")}</p></Sheet>

			<Sheet open={confirm === "reset"} onClose={() => setConfirm(null)} title={t("fit.settings.resetTitle")} closeLabel={t("common.close")} variant="center" footer={
				<>
					<Button variant="secondary" onClick={() => setConfirm(null)}>{t("fit.common.cancel")}</Button>
					<Button variant="danger" onClick={() => { dispatch({ type: "reset" }); setConfirm(null); router.replace("/onboarding"); }}>{t("fit.settings.resetConfirm")}</Button>
				</>
			}><p>{t("fit.settings.resetBody")}</p></Sheet>
		</div>
	);
}
