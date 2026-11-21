# Images

1. Put source PNG/JPG (treated as the **@2x master**) into `assets-src/`.
2. `bun run images` → `public/img/<name>.webp` (1x) and `<name>@2x.webp`. No upscaling; unchanged files skipped.
3. Render with `<Picture name="hero" alt="…" width={800} height={450} />` (wraps `next/image`; `images.unoptimized` is on, so the pre-built WebP files are served as-is and the /_next/image route is never used). Use `priority` for above-the-fold, `sizes` for responsive layouts.
4. Always meaningful `alt` (or `alt=""` if decorative). Never use raw `<img>` or CSS backgrounds for content images.
5. Remote images: add the host to `images.remotePatterns` in `next.config.ts`.
6. SVG icons/illustrations stay SVG.
