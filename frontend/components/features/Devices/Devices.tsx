"use client";

import { AppleIcon, SmartWatch01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { ScreenHeader } from "@/components/features/ScreenHeader/ScreenHeader";
import { WorkoutHealthPanel } from "@/components/features/WorkoutHealthPanel/WorkoutHealthPanel";
import { useWorkoutHealth } from "@/components/features/WorkoutHealthPanel/useWorkoutHealth";
import { Badge, Button, Card, EmptyState, Icon, Input, SegmentedControl, useToast } from "@/components/ui";
import { Notice } from "@/components/features/Notice/Notice";
import { formatDay } from "@/lib/fit/dates";
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
	const s = Number(sys);
	const d = Number(dia);
	const sysErr = sys !== "" && (s < 70 || s > 250) ? t("fit.devices.bpSysError") : undefined;
	const diaErr = dia !== "" && (d < 40 || d > 150) ? t("fit.devices.bpDiaError") : undefined;
	const scenarios: { id: Scenario; label: string }[] = [
		{ id: "normal", label: t("fit.ai.demoSim.normal") },
		{ id: "tired", label: t("fit.ai.demoSim.tired") },
		{ id: "bad-night", label: t("fit.ai.demoSim.badNight") },
	];
	const simulate = async () => {
		const outcome = simulateOutcome(await runDaily({ scenario, force: true }));
		if (outcome === "failed") toast.show(t("fit.ai.demoSim.failed"), "danger");
		else toast.show(t(outcome === "unchanged" ? "fit.ai.demoSim.fine" : `fit.ai.demoSim.${outcome}`), "success");
	};
	const valid = sys !== "" && dia !== "" && !sysErr && !diaErr && s > d;

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
									<Badge tone={linked ? "warning" : "neutral"}>{linked ? t("fit.devices.linkedDemo") : t("fit.devices.notLinked")}</Badge>
									<Button size="sm" variant={linked ? "secondary" : "primary"} className={kit.pushRight} onClick={() => { dispatch({ type: "device", id: p.id, connected: !linked }); toast.show(linked ? t("fit.devices.disconnected", { name: p.name }) : t("fit.devices.connected", { name: p.name }), linked ? "info" : "success"); }}>
										{linked ? t("fit.devices.disconnect") : t("fit.devices.connect")}
									</Button>
								</div>
							</li>
						);
					})}
				</ul>

				{anyLinked ? (
					<WorkoutHealthPanel sample={health.sample} zone={health.zone} alert={health.alert} elapsedSec={0} resting recoveryDrop={health.recoveryDrop} linkedTo={state.devices.apple ? "Apple Health" : "Garmin"} />
				) : (
					<EmptyState icon={SmartWatch01Icon} title={t("fit.devices.noneTitle")} description={t("fit.devices.noneBody")} />
				)}

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.ai.demoSim.title")}</h2>
					<Badge tone="warning">{t("fit.ai.daily.demo")}</Badge>
					<p className={kit.note}>{t("fit.ai.demoSim.note")}</p>
					<SegmentedControl options={scenarios} value={scenario} onChange={setScenario} label={t("fit.ai.demoSim.label")} />
					<Button loading={busy} disabled={busy} onClick={simulate}>{t("fit.ai.demoSim.simulate")}</Button>
				</Card>

				<Card className={kit.stack}>
					<h2 className={kit.h2}>{t("fit.devices.bpTitle")}</h2>
					<Badge tone="warning">{t("fit.devices.bpBadge")}</Badge>
					<p className={kit.note}>{t("fit.devices.bpNote")}</p>
					<div className={kit.cols}>
						<Input label={t("fit.devices.systolic")} type="number" inputMode="numeric" suffix="mmHg" value={sys} onChange={(e) => setSys(e.target.value)} error={sysErr} />
						<Input label={t("fit.devices.diastolic")} type="number" inputMode="numeric" suffix="mmHg" value={dia} onChange={(e) => setDia(e.target.value)} error={diaErr} />
					</div>
					<Button disabled={!valid} onClick={() => { dispatch({ type: "add-bp", systolic: s, diastolic: d, now: new Date().toISOString() }); setSys(""); setDia(""); toast.show(t("fit.devices.bpSaved"), "success"); }}>{t("fit.common.save")}</Button>
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
