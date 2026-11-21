import { WeeklyReport } from "@/components/features/WeeklyReport/WeeklyReport";

export default async function WeeklyReportPage({ params }: PageProps<"/progress/week/[week]">) {
	const { week } = await params;
	return <WeeklyReport week={week} />;
}
