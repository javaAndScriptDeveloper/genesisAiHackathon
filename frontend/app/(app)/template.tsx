import { ViewTransition } from "react";
import type { ReactNode } from "react";

// A template re-mounts on every navigation, so enter/exit run for each page change (layouts persist and would not).
// Direction comes from transition types set on the navigating Link/router call; anything else gets a soft fade.
export default function AppTemplate({ children }: { children: ReactNode }) {
	const motion = { "nav-forward": "page-forward", "nav-back": "page-back", default: "page-fade" } as const;
	return (
		<ViewTransition enter={motion} exit={motion} default="none">
			{children}
		</ViewTransition>
	);
}
