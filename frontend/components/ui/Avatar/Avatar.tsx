import clsx from "clsx";
import Image from "next/image";
import styles from "./Avatar.module.scss";

interface AvatarProps {
	name: string;
	src?: string;
	size?: number; // px
	className?: string;
}

export function Avatar({ name, src, size = 40, className }: AvatarProps) {
	const initials = name
		.split(/\s+/)
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
	return (
		<span className={clsx(styles.avatar, className)} style={{ width: size, height: size, fontSize: size * 0.38 }} role="img" aria-label={name}>
			{src ? <Image src={src} alt="" width={size} height={size} className={styles.image} /> : initials}
		</span>
	);
}
