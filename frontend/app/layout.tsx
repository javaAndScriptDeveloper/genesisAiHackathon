import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/lib/query/Providers";
import "@/styles/globals.scss";

export const metadata: Metadata = {
	title: "AI Hackathon Genesis",
	description: "Frontend starter",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="uk" className={fontVariables}>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
