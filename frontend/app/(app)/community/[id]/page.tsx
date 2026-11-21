import { BuddyScreen } from "@/components/features/Community/BuddyScreen";

export default async function Page({ params }: PageProps<"/community/[id]">) {
	const { id } = await params;
	return <BuddyScreen id={id} />;
}
