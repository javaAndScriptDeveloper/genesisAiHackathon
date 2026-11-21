import { SessionDetail } from "@/components/features/SessionDetail/SessionDetail";

export default async function SessionPage({ params }: PageProps<"/training/session/[id]">) {
	const { id } = await params;
	return <SessionDetail id={id} />;
}
