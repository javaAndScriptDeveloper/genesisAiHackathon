import { redirect } from "next/navigation";

// The shell sends first-time users to onboarding. The UI kit stays available at /ui-kit.
export default function HomePage() {
	redirect("/today");
}
