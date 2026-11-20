import type { Metadata } from "next";
import { BackendStatus } from "@/components/sections/BackendStatus/BackendStatus";
import { t } from "@/lib/messages";

export const metadata: Metadata = { title: t("backendStatus.title") };

// Calls the backend on every request: never prerender a stale status.
export const dynamic = "force-dynamic";

export default function StatusPage() {
	return <BackendStatus />;
}
