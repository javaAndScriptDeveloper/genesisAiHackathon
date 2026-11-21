import { AppShell } from "@/components/features/AppShell/AppShell";

// Every product screen lives inside the phone shell, which owns the app state, navigation and in-frame overlays.
export default function AppLayout({ children }: LayoutProps<"/">) {
	return <AppShell>{children}</AppShell>;
}
