"use client";

import { Mic01Icon, StopIcon, Target02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Button, Card, Icon, IconButton, Textarea, useToast } from "@/components/ui";
import { useVoiceRecorder } from "@/lib/hooks/useVoiceRecorder";
import { matchGoal } from "@/lib/fit/goalClient";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

export function GoalCard() {
	const t = useT();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const profile = state.profile;
	const [text, setText] = useState(profile?.goalText ?? "");
	const [saving, setSaving] = useState(false);
	const [transcribing, setTranscribing] = useState(false);
	const recorder = useVoiceRecorder();
	if (!profile) return null;

	const toggleMic = async () => {
		if (recorder.status !== "recording") {
			await recorder.start();
			return;
		}
		const audio = await recorder.stop();
		if (!audio || audio.size === 0) return;
		setTranscribing(true);
		try {
			const form = new FormData();
			form.append("audio", audio, "goal.webm");
			const response = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(25_000) });
			const data: unknown = await response.json().catch(() => null);
			if (!response.ok || typeof data !== "object" || data === null || !("text" in data) || typeof data.text !== "string" || data.text === "") throw new Error("stt");
			const heard = data.text;
			setText((prev) => (prev.trim() ? `${prev.trim()} ${heard}` : heard).slice(0, 500));
		} catch {
			toast.show(t("fit.profile.micFailed"), "danger");
		} finally {
			setTranscribing(false);
		}
	};

	const micMessage = recorder.status === "unsupported" ? t("fit.profile.micUnsupported") : recorder.status === "denied" ? t("fit.profile.micDenied") : null;

	const save = async () => {
		const wording = text.trim();
		if (!wording) return;
		setSaving(true);
		const match = await matchGoal(wording);
		dispatch({ type: "set-goal", goal: match.status === "matched" ? match.goal : profile.goal, goalText: wording, today });
		setSaving(false);
		if (match.status === "matched") toast.show(t("fit.profile.goalSaved"), "success");
		else toast.show(t(match.status === "none" ? "fit.profile.goalKept" : "fit.profile.goalUnavailable"), "danger");
	};

	return (
		<Card className={kit.stack}>
			<h2 className={`${kit.h2} ${kit.heading}`}><Icon icon={Target02Icon} size={20} />{t("fit.profile.goalTitle")}</h2>
			<Textarea label={t("fit.profile.goalLabel")} hint={t("fit.profile.goalHint")} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
			<div className={kit.stack}>
				<IconButton variant="secondary" icon={recorder.status === "recording" ? StopIcon : Mic01Icon} label={recorder.status === "recording" ? t("fit.profile.micStop") : t("fit.profile.micStart")} aria-pressed={recorder.status === "recording"} disabled={transcribing} onClick={toggleMic} />
				{transcribing && <p className={kit.note}>{t("fit.profile.micTranscribing")}</p>}
				{micMessage && <p className={kit.note} role="alert">{micMessage}</p>}
			</div>
			<Button loading={saving} disabled={text.trim() === ""} onClick={save}>{t("fit.profile.goalSave")}</Button>
		</Card>
	);
}
