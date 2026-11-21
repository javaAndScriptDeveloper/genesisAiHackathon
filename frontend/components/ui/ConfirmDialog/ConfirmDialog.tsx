"use client";

import { Button } from "../Button/Button";
import { Modal } from "../Modal/Modal";

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	cancelLabel?: string;
	tone?: "default" | "danger";
	loading?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

// Required for every destructive action. No fields, so the dialog container keeps focus.
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancel", tone = "default", loading, onConfirm, onCancel }: ConfirmDialogProps) {
	return (
		<Modal
			open={open}
			onClose={onCancel}
			title={title}
			footer={
				<>
					<Button variant="secondary" onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<p>{description}</p>
		</Modal>
	);
}
