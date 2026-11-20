"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Modal.module.scss";

interface ModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	footer?: ReactNode;
}

const EDITABLE = 'input:not([type="hidden"]):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])';

// Native <dialog>: focus trap, Escape and inert background come from the platform.
// If the content has an editable field it is focused on open; otherwise the dialog itself keeps focus.
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			dialog.querySelector<HTMLElement>(EDITABLE)?.focus();
		} else if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			className={styles.dialog}
			aria-label={title}
			onClose={onClose}
			onClick={(event) => event.target === ref.current && onClose()}
		>
			<div className={styles.header}>
				<h3 className={styles.title}>{title}</h3>
				<IconButton icon={Cancel01Icon} label="Закрити" onClick={onClose} />
			</div>
			<div className={styles.body}>{children}</div>
			{footer && <div className={styles.footer}>{footer}</div>}
		</dialog>
	);
}
