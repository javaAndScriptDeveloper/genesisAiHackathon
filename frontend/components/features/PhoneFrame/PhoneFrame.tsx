"use client";

import Link from "next/link";
import { ChartBarLineIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon/Icon";
import { useTheme } from "@/lib/hooks/useTheme";
import { OverlayRootContext } from "@/components/ui/Sheet/OverlayRoot";
import { useT } from "@/lib/i18n/I18nProvider";
import styles from "./PhoneFrame.module.scss";

// Desktop: a centered iPhone-style device. Real phones (< 576px wide): the frame disappears and the app fills the screen.
export function PhoneFrame({ children, hideStatusBar = false }: { children: ReactNode; hideStatusBar?: boolean }) {
	const { theme } = useTheme();
	const t = useT();
	const [clock, setClock] = useState("9:41");
	const [screen, setScreen] = useState<HTMLDivElement | null>(null);
	useEffect(() => {
		const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false }));
		tick();
		const id = window.setInterval(tick, 30_000);
		return () => window.clearInterval(id);
	}, []);

	return (
		<div className={styles.stage} data-theme={theme}>
			<Link href="/analytics" className={styles.analyticsLink}>
				<Icon icon={ChartBarLineIcon} size={18} /> {t("analytics.title")}
			</Link>
			<div className={styles.device}>
				<div className={styles.screen} ref={setScreen}>
					<OverlayRootContext.Provider value={screen}>
					{!hideStatusBar && (
						<div className={styles.statusBar} aria-hidden>
							<span className={styles.time}>{clock}</span>
							<span className={styles.island} />
							<span className={styles.indicators}>
								<span className={styles.signal} />
								<span className={styles.battery} />
							</span>
						</div>
					)}
					{children}
					</OverlayRootContext.Provider>
					<span className={styles.homeBar} aria-hidden />
				</div>
			</div>
		</div>
	);
}
