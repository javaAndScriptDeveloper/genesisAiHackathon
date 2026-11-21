import type { Metadata } from "next";
import { UiKitShowcase } from "@/components/sections/UiKitShowcase/UiKitShowcase";

export const metadata: Metadata = { title: "UI Kit" };

export default function UiKitPage() {
	return <UiKitShowcase />;
}
