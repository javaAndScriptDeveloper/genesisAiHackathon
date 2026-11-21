"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./PhoneFrame.module.scss";

// Desktop: a centered iPhone-style device. Real phones (< 576px wide): the frame disappears and the app fills the screen.
export function PhoneFrame({ children, hideStatusBar = false }: { children: ReactNode; hideStatusBar?: boolean }) {
	const [clock, setClock] = useState("9:41");
	useEffect(() => {
		const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false }));
		tick();
		const id = window.setInterval(tick, 30_000);
		return () => window.clearInterval(id);
	}, []);

	return (
		<div className={styles.stage}>
			<div className={styles.device}>
				<div className={styles.screen}>
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
					<span className={styles.homeBar} aria-hidden />
				</div>
			</div>
		</div>
	);
}
