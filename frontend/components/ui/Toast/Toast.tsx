"use client";

import clsx from "clsx";
import { Alert02Icon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Icon } from "../Icon/Icon";
import styles from "./Toast.module.scss";

type Tone = "info" | "success" | "danger";
interface ToastItem {
	id: number;
	message: string;
	tone: Tone;
}
interface ToastApi {
	show: (message: string, tone?: Tone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ICONS = { info: InformationCircleIcon, success: CheckmarkCircle02Icon, danger: Alert02Icon } as const;
let counter = 0;
const MAX_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const show = useCallback((message: string, tone: Tone = "info") => {
		const id = ++counter;
		// At most three toasts at a time: the oldest one makes room for a new one.
		setToasts((list) => [...list, { id, message, tone }].slice(-MAX_TOASTS));
		window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
	}, []);
	const api = useMemo(() => ({ show }), [show]);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div className={styles.region} role="status" aria-live="polite">
				{toasts.map((toast) => (
					<div key={toast.id} className={clsx(styles.toast, styles[toast.tone])}>
						<Icon icon={ICONS[toast.tone]} size={20} />
						<span>{toast.message}</span>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used inside ToastProvider");
	return ctx;
}
