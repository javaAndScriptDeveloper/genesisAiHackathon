import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

export type IconDefinition = IconSvgElement;

interface IconProps {
	icon: IconDefinition;
	size?: number; // px
	strokeWidth?: number;
	className?: string;
	/** Provide only for standalone meaningful icons; decorative icons stay aria-hidden. */
	label?: string;
}

// The only place Hugeicons are rendered. Import icon definitions individually at the call site:
//   import { Search01Icon } from "@hugeicons/core-free-icons";
export function Icon({ icon, size = 20, strokeWidth = 1.75, className, label }: IconProps) {
	return (
		<HugeiconsIcon
			icon={icon}
			size={size}
			strokeWidth={strokeWidth}
			className={className}
			aria-hidden={label ? undefined : true}
			aria-label={label}
			role={label ? "img" : undefined}
		/>
	);
}
