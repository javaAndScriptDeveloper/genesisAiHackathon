import { ProgressCalendar } from "@/components/features/ProgressCalendar/ProgressCalendar";

export default async function ProgressCalendarPage({ searchParams }: PageProps<"/progress/calendar">) {
	const { month } = await searchParams;
	return <ProgressCalendar initialMonth={typeof month === "string" ? month : undefined} />;
}
