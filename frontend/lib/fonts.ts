import { Inter, Montserrat, Onest, Poppins, Unbounded } from "next/font/google";

// Body text. Cyrillic subset is required for Ukrainian copy.
export const inter = Inter({
	subsets: ["latin", "cyrillic"],
	variable: "--font-body",
	display: "swap",
});

// Display font for h1: heavy, distinctive.
export const unbounded = Unbounded({
	subsets: ["latin", "cyrillic"],
	weight: ["600", "800"],
	variable: "--font-display",
	display: "swap",
});

// Alternates, opt-in via `var(--font-montserrat)` / `var(--font-poppins)`.
export const montserrat = Montserrat({
	subsets: ["latin", "cyrillic"],
	variable: "--font-montserrat",
	display: "swap",
});

export const poppins = Poppins({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-poppins",
	display: "swap",
});

// Training UI design system body font (onboarding quiz), opt-in via `var(--font-onest)`.
export const onest = Onest({
	subsets: ["latin", "cyrillic"],
	variable: "--font-onest",
	display: "swap",
});

export const fontVariables = [inter, unbounded, montserrat, poppins, onest].map((f) => f.variable).join(" ");
