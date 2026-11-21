// Monetization and paid acquisition assumptions from the market report, §4.
const marketBase = { annualShare: 0.55, annualRenewal: 0.30, monthlyLifetime: 4, conversion: 0.03, cpi: 3.77 };
const marketBudget = { organicPercent: 50, fixedCosts: 5000 };

export const scenarios = {
	pilot: { ...marketBase, organicPercent: 90, fixedCosts: 50 },
	conservative: { ...marketBudget, annualShare: 0.45, annualRenewal: 0.23, monthlyLifetime: 3, conversion: 0.018, cpi: 4.70 },
	base: { ...marketBase, ...marketBudget },
	optimistic: { ...marketBudget, annualShare: 0.60, annualRenewal: 0.36, monthlyLifetime: 5, conversion: 0.045, cpi: 3 },
};

export type Scenario = keyof typeof scenarios;
export const defaultScenario: Scenario = "pilot";

const kickoffMinute = 10 * 60 + 30;
const demoMinute = 17 * 60 + 50;
export const buildMinutes = demoMinute - kickoffMinute;

export const assumptions = {
	monthlyPrice: 9.99,
	annualPrice: 59.99,
	storeFee: 0.15,
	infraPerMonth: 0.10,
	defaultCombinedHourlyRate: 50,
};

// Calls per paid month × (input and output tokens priced per million).
const aiFeatures = [
	{ calls: 4, input: 6000, output: 2000, inputRate: 2, outputRate: 10 },
	{ calls: 4, input: 5000, output: 800, inputRate: 2, outputRate: 10 },
	{ calls: 12, input: 4000, output: 400, inputRate: 0.10, outputRate: 0.50 },
	{ calls: 16, input: 3000, output: 300, inputRate: 0.10, outputRate: 0.50 },
	{ calls: 30, input: 1000, output: 100, inputRate: 0.10, outputRate: 0.50 },
];

export function modelEconomics(scenario: Scenario, organicShare: number, fixedCosts: number) {
	const { annualShare, annualRenewal, monthlyLifetime, conversion, cpi } = scenarios[scenario];
	const { monthlyPrice, annualPrice, storeFee, infraPerMonth } = assumptions;
	const aiPerMonth = aiFeatures.reduce((sum, feature) => (
		sum + feature.calls * (feature.input * feature.inputRate + feature.output * feature.outputRate) / 1_000_000
	), 0);

	const monthlyShare = 1 - annualShare;
	const paidMonths = monthlyShare * monthlyLifetime + annualShare * 12 * (1 + annualRenewal);
	const grossLifetime = monthlyShare * monthlyLifetime * monthlyPrice + annualShare * (1 + annualRenewal) * annualPrice;
	const grossPerMonth = grossLifetime / paidMonths;
	const feePerMonth = grossPerMonth * storeFee;
	const netPerMonth = grossPerMonth - feePerMonth;
	const contributionPerMonth = netPerMonth - aiPerMonth - infraPerMonth;
	const ltv = contributionPerMonth * paidMonths;
	const paidCac = cpi / conversion;
	const blendedCac = paidCac * (1 - organicShare);
	const ratio = blendedCac > 0 ? ltv / blendedCac : null;

	// Annual revenue is recognized over each term, with only the first renewal projected.
	let cumulative = 0;
	const monthlyContribution = Array.from({ length: 24 }, (_, index) => {
		const monthlyWeight = index < monthlyLifetime ? monthlyShare : 0;
		const annualWeight = index < 12 ? annualShare : annualShare * annualRenewal;
		cumulative += monthlyWeight * (monthlyPrice * (1 - storeFee) - aiPerMonth - infraPerMonth)
			+ annualWeight * (annualPrice / 12 * (1 - storeFee) - aiPerMonth - infraPerMonth);
		return { month: index + 1, contribution: cumulative };
	});
	const firstYearContribution = monthlyContribution[11]?.contribution ?? 0;
	const recovered = monthlyContribution.find(({ contribution }) => contribution >= blendedCac - 1e-8);

	return {
		ltv, paidCac, blendedCac, ratio, paidMonths, grossPerMonth, feePerMonth, netPerMonth,
		aiPerMonth, infraPerMonth, contributionPerMonth, monthlyContribution, firstYearContribution,
		paybackMonths: blendedCac === 0 ? 0 : recovered?.month ?? null,
		breakEven: contributionPerMonth > 0 ? Math.ceil(fixedCosts / contributionPerMonth) : null,
		organicForBreakEven: Math.max(0, 1 - ltv / paidCac),
	};
}

// Compares each new payer's first 12 months with one year of overhead and the one-time build labor.
export function estimateBuildPayback(hourlyRate: number, firstYearContribution: number, blendedCac: number, fixedCosts = 0) {
	const cost = buildMinutes * hourlyRate / 60;
	const firstYearCost = cost + 12 * fixedCosts;
	const contributionAfterCac = firstYearContribution - blendedCac;
	const payers = contributionAfterCac < 0 || (contributionAfterCac === 0 && firstYearCost > 0)
		? null
		: firstYearCost === 0 ? 0 : Math.ceil(firstYearCost / contributionAfterCac);
	return { cost, firstYearCost, contributionAfterCac, payers };
}
