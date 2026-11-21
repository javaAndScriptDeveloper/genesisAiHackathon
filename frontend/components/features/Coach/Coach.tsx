"use client";

import { Mic02Icon, MicOff01Icon, SentIcon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Button, Icon, IconButton, useToast } from "@/components/ui";
import { applyAdapt, replaceUnavailable } from "@/lib/fit/adapt";
import { coachReply, isSafetyConcern, SUGGESTED_PROMPTS, type CoachContext } from "@/lib/fit/coach";
import { listenOnce, speechSupported } from "@/lib/fit/speech";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useFitStats } from "@/lib/fit/store/hooks";
import type { CoachAction, CoachMessage } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./Coach.module.scss";

const uid = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function Coach() {
	const t = useT();
	const router = useRouter();
	const toast = useToast();
	const { state, dispatch, today } = useFit();
	const stats = useFitStats();
	const [text, setText] = useState("");
	const [pending, setPending] = useState(false);
	const [listening, setListening] = useState(false);
	const stop = useRef<(() => void) | null>(null);
	const end = useRef<HTMLDivElement>(null);
	const timer = useRef<number | null>(null);
	const profile = state.profile;
	const active = state.active && state.active.phase !== "summary" ? state.active : null;

	useEffect(() => {
		end.current?.scrollIntoView({ block: "end" });
	}, [state.coach.length, pending]);
	useEffect(
		() => () => {
			stop.current?.();
			if (timer.current) window.clearTimeout(timer.current);
		},
		[],
	);
	if (!profile) return null;

	const context = (): CoachContext => ({
		profile,
		next: stats.next,
		todayDone: state.planned.some((w) => w.date === today && (w.status === "completed" || w.status === "partial")),
		inSession: !!active,
		streak: stats.streak.current,
		weekDone: stats.week.done,
		weekPlanned: stats.week.planned,
		consistency: stats.consistency,
		xp: stats.xp,
		sessions: state.history.length,
		lastPr: [...state.history].reverse().find((l) => l.prs.length)?.prs[0] ?? null,
		premium: state.subscription.tier === "premium",
	});

	const send = (raw: string) => {
		const value = raw.trim();
		if (!value || pending) return;
		setText("");
		dispatch({ type: "coach-message", message: { id: uid(), from: "user", text: value, at: new Date().toISOString() } });
		setPending(true);
		timer.current = window.setTimeout(() => {
			const reply = coachReply(value, context());
			if (isSafetyConcern(value) && active) dispatch({ type: "safety-stop" });
			dispatch({ type: "coach-message", message: { id: uid(), from: "coach", text: reply.text, at: new Date().toISOString(), actions: reply.actions, safety: reply.safety } });
			setPending(false);
		}, 650);
	};

	const confirmation = (action: CoachAction): string => {
		switch (action.type) {
			case "adapt": {
				const blocks = active ? active.exercises : stats.next?.exercises ?? [];
				const res = applyAdapt(blocks, action.op, { profile, startIndex: active ? active.index : 0 });
				return res.message;
			}
			case "recovery-day":
				return t("fit.coach.doneRecovery");
			case "remove-equipment": {
				const p = { ...profile, equipment: profile.equipment.filter((e) => e !== action.equipment) };
				const n = (stats.next ? replaceUnavailable(stats.next.exercises, p).replaced : []).length;
				return t("fit.coach.doneEquipment", { n });
			}
			case "avoid-limitation":
				return t("fit.coach.doneLimitation");
			case "rebuild-plan":
				return t("fit.coach.doneRebuild");
			case "go":
				return "";
		}
	};

	const apply = (message: CoachMessage, action: CoachAction) => {
		if (action.type === "go") {
			router.push(action.href);
			return;
		}
		if (action.type === "rebuild-plan" && state.subscription.tier !== "premium") {
			router.push("/subscription?from=coach");
			return;
		}
		const reply: CoachMessage = { id: uid(), from: "coach", text: confirmation(action), at: new Date().toISOString() };
		dispatch({ type: "coach-apply", messageId: message.id, action, today, now: new Date().toISOString(), reply });
		toast.show(t("fit.coach.applied"), "success");
	};

	const voice = () => {
		if (listening) {
			stop.current?.();
			return;
		}
		const stopFn = listenOnce({ onText: (v) => setText(v), onEnd: () => setListening(false), onError: () => { setListening(false); toast.show(t("fit.coach.voiceError"), "danger"); } });
		if (!stopFn) return;
		stop.current = stopFn;
		setListening(true);
	};

	return (
		<div className={styles.root}>
			<ScreenHeader title={t("fit.coach.title")} />
			<div className={styles.thread} role="log" aria-live="polite" aria-label={t("fit.coach.title")}>
				<div className={clsx(styles.bubble, styles.coach)}>
					<p>{t("fit.coach.greeting", { name: profile.name })}</p>
				</div>
				{state.coach.map((m) => (
					<div key={m.id} className={clsx(styles.bubble, m.from === "user" ? styles.user : styles.coach, m.safety && styles.safety)}>
						<p>{m.text}</p>
						{m.actions && m.actions.length > 0 && (
							<div className={styles.actions}>
								{m.actions.map((a) => {
									const used = m.appliedAction === a.id;
									const locked = a.type === "rebuild-plan" && state.subscription.tier !== "premium";
									return (
										<Button key={a.id} size="sm" variant={a.type === "go" ? "secondary" : "primary"} disabled={used} onClick={() => apply(m, a)}>
											{used ? t("fit.coach.applied") : locked ? `${a.label} · ${t("fit.common.premium")}` : a.label}
										</Button>
									);
								})}
							</div>
						)}
						{m.safety && active && <Link href="/workout" className={styles.link}>{t("fit.coach.backToWorkout")}</Link>}
					</div>
				))}
				{pending && (
					<div className={clsx(styles.bubble, styles.coach)} aria-label={t("fit.coach.typing")}>
						<span className={styles.dots}><i /><i /><i /></span>
					</div>
				)}
				<div ref={end} />
			</div>

			<div className={styles.composer}>
				<div className={styles.prompts} role="group" aria-label={t("fit.coach.suggestions")}>
					{SUGGESTED_PROMPTS.map((p) => (
						<button key={p} type="button" className={styles.prompt} disabled={pending} onClick={() => send(p)}>{p}</button>
					))}
				</div>
				<form className={styles.form} onSubmit={(e) => { e.preventDefault(); send(text); }}>
					<input className={styles.input} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("fit.coach.placeholder")} aria-label={t("fit.coach.placeholder")} maxLength={300} />
					<IconButton icon={listening ? MicOff01Icon : Mic02Icon} label={speechSupported() ? (listening ? t("fit.workout.voiceStop") : t("fit.coach.voice")) : t("fit.coach.voiceUnsupported")} disabled={!speechSupported()} onClick={voice} />
					<button type="submit" className={styles.send} disabled={!text.trim() || pending} aria-label={t("fit.coach.send")}>
						<Icon icon={SentIcon} size={20} />
					</button>
				</form>
			</div>
		</div>
	);
}
