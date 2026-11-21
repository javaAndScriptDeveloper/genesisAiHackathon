import Image, { type ImageProps } from "next/image";

type PictureProps = Omit<ImageProps, "src" | "alt"> & {
	/** Base name without extension, e.g. "hero" → /img/hero.webp and /img/hero@2x.webp (made by `bun run images`). */
	name: string;
	alt: string;
	width: number;
	height: number;
};

// `next/image` serves WebP and generates 1x/2x srcsets itself; the source is the @2x file so retina stays sharp.
export function Picture({ name, alt, width, height, ...rest }: PictureProps) {
	return <Image src={`/img/${name}@2x.webp`} alt={alt} width={width} height={height} {...rest} />;
}
