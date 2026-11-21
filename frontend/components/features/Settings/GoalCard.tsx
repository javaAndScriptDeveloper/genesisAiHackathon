"use client";

import { Mic01Icon, StopIcon, Target02Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Button, Card, Icon, IconButton, Textarea, useToast } from "@/components/ui";
import { useVoiceRecorder } from "@/lib/hooks/useVoiceRecorder";
import { GOALS } from "@/lib/fit/options";
import { useFit } from "@/lib/fit/store/FitProvider";
import type { Goal } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

async function matchPreset(text: string): Promise<Goal | null> {
	try {
		const response = await fetch("/api/goal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
		if (!response.ok) return null;
		const data: unknown = await response.json();
		return typeof data === "object" && data !== null && "goal" in data ? (GOALS.find((g) => g === data.goal) ?? null) : null;
	} catch {
		return null;
	}
}

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
			const response = await fetch("/api/stt", { method: "POST", body: form });
			const data: unknown = await response.json().catch(() => null);
			if (!response.ok || typeof data !== "object" || data === null || !("text" in data) || typeof data.text !== "string" || data.text === "") throw new Error("stt");
			const heard = data.text;
			setText((prev) => (prev.trim() ? `${prev.trim()} ${heard}` : heard).slice(0, 500));
		} catch {
			toast.show(t("fit.settings.micFailed"), "danger");
		} finally {
			setTranscribing(false);
		}
	};

	const micMessage = recorder.status === "unsupported" ? t("fit.settings.micUnsupported") : recorder.status === "denied" ? t("fit.settings.micDenied") : null;

	const save = async () => {
		const wording = text.trim();
		if (!wording) return;
		setSaving(true);
		const preset = await matchPreset(wording);
		dispatch({ type: "set-goal", goal: preset ?? profile.goal, goalText: wording, today });
		setSaving(false);
		toast.show(preset ? t("fit.settings.goalSaved") : t("fit.settings.goalKept"), preset ? "success" : "danger");
	};

	return (
		<Card className={kit.stack}>
			<h2 className={`${kit.h2} ${kit.heading}`}><Icon icon={Target02Icon} size={20} />{t("fit.settings.goalTitle")}</h2>
			<Textarea label={t("fit.settings.goalLabel")} hint={t("fit.settings.goalHint")} rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
			<div className={kit.stack}>
				<IconButton variant="secondary" icon={recorder.status === "recording" ? StopIcon : Mic01Icon} label={recorder.status === "recording" ? t("fit.settings.micStop") : t("fit.settings.micStart")} aria-pressed={recorder.status === "recording"} disabled={transcribing} onClick={toggleMic} />
				{transcribing && <p className={kit.note}>{t("fit.settings.micTranscribing")}</p>}
				{micMessage && <p className={kit.note} role="alert">{micMessage}</p>}
			</div>
			<Button loading={saving} disabled={text.trim() === ""} onClick={save}>{t("fit.settings.goalSave")}</Button>
		</Card>
	);
}
