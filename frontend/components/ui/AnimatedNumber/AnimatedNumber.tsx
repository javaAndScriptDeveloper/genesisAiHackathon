"use client";

import NumberFlow from "@number-flow/react";

interface AnimatedNumberProps {
	value: number;
	decimals?: number;
	prefix?: string;
	suffix?: string;
	className?: string;
}

// Digits roll up or down when the value changes (period switches, new workout totals). Library: @number-flow/react.
export function AnimatedNumber({ value, decimals = 0, prefix, suffix, className }: AnimatedNumberProps) {
	return <NumberFlow className={className} value={value} locales="en-US" prefix={prefix} suffix={suffix} format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }} />;
}
