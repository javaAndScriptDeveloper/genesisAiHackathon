import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/lib/query/Providers";
import "@/styles/globals.scss";

export const metadata: Metadata = {
	title: "Personal Coach",
	description: "Personalized fitness coaching: your plan, guided workouts and progress.",
	// Not for search engines yet.
	robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={fontVariables}>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
