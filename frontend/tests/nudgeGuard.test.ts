import { describe, expect, it } from "vitest";
import { nudgeViolations } from "@/lib/fit/nudgeGuard";

describe("nudgeViolations", () => {
	it("passes a clean text that uses the given numbers", () => {
		expect(nudgeViolations("Seven weeks straight. Keep it going.", { streak: 7 })).toEqual([]);
	});
	it("flags empty text", () => expect(nudgeViolations("  ", {})).toContain("empty"));
	it("flags more than two sentences", () => expect(nudgeViolations("Go. Now. Please.", {})).toContain("too-many-sentences"));
	it("flags text over 220 characters", () => expect(nudgeViolations(`${"word ".repeat(50)}.`, {})).toContain("too-long"));
	it("flags emoji and hashtags", () => {
		expect(nudgeViolations("Go now 💪", {})).toContain("emoji");
		expect(nudgeViolations("Go now #gym", {})).toContain("hashtag");
	});
	it("flags a number that is not in the facts", () => {
		expect(nudgeViolations("You have a 12 week streak.", { streak: 7 })).toContain("invented-number");
		expect(nudgeViolations("Twelve weeks strong.", { streak: 7 })).toContain("invented-number");
	});
	it("allows numbers from the facts, as digits or words, and digits from the title", () => {
		expect(nudgeViolations("Two days ago you skipped it.", { daysMissed: 2 })).toEqual([]);
		expect(nudgeViolations("2 days gone.", { daysMissed: 2 })).toEqual([]);
		expect(nudgeViolations("Do the Full Body 2 session.", { title: "Full Body 2" })).toEqual([]);
	});
	it("flags body shaming and medical advice", () => {
		expect(nudgeViolations("You look fat, go train.", {})).toContain("unsafe");
		expect(nudgeViolations("Maybe see a doctor about that.", {})).toContain("unsafe");
	});
});
