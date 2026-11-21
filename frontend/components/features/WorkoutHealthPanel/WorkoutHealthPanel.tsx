"use client";

import { Cardiogram01Icon } from "@hugeicons/core-free-icons";
import clsx from "clsx";
import { Icon } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import type { HealthSample } from "@/lib/fit/health";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./WorkoutHealthPanel.module.scss";

interface Props {
	sample: HealthSample | null;
	zone: { zone: number; label: string } | null;
	alert: string | null;
	elapsedSec: number;
	resting: boolean;
	recoveryDrop: number;
}

// Heart rate, duration, activity and recovery. Simulated values are always labelled; nothing here is a medical measurement.
export function WorkoutHealthPanel({ sample, zone, alert, elapsedSec, resting, recoveryDrop }: Props) {
	const t = useT();
	return (
		<section className={styles.panel} aria-label={t("fit.health.title")}>
			<div className={styles.head}>
				<span className={styles.title}>
					<Icon icon={Cardiogram01Icon} size={16} />
					{t("fit.health.title")}
				</span>
			</div>
			<div className={styles.grid}>
				<div>
					<span className={clsx(styles.hr, zone && zone.zone >= 4 && styles.hot)} aria-live="off">
						{sample ? sample.hr : "--"}
					</span>
					<span className={styles.unit}>{t("fit.health.bpm")}</span>
					<span className={styles.sub}>{zone ? t("fit.health.zone", { n: zone.zone, label: zone.label }) : t("fit.health.connecting")}</span>
				</div>
				<div>
					<span className={styles.value}>{formatClock(elapsedSec)}</span>
					<span className={styles.sub}>{t("fit.health.duration")}</span>
				</div>
				<div>
					<span className={styles.value}>{resting ? t("fit.health.resting") : t("fit.health.working")}</span>
					<span className={styles.sub}>{resting && recoveryDrop > 0 ? t("fit.health.recoveryDrop", { n: recoveryDrop }) : t("fit.health.activity")}</span>
				</div>
			</div>
			{alert && (
				<p className={styles.alert} role="status">
					{alert}
				</p>
			)}
		</section>
	);
}
