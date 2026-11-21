import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/lib/query/Providers";
import "@/styles/globals.scss";

export const metadata: Metadata = {
	title: "Personal Coach",
	description: "Personalized fitness coaching: your plan, guided workouts and progress.",
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
