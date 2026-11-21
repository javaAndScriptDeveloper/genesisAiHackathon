import type { MetadataRoute } from "next";

// Indexing is switched off for now: disallow everything.
export default function robots(): MetadataRoute.Robots {
	return { rules: { userAgent: "*", disallow: "/" } };
}
