"use client";

import {
	ChartIncreaseIcon, Clock01Icon, Coins01Icon, MoneyAdd01Icon, Target02Icon, Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Badge, Card, Icon, Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { assumptions, buildMinutes, estimateBuildPayback, modelEconomics, scenarios, type Scenario } from "@/lib/insights/economics";
import styles from "./AnalyticsDashboard.module.scss";

const scenarioOptions: Scenario[] = ["conservative", "base", "optimistic"];

export function EconomicsPanel() {
	const { locale, t } = useI18n();
	const [scenario, setScenario] = useState<Scenario>("base");
	const [organic, setOrganic] = useState(String(assumptions.defaultOrganicPercent));
	const [fixed, setFixed] = useState(String(assumptions.defaultFixedCosts));
	const [hourly, setHourly] = useState(String(assumptions.defaultCombinedHourlyRate));
	const hourlyInvalid = !hourly || Number(hourly) < 0 || Number(hourly) > 1_000_000;
	const organicInvalid = !organic || Number(organic) < 0 || Number(organic) > 100;
	const fixedInvalid = !fixed || Number(fixed) < 0 || Number(fixed) > 1_000_000_000;
	const organicPercent = organicInvalid ? assumptions.defaultOrganicPercent : Number(organic);
	const fixedCosts = fixedInvalid ? assumptions.defaultFixedCosts : Number(fixed);
	const model = modelEconomics(scenario, organicPercent / 100, fixedCosts);
	const build = estimateBuildPayback(
		hourlyInvalid ? assumptions.defaultCombinedHourlyRate : Number(hourly),
		model.firstYearContribution,
		model.blendedCac,
	);
	const formatMoney = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol" });
	const formatWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const formatDecimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
	const formatPercent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
	const money = (value: number) => formatMoney.format(value);
	const whole = (value: number) => formatWhole.format(value);
	const decimal = (value: number) => formatDecimal.format(value);
	const percent = (value: number) => formatPercent.format(value);

	const metrics = [
		{ id: "ltv", value: money(model.ltv), detail: t("analytics.model.ltvDetail"), icon: ChartIncreaseIcon },
		{ id: "cac", value: money(model.blendedCac), detail: t("analytics.model.cacDetail", { value: money(model.paidCac) }), icon: Target02Icon },
		{ id: "ratio", value: model.ratio === null ? "—" : t("analytics.model.multiple", { value: decimal(model.ratio) }), detail: t("analytics.model.ratioDetail"), icon: Wallet01Icon },
		{
			id: "payback", value: model.paybackMonths === null ? t("analytics.model.noPayback") : t("analytics.model.months", { value: model.paybackMonths }),
			detail: t("analytics.model.paybackDetail"), icon: Clock01Icon,
		},
	];
	const costs = [
		{ id: "fees", value: model.feePerMonth },
		{ id: "ai", value: model.aiPerMonth },
		{ id: "infra", value: model.infraPerMonth },
		{ id: "contribution", value: model.contributionPerMonth },
	];
	const steps = 4;
	const tick = Math.max(5, Math.ceil(Math.max(model.ltv, model.blendedCac) / steps / 5) * 5);
	const ceiling = tick * steps;
	const ticks = Array.from({ length: steps + 1 }, (_, index) => ceiling - index * tick);
	const inputs = [
		{ id: "monthlyPrice", value: money(assumptions.monthlyPrice) },
		{ id: "annualPrice", value: money(assumptions.annualPrice) },
		{ id: "annualShare", value: percent(scenarios[scenario].annualShare) },
		{ id: "annualRenewal", value: percent(scenarios[scenario].annualRenewal) },
		{ id: "monthlyLifetime", value: decimal(scenarios[scenario].monthlyLifetime) },
		{ id: "cpi", value: money(scenarios[scenario].cpi) },
		{ id: "conversion", value: percent(scenarios[scenario].conversion) },
		{ id: "storeFee", value: percent(assumptions.storeFee) },
	];

	return (
		<section id="economics" className={styles.economics} aria-labelledby="economics-title">
			<header className={styles.hero}>
				<div>
					<Badge tone="accent" className={styles.sourceBadge}>{t("analytics.model.badge")}</Badge>
					<h1 id="economics-title">{t("analytics.economics")}</h1>
					<p>{t("analytics.model.subtitle")}</p>
				</div>
				<Select
					className={styles.scenario}
					label={t("analytics.model.scenario")}
					value={scenario}
					options={scenarioOptions.map((value) => ({ value, label: t(`analytics.model.scenarios.${value}`) }))}
					onChange={setScenario}
				/>
			</header>

			<div className={styles.metrics} aria-live="polite">
				{metrics.map(({ id, value, detail, icon }) => (
					<Card key={id} className={styles.metric}>
						<div className={styles.metricLabel}>
							<span className={styles.metricIcon}><Icon icon={icon} size={18} /></span>
							<h2>{t(`analytics.model.metrics.${id}`)}</h2>
						</div>
						<strong className={id === "ratio" && model.ratio !== null && model.ratio < 1 ? styles.belowTarget : undefined}>{value}</strong>
						<p>{detail}</p>
					</Card>
				))}
			</div>

			<div className={styles.panels}>
				<Card className={styles.panel}>
					<header className={styles.panelHeading}>
						<div>
							<h2>{t("analytics.model.chartTitle")}</h2>
							<p>{t("analytics.model.chartDetail")}</p>
						</div>
						<span className={styles.panelIcon}><Icon icon={ChartIncreaseIcon} size={21} /></span>
					</header>
					<div className={styles.legend}>
						<span><i className={styles.barKey} />{t("analytics.model.cumulative")}</span>
						<span><i className={styles.lineKey} />{t("analytics.model.metrics.cac")}</span>
					</div>
					<div className={styles.chart}>
						<div className={styles.axis} aria-hidden>
							{ticks.map((value) => <span key={value}>{t("analytics.model.axis", { value: whole(value) })}</span>)}
						</div>
						<div className={styles.plot}>
							<div className={styles.gridlines} aria-hidden>{ticks.map((value) => <i key={value} />)}</div>
							<div className={styles.threshold} style={{ bottom: `${100 * model.blendedCac / ceiling}%` }} aria-hidden />
							<ul className={styles.bars} aria-label={t("analytics.model.cumulative")}>
								{model.monthlyContribution.map(({ month, contribution }) => (
									<li key={month}>
										<span className={styles.chartBar} style={{ height: `${100 * contribution / ceiling}%` }} title={t("analytics.model.chartValue", { month, value: money(contribution) })}>
											<span className={styles.srOnly}>{t("analytics.model.chartValue", { month, value: money(contribution) })}</span>
										</span>
										{(month === 1 || month % 4 === 0) && <span className={styles.tickLabel} aria-hidden>{month}</span>}
									</li>
								))}
							</ul>
						</div>
					</div>
				</Card>

				<Card className={styles.panel}>
					<header className={styles.panelHeading}>
						<div>
							<h2>{t("analytics.model.costTitle")}</h2>
							<p>{t("analytics.model.costDetail")}</p>
						</div>
						<span className={styles.panelIcon}><Icon icon={Coins01Icon} size={21} /></span>
					</header>
					<div className={styles.costTotal}>
						<span>{t("analytics.model.gross")}</span>
						<strong>{money(model.grossPerMonth)}</strong>
					</div>
					<div className={styles.costStack} aria-hidden>
						{costs.map(({ id, value }) => <span key={id} data-cost={id} style={{ width: `${100 * value / model.grossPerMonth}%` }} />)}
					</div>
					<dl className={styles.costRows}>
						{costs.map(({ id, value }) => (
							<div key={id} data-cost={id}>
								<dt><i />{t(`analytics.model.costs.${id}`)}</dt>
								<dd>{money(value)}</dd>
							</div>
						))}
					</dl>
				</Card>
			</div>

			<Card className={styles.assumptions}>
				<header className={styles.panelHeading}>
					<div>
						<h2>{t("analytics.model.breakEven")}</h2>
						<p>{t("analytics.model.breakEvenDetail")}</p>
					</div>
					<span className={styles.panelIcon}><Icon icon={MoneyAdd01Icon} size={21} /></span>
				</header>
				<div className={styles.driverGrid}>
					<Input label={t("analytics.model.organic")} type="number" min={0} max={100} step="any" suffix="%" value={organic} onChange={(event) => setOrganic(event.target.value)} error={organicInvalid ? t("analytics.model.organicError") : undefined} />
					<Input label={t("analytics.model.fixed")} type="number" min={0} max={1_000_000_000} step="any" suffix="USD" value={fixed} onChange={(event) => setFixed(event.target.value)} error={fixedInvalid ? t("analytics.model.fixedError") : undefined} />
					<div className={styles.driverOutput}>
						<span>{t("analytics.model.subscribers")}</span>
						<strong>{model.breakEven === null ? "—" : whole(model.breakEven)}</strong>
					</div>
					<div className={styles.driverOutput}>
						<span>{t("analytics.model.organicThreshold")}</span>
						<strong>{percent(model.organicForBreakEven)}</strong>
					</div>
				</div>
			</Card>

			<Card className={styles.assumptions}>
				<header className={styles.panelHeading}>
					<div>
						<h2>{t("analytics.build.title")}</h2>
						<p>{t("analytics.build.subtitle")}</p>
					</div>
					<span className={styles.panelIcon}><Icon icon={Clock01Icon} size={21} /></span>
				</header>
				<div className={styles.driverGrid}>
					<div className={styles.driverOutput}>
						<span>{t("analytics.build.elapsed")}</span>
						<strong>{t("analytics.build.duration", { hours: Math.floor(buildMinutes / 60), minutes: buildMinutes % 60 })}</strong>
					</div>
					<Input label={t("analytics.build.hourly")} type="number" min={0} max={1_000_000} step="any" suffix="USD" value={hourly} onChange={(event) => setHourly(event.target.value)} error={hourlyInvalid ? t("analytics.build.hourlyError") : undefined} />
					<div className={styles.driverOutput}>
						<span>{t("analytics.build.cost")}</span>
						<strong>{money(build.cost)}</strong>
					</div>
					<div className={styles.driverOutput} aria-live="polite">
						<span>{t("analytics.build.payers")}</span>
						<strong>{build.payers === null ? t("analytics.model.noPayback") : whole(build.payers)}</strong>
					</div>
				</div>
				<p className={styles.buildNote}>
					{t(build.contributionAfterCac > 0 ? "analytics.build.recoverable" : "analytics.build.unrecoverable", { value: money(build.contributionAfterCac) })}
				</p>
			</Card>

			<details className={styles.method}>
				<summary>{t("analytics.model.method")}</summary>
				<div className={styles.methodBody}>
					<dl className={styles.methodInputs}>
						{inputs.map(({ id, value }) => (
							<div key={id}><dt>{t(`analytics.model.inputs.${id}`)}</dt><dd>{value}</dd></div>
						))}
					</dl>
					<ul className={styles.notes}>
						{["ltv", "cac", "payback", "fixed", "limits", "source"].map((id) => <li key={id}>{t(`analytics.model.notes.${id}`)}</li>)}
					</ul>
				</div>
			</details>
		</section>
	);
}
