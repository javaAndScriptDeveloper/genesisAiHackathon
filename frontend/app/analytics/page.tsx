import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/sections/AnalyticsDashboard/AnalyticsDashboard";
import { t } from "@/lib/messages";

export const metadata: Metadata = { title: t("analytics.title") };

export default function AnalyticsPage() {
	return <AnalyticsDashboard />;
}
