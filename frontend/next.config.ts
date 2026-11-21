import path from "node:path";
import type { NextConfig } from "next";

// Docker/compose address of platform-backend; override with BACKEND_URL for local runs.
const backendUrl = process.env.BACKEND_URL ?? "http://platform-backend:3000";

const nextConfig: NextConfig = {
	// Required by frontend/Dockerfile (copies .next/standalone).
	output: "standalone",
	turbopack: { root: process.cwd() },
	// Images are always served as WebP; sizes cover 1x and 2x (retina) renditions.
	images: {
		formats: ["image/webp"],
		deviceSizes: [360, 640, 768, 1024, 1280, 1536, 1920, 2560],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512, 768],
		qualities: [75, 85, 90],
	},
	sassOptions: {
		// Lets SCSS modules write `@use "partials/corners"` and `@use "partials/mixins"`.
		loadPaths: [path.join(process.cwd(), "styles")],
		silenceDeprecations: ["import"],
	},
	// /api/* goes to platform-backend. It must be a `fallback` rewrite: those run only when no route
	// matched, so our own handlers (app/api/ai, app/api/mock/[...path]) keep priority. An afterFiles
	// rewrite would shadow the dynamic mock route.
	async rewrites() {
		return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }] };
	},
};

export default nextConfig;
