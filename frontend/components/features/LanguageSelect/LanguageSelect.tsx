"use client";

import { Select } from "@/components/ui";
import { LOCALES, LOCALE_FLAGS, LOCALE_LABELS, isLocale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";

// One language picker for onboarding, settings and the landing page. Languages are named in themselves, with a flag.
export function LanguageSelect({ label, className, placement = "down" }: { label?: string; className?: string; placement?: "down" | "up" }) {
	const { t, locale, setLocale } = useI18n();
	return (
		<Select
			label={label ?? t("fit.settings.languageLabel")}
			className={className}
			placement={placement}
			menuMaxHeight="24rem"
			value={locale}
			options={LOCALES.map((l) => ({ value: l, label: `${LOCALE_FLAGS[l]}  ${LOCALE_LABELS[l]}` }))}
			onChange={(value) => {
				if (isLocale(value)) setLocale(value);
			}}
		/>
	);
}
