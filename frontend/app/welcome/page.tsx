import type { Metadata } from "next";
import { Landing } from "@/components/sections/Landing/Landing";

export const metadata: Metadata = {
	title: "Spotter AI: your AI fitness spotter",
	description: "A personal plan, guided workouts with video, real progress and an AI coach that adapts to you.",
	robots: { index: false, follow: false },
};

export default function WelcomePage() {
	return <Landing />;
}
