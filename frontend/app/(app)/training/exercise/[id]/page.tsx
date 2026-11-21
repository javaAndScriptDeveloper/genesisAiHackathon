import { ExerciseDetail } from "@/components/features/ExerciseDetail/ExerciseDetail";

export default async function ExercisePage({ params }: PageProps<"/training/exercise/[id]">) {
	const { id } = await params;
	return <ExerciseDetail id={id} />;
}
