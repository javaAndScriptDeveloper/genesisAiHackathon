import { ProgressRecords } from "@/components/features/ProgressRecords/ProgressRecords";

export default async function ProgressRecordsPage({ searchParams }: PageProps<"/progress/records">) {
	const { exercise } = await searchParams;
	return <ProgressRecords initialExercise={typeof exercise === "string" ? exercise : undefined} />;
}
