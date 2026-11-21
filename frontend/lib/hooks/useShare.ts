"use client";

import { useToast } from "@/components/ui";
import { shareCard, type ShareCardSpec } from "@/lib/fit/shareCard";
import { useT } from "@/lib/i18n/I18nProvider";

/** Shares text plus an image card and toasts only for a clipboard copy or a real failure (never for a cancelled sheet). */
export function useShare() {
	const t = useT();
	const toast = useToast();
	return async (title: string, text: string, spec: ShareCardSpec): Promise<void> => {
		const result = await shareCard(title, text, spec);
		if (result === "copied") toast.show(t("fit.common.copied"), "success");
		if (result === "failed") toast.show(t("fit.common.shareFailed"), "danger");
	};
}
