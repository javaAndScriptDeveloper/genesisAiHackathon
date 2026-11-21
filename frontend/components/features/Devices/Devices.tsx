"use client";

import { AppleIcon, SmartWatch01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { Notice } from "@/components/features/Notice/Notice";
import { WorkoutHealthPanel } from "@/components/features/WorkoutHealthPanel/WorkoutHealthPanel";
import { useWorkoutHealth } from "@/components/features/WorkoutHealthPanel/useWorkoutHealth";
import { Badge, Button, Card, EmptyState, Icon, Input, SegmentedControl, useToast } from "@/components/ui";
import { formatDay } from "@/lib/fit/dates";
import { validateBloodPressure } from "@/lib/fit/numberInput";
import { PROVIDERS } from "@/lib/fit/health";
import { simulateOutcome } from "@/lib/fit/aiFlow";
import type { Scenario } from "@/lib/fit/dailyStats";
import { useFit } from "@/lib/fit/store/FitProvider";
import { useAiPlan } from "@/lib/fit/store/useAiPlan";
import { useT } from "@/lib/i18n/I18nProvider";
import kit from "../ScreenKit/ScreenKit.module.scss";

export function Devices() {
	const t = useT();
	const toast = useToast();
	const { state, dispatch } = useFit();
	const [sys, setSys] = useState("");
	const [dia, setDia] = useState("");
	const [scenario, setScenario] = useState<Scenario>("normal");
	const { busy, runDaily } = useAiPlan();
	const anyLinked = state.devices.apple || state.devices.garmin;
	const health = useWorkoutHealth({ enabled: anyLinked, intensity: 0.25, age: state.profile?.age ?? 30 });
	const bp = validateBloodPressure(sys, dia);
	const sysErr = bp.sysError ? t("fit.devices.bpSysError") : undefined;
	const diaErr = bp.diaError ? t("fit.devices.bpDiaError") : undefined;
	const valid = bp.valid;
	const scenarios: { id: Scenario; label: string }[] = [
		{ id: "normal", label: t("fit.ai.simulate.normal") },
		{ id: "tired", label: t("fit.ai.simulate.tired") },
		{ id: "bad-night", label: t("fit.ai.simulate.badNight") },
	];
	// Simulates last night on the backend device, then re-runs today's readiness check.
	const simulate = async () => {
		const outcome = simulateOutcome(await runDaily({ scenario, force: true }));
		if (outcome === "failed") toast.show(t("fit.ai.simulate.failed"), "danger");
		else toast.show(t(outcome === "unchanged" ? "fit.ai.simulate.fine" : `fit.ai.simulate.${outcome}`), "success");
	};

	return (
		<div className={kit.page}>
			<ScreenHeader title={t("fit.devices.title")} back />
			<div className={kit.content}>
				<Notice>{t("fit.devices.honest")}</Notice>
				<ul className={kit.list}>
					{PROVIDERS.map((p) => {
						const linked = state.devices[p.id];
						return (
							<li key={p.id} className={`${kit.row} ${kit.rowStack}`}>
								<div className={kit.rowHead}>
									<span className={kit.plate}>
										<Icon icon={p.id === "apple" ? AppleIcon : SmartWatch01Icon} size={20} />
									</span>
									<span className={kit.rowText}>
										<strong>{p.name}</strong>
										<span>{p.description}</span>
									</span>
								</div>
								<div className={kit.rowHead}>
									<Badge tone={linked ? "success" : "neutral"}>{linked ? t("fit.devices.linkedDemo") : t("fit.devices.notLinked")}</Badge>
									<Button size="sm" variant="secondary" className={kit.pushRight} onClick={() => { dispatch({ type: "device", id: p.id, connected: !linked }); toast.show(linked ? t("fit.devices.disconnected", { name: p.name }) : t("fit.devices.connected", { name: p.name }), linked ? "info" : "success"); }}>
										{linked ? t("fit.devices.disconnect") : t("fit.devices.connect")}
									</Button>
								</div>
							</li>
						);
					})}
				</ul>

				{anyLinked ? (
					<WorkoutHealthPanel sample={health.sample} zone={health.zone} alert={health.alert} elapsedSec={0} resting recoveryDrop={health.recoveryDrop} />
				) : (
					<EmptyState icon={SmartWatch01Icon} title={t("fit.devices.noneTitle")} description={t("fit.devices.noneBody")} />
				)}

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.ai.simulate.title")}</h2>
					<p className={kit.note}>{t("fit.ai.simulate.note")}</p>
					<SegmentedControl options={scenarios} value={scenario} onChange={setScenario} label={t("fit.ai.simulate.label")} />
					<Button variant="secondary" loading={busy} disabled={busy} onClick={() => void simulate()}>{t("fit.ai.simulate.run")}</Button>
				</Card>

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.devices.bpTitle")}</h2>
					<Badge tone="warning">{t("fit.devices.bpBadge")}</Badge>
					<p className={kit.note}>{t("fit.devices.bpNote")}</p>
					<div className={kit.cols}>
						<Input label={t("fit.devices.systolic")} type="text" inputMode="numeric" suffix="mmHg" value={sys} onChange={(e) => setSys(e.target.value)} error={sysErr} />
						<Input label={t("fit.devices.diastolic")} type="text" inputMode="numeric" suffix="mmHg" value={dia} onChange={(e) => setDia(e.target.value)} error={diaErr} />
					</div>
					<Button disabled={!valid} onClick={() => { dispatch({ type: "add-bp", systolic: bp.systolic ?? 0, diastolic: bp.diastolic ?? 0, now: new Date().toISOString() }); setSys(""); setDia(""); toast.show(t("fit.devices.bpSaved"), "success"); }}>{t("fit.common.save")}</Button>
					{state.bloodPressure.length > 0 && (
						<ul className={kit.list}>
							{state.bloodPressure.slice(0, 5).map((b) => (
								<li key={b.id} className={kit.row}>
									<span className={kit.rowText}><strong>{b.systolic}/{b.diastolic} mmHg</strong><span>{formatDay(b.at.slice(0, 10))} · {t("fit.devices.manual")}</span></span>
									<Button size="sm" variant="ghost" onClick={() => dispatch({ type: "remove-bp", id: b.id })}>{t("fit.devices.remove")}</Button>
								</li>
							))}
						</ul>
					)}
				</Card>
			</div>
		</div>
	);
}
