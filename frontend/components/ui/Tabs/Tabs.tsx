"use client";

import clsx from "clsx";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./Tabs.module.scss";

export interface TabItem {
	id: string;
	label: string;
	content: ReactNode;
}

interface TabsProps {
	tabs: TabItem[];
	defaultId?: string;
}

// WAI-ARIA tabs: arrows move focus and selection, Home/End jump.
export function Tabs({ tabs, defaultId }: TabsProps) {
	const base = useId();
	const [current, setCurrent] = useState(defaultId ?? tabs[0]?.id);
	const refs = useRef<Record<string, HTMLButtonElement | null>>({});

	const onKeyDown = (event: KeyboardEvent, index: number) => {
		const last = tabs.length - 1;
		const target =
			event.key === "ArrowRight" ? (index + 1) % tabs.length
			: event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
			: event.key === "Home" ? 0
			: event.key === "End" ? last
			: null;
		if (target === null) return;
		event.preventDefault();
		const tab = tabs[target];
		if (!tab) return;
		setCurrent(tab.id);
		refs.current[tab.id]?.focus();
	};

	return (
		<div>
			<div role="tablist" className={styles.list}>
				{tabs.map((tab, index) => (
					<button
						key={tab.id}
						ref={(node) => {
							refs.current[tab.id] = node;
						}}
						type="button"
						role="tab"
						id={`${base}-tab-${tab.id}`}
						aria-selected={tab.id === current}
						aria-controls={`${base}-panel-${tab.id}`}
						tabIndex={tab.id === current ? 0 : -1}
						className={clsx(styles.tab, tab.id === current && styles.active)}
						onClick={() => setCurrent(tab.id)}
						onKeyDown={(event) => onKeyDown(event, index)}
					>
						{tab.label}
					</button>
				))}
			</div>
			{tabs.map((tab) => (
				<div key={tab.id} role="tabpanel" id={`${base}-panel-${tab.id}`} aria-labelledby={`${base}-tab-${tab.id}`} hidden={tab.id !== current} className={styles.panel}>
					{tab.content}
				</div>
			))}
		</div>
	);
}
