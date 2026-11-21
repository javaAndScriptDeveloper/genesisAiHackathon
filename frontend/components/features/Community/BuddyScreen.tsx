"use client";

import { Camera01Icon, SentIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PremiumGate } from "@/components/features/PremiumGate/PremiumGate";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Button, Card, EmptyState, IconButton, Input, Tabs, useToast } from "@/components/ui";
import { BUDDIES, buddyReply, type Buddy } from "@/lib/fit/community";
import { formatDay } from "@/lib/fit/dates";
import { resizeToDataUrl } from "@/lib/fit/image";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useUnits } from "@/lib/fit/store/hooks";
import type { ChatMessage } from "@/lib/fit/types";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";
import styles from "./Community.module.scss";

const REPLY_DELAY_MS = 1200;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function Results({ buddy }: { buddy: Buddy }) {
	const t = useT();
	const toast = useToast();
	const u = useUnits();
	const { state, dispatch, today } = useFit();
	const next = state.planned.filter((w) => w.status === "planned" && w.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
	const joint = next?.partnerId === buddy.id;
	const r = buddy.results;
	const when = r.lastWorkout.daysAgo === 0 ? t("fit.community.when.today") : r.lastWorkout.daysAgo === 1 ? t("fit.community.when.yesterday") : t("fit.community.when.daysAgo", { n: r.lastWorkout.daysAgo });
	return (
		<div className={kit.stack}>
			<div className={styles.resultsGrid}>
				<div className={styles.stat}><strong>{t("fit.community.workoutsWeek", { n: r.weeklyWorkouts })}</strong><span>{t("fit.community.thisWeek")}</span></div>
				<div className={styles.stat}><strong>{t("fit.community.streak", { n: r.streakWeeks })}</strong><span>{t("fit.community.level", { n: buddy.level })}</span></div>
				<div className={styles.stat}><strong>{r.lastWorkout.title}</strong><span>{t("fit.community.lastWorkoutTitle")} · {when}</span></div>
				<div className={styles.stat}><strong>{t("fit.community.prLine", { exercise: r.pr.exercise, weight: u.fmtMass(r.pr.kg) })}</strong><span>{t("fit.community.bestLift")}</span></div>
			</div>
			{next && (
				<PremiumGate title={t("fit.partners.lockedTitle")} body={t("fit.partners.lockedBody")} source="community">
					<Card className={kit.stack}>
						<Button size="sm" variant={joint ? "secondary" : "primary"} onClick={() => { dispatch({ type: "joint-workout", workoutId: next.id, partnerId: joint ? null : buddy.id }); toast.show(joint ? t("fit.partners.unscheduled") : t("fit.partners.scheduled", { name: buddy.name, day: formatDay(next.date) }), "success"); }}>
							{joint ? t("fit.partners.cancelJoint") : t("fit.partners.schedule", { title: next.title, day: formatDay(next.date) })}
						</Button>
						{joint && <p className={kit.note}>{t("fit.partners.jointNote", { name: buddy.name })}</p>}
					</Card>
				</PremiumGate>
			)}
		</div>
	);
}

function Chat({ buddy }: { buddy: Buddy }) {
	const t = useT();
	const toast = useToast();
	const { state, dispatch } = useFit();
	const messages = state.chats[buddy.id] ?? [];
	const [draft, setDraft] = useState("");
	const [typing, setTyping] = useState(false);
	const file = useRef<HTMLInputElement>(null);
	const end = useRef<HTMLDivElement>(null);
	const timers = useRef<number[]>([]);
	useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
	useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages.length, typing]);

	const send = (text: string, photo?: string) => {
		const message: ChatMessage = { id: newId(), from: "me", text, photo, at: new Date().toISOString() };
		dispatch({ type: "chat-send", buddyId: buddy.id, message });
		setTyping(true);
		const reply = buddyReply(buddy, { text, hasPhoto: Boolean(photo) }, messages.length);
		timers.current.push(window.setTimeout(() => {
			dispatch({ type: "chat-send", buddyId: buddy.id, message: { id: newId(), from: "buddy", text: reply, at: new Date().toISOString() } });
			setTyping(false);
		}, REPLY_DELAY_MS));
	};

	const submit = () => {
		const text = draft.trim();
		if (!text) return;
		send(text);
		setDraft("");
	};

	const pickPhoto = async (picked: File | undefined) => {
		if (!picked) return;
		try {
			send("", await resizeToDataUrl(picked));
		} catch {
			toast.show(t("fit.community.photoFailed"), "danger");
		}
	};

	return (
		<div className={styles.chat}>
			<div className={styles.messages} aria-live="polite">
				{messages.length === 0 && <p className={kit.note}>{t("fit.community.chatEmpty", { name: buddy.name })}</p>}
				{messages.map((m) => (
					<div key={m.id} className={`${styles.bubble} ${m.from === "me" ? styles.mine : styles.theirs}`}>
						{m.photo && <Image className={styles.photo} src={m.photo} alt={t("fit.community.sharedPhoto")} width={240} height={240} unoptimized />}
						{m.text ? <span>{m.text}</span> : !m.photo && <span>{t("fit.community.photoRemoved")}</span>}
						<time className={styles.time} dateTime={m.at}>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
					</div>
				))}
				{typing && <p className={kit.note}>{t("fit.community.typing", { name: buddy.name })}</p>}
				<div ref={end} />
			</div>
			<form className={styles.composer} onSubmit={(e) => { e.preventDefault(); submit(); }}>
				<Input aria-label={t("fit.community.messagePlaceholder")} placeholder={t("fit.community.messagePlaceholder")} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} />
				<IconButton variant="secondary" icon={Camera01Icon} label={t("fit.community.sharePhoto")} onClick={() => file.current?.click()} />
				<IconButton variant="secondary" icon={SentIcon} label={t("fit.community.send")} type="submit" disabled={draft.trim() === ""} />
				<input ref={file} className={styles.hidden} type="file" accept="image/*" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
			</form>
		</div>
	);
}

export function BuddyScreen({ id }: { id: string }) {
	const t = useT();
	const router = useRouter();
	const toast = useToast();
	const { state, dispatch } = useFit();
	const buddy = BUDDIES.find((b) => b.id === id);
	if (!buddy || state.partners[buddy.id] !== "accepted") {
		return (
			<div className={kit.page}>
				<ScreenHeader title={t("fit.community.title")} back="/community" />
				<div className={kit.content}>
					<EmptyState icon={UserGroupIcon} title={t("fit.community.notConnectedTitle")} description={t("fit.community.notConnectedBody")} action={<Link href="/community"><Button size="sm">{t("fit.community.backToList")}</Button></Link>} />
				</div>
			</div>
		);
	}
	return (
		<div className={kit.page}>
			<ScreenHeader title={buddy.name} back="/community" actions={<Button size="sm" variant="ghost" onClick={() => { dispatch({ type: "partner", id: buddy.id, status: null }); toast.show(t("fit.community.removed", { name: buddy.name }), "info"); router.push("/community", { transitionTypes: ["nav-back"] }); }}>{t("fit.community.removeBuddy")}</Button>} />
			<div className={kit.content}>
				<Tabs tabs={[{ id: "results", label: t("fit.community.resultsTab"), content: <Results buddy={buddy} /> }, { id: "chat", label: t("fit.community.chatTab"), content: <Chat buddy={buddy} /> }]} />
			</div>
		</div>
	);
}
