import { Subscription } from "@/components/features/Subscription/Subscription";

export default async function SubscriptionPage({ searchParams }: PageProps<"/subscription">) {
	const { from } = await searchParams;
	return <Subscription source={typeof from === "string" ? from : "profile"} />;
}
