"use client";

import { PlayIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, ViewTransition, type ReactNode } from "react";
import { BottomNav } from "@/components/features/BottomNav/BottomNav";
import { DailyCheckRunner } from "@/components/features/DailyCheck/DailyCheckRunner";
import { Celebration } from "@/components/features/Celebration/Celebration";
import { ScenarioLoader } from "@/components/features/AppShell/ScenarioLoader";
import { PhoneFrame } from "@/components/features/PhoneFrame/PhoneFrame";
import { Icon, Skeleton, ToastProvider } from "@/components/ui";
import { formatClock } from "@/lib/fit/dates";
import { FitProvider, useFit } from "@/lib/fit/store/FitProvider";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./AppShell.module.scss";

const FULL_SCREEN = ["/workout", "/onboarding", "/profile/edit"];
const scrollMemory = new Map<string, number>();
const PAGE_MOTION = { "nav-forward": "page-forward", "nav-back": "page-back", "nav-exercise": "none", default: "page-fade" } as const;
const TRAINING_PAGE_MOTION = { ...PAGE_MOTION, default: "none" } as const;

function Screen({ children }: { children: ReactNode }) {
	const { state, ready } = useFit();
	const pathname = usePathname();
	const router = useRouter();
	const t = useT();
	const main = useRef<HTMLElement>(null);
	const full = FULL_SCREEN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
	const onboarding = pathname === "/onboarding";

	useEffect(() => {
		if (ready && !state.profile && !onboarding) router.replace("/onboarding");
		if (ready && state.profile && onboarding) router.replace("/today");
	}, [ready, state.profile, onboarding, router]);

	// Each screen remembers its own scroll position, so switching tabs and coming back feels continuous.
	// Layout effect: restore before the browser paints (and before the transition snapshot), so no page jump is visible.
	useLayoutEffect(() => {
		const el = main.current;
		if (!el) return;
		el.scrollTop = scrollMemory.get(pathname) ?? 0;
		const save = () => scrollMemory.set(pathname, el.scrollTop);
		el.addEventListener("scroll", save, { passive: true });
		return () => el.removeEventListener("scroll", save);
	}, [pathname, ready]);

	const active = state.active;
	const showResume = ready && !!active && active.phase !== "summary" && pathname !== "/workout";

	return (
		<>
			{/* The fixed-size scroll area is what animates on navigation, so the motion stays inside the screen.
			    Direction comes from transitionTypes on the navigating Link/router call; other changes get a soft fade. */}
			<ViewTransition update={pathname === "/training" ? TRAINING_PAGE_MOTION : PAGE_MOTION} default="none">
				<main ref={main} className={styles.main}>
					{ready && (state.profile || onboarding) ? children : <LoadingScreen />}
				</main>
			</ViewTransition>
			{showResume && active && (
				<Link href="/workout" className={styles.resume}>
					<Icon icon={PlayIcon} size={18} />
					<span className={styles.resumeText}>
						{t("fit.shell.resume")}: {active.title}
					</span>
					<span className={styles.resumeTime}>{formatClock(active.elapsedSec)}</span>
				</Link>
			)}
			{!full && ready && state.profile && <BottomNav />}
			{ready && state.profile && <DailyCheckRunner />}
			<Celebration />
		</>
	);
}

function LoadingScreen() {
	return (
		<div className={styles.loading} aria-busy>
			<Skeleton height="3.2rem" width="60%" />
			<Skeleton height="16rem" />
			<Skeleton height="10rem" />
			<Skeleton height="10rem" />
		</div>
	);
}

export function AppShell({ children }: { children: ReactNode }) {
	return (
		<FitProvider>
			<ScenarioLoader />
			<PhoneFrame>
				<ToastProvider>
					<Screen>{children}</Screen>
				</ToastProvider>
			</PhoneFrame>
		</FitProvider>
	);
}
