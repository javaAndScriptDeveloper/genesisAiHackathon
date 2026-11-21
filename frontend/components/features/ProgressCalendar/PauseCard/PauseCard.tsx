"use client";

import { Calendar03Icon, PauseIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { ChoiceList } from "@/components/features/ChoiceList/ChoiceList";
import { Button, Card, Icon, Sheet, useToast } from "@/components/ui";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { addDays, weekStart } from "@/lib/progress/dates";
import type { IsoDate, Pause } from "@/lib/progress/types";
import { fmtShort } from "../format";
import styles from "./PauseCard.module.scss";

const WEEKS = [1, 2, 3, 4] as const;

/** Pause the streak for 1–4 weeks from this Monday; an active or upcoming pause can be removed after a confirm. */
export function PauseCard({ pauses, today }: { pauses: Pause[]; today: IsoDate }) {
	const { t, locale } = useI18n();
	const { dispatch } = useFit();
	const toast = useToast();
	const [picking, setPicking] = useState(false);
	const [weeks, setWeeks] = useState<number>(1);
	const [confirmRemove, setConfirmRemove] = useState(false);
	const k = "fit.progress.calendar.pause";

	const monday = weekStart(today);
	const endFor = (n: number) => addDays(monday, n * 7 - 1);
	const active = pauses.find((p) => p.to >= today);
	const blocked = (n: number) => pauses.some((p) => p.from <= endFor(n) && p.to >= monday);

	const add = () => {
		const to = endFor(weeks);
		dispatch({ type: "add-pause", from: monday, to });
		setPicking(false);
		toast.show(t(`${k}.added`, { date: fmtShort(to, locale) }), "success");
	};
	const remove = () => {
		if (active) dispatch({ type: "remove-pause", from: active.from });
		setConfirmRemove(false);
		toast.show(t(`${k}.removed`), "info");
	};

	return (
		<>
			<Card className={styles.root} data-active={active ? true : undefined}>
				<span className={styles.plate}>
					<Icon icon={PauseIcon} size={20} />
				</span>
				<div className={styles.text}>
					{active ? (
						<>
							<h3 className={styles.title}>{active.from <= today ? t(`${k}.active`, { date: fmtShort(active.to, locale) }) : t(`${k}.upcoming`, { from: fmtShort(active.from, locale), to: fmtShort(active.to, locale) })}</h3>
							<p className={styles.p}>{t(`${k}.activeBody`)}</p>
						</>
					) : (
						<>
							<h3 className={styles.title}>{t(`${k}.title`)}</h3>
							<p className={styles.p}>{t(`${k}.body`)}</p>
						</>
					)}
					<div>
						{active ? (
							<Button variant="secondary" size="sm" onClick={() => setConfirmRemove(true)}>
								{t(`${k}.remove`)}
							</Button>
						) : (
							<Button variant="secondary" size="sm" iconLeft={PauseIcon} onClick={() => setPicking(true)}>
								{t(`${k}.cta`)}
							</Button>
						)}
					</div>
				</div>
			</Card>

			<Sheet
				open={picking}
				onClose={() => setPicking(false)}
				title={t(`${k}.sheetTitle`)}
				closeLabel={t("common.close")}
				footer={
					<Button onClick={add} disabled={blocked(weeks)}>
						{weeks === 1 ? t(`${k}.confirmOne`) : t(`${k}.confirm`, { n: weeks })}
					</Button>
				}
			>
				<p className={styles.sheetP}>{t(`${k}.sheetBody`, { date: fmtShort(monday, locale) })}</p>
				<ChoiceList
					items={WEEKS.map((n) => ({
						key: String(n),
						icon: Calendar03Icon,
						title: n === 1 ? t(`${k}.week`) : t(`${k}.weeks`, { n }),
						hint: t(`${k}.until`, { date: fmtShort(endFor(n), locale) }),
						current: weeks === n,
						disabled: blocked(n),
						onClick: () => setWeeks(n),
					}))}
				/>
			</Sheet>

			<Sheet
				open={confirmRemove}
				onClose={() => setConfirmRemove(false)}
				title={t(`${k}.removeTitle`)}
				closeLabel={t("common.close")}
				variant="center"
				footer={
					<>
						<Button variant="secondary" onClick={() => setConfirmRemove(false)}>
							{t(`${k}.cancel`)}
						</Button>
						<Button variant="danger" onClick={remove}>
							{t(`${k}.removeConfirm`)}
						</Button>
					</>
				}
			>
				{active && <p className={styles.sheetP}>{t(`${k}.removeBody`, { from: fmtShort(active.from, locale), to: fmtShort(active.to, locale) })}</p>}
			</Sheet>
		</>
	);
}
