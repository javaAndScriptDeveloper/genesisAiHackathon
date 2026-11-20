"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import { IconButton } from "../IconButton/IconButton";
import styles from "./Carousel.module.scss";

interface CarouselProps {
	slides: ReactNode[];
	/** Slides visible per breakpoint; defaults to 1 / 2 / 3. */
	perView?: { base: number; md: number; lg: number };
	autoplayMs?: number;
	label: string;
}

// Swiper wrapper. Autoplay respects reduced motion (disabled when the user prefers it).
export function Carousel({ slides, perView = { base: 1, md: 2, lg: 3 }, autoplayMs, label }: CarouselProps) {
	const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	return (
		<div className={styles.root} role="region" aria-roledescription="carousel" aria-label={label}>
			<Swiper
				modules={[Navigation, Pagination, Autoplay, Keyboard, A11y]}
				spaceBetween={16}
				slidesPerView={perView.base}
				breakpoints={{ 768: { slidesPerView: perView.md }, 992: { slidesPerView: perView.lg } }}
				pagination={{ clickable: true }}
				navigation={{ prevEl: `.${styles.prev}`, nextEl: `.${styles.next}` }}
				keyboard
				autoplay={autoplayMs && !reduced ? { delay: autoplayMs, pauseOnMouseEnter: true, disableOnInteraction: false } : false}
				className={styles.swiper}
			>
				{slides.map((slide, i) => (
					<SwiperSlide key={i} className={styles.slide}>
						{slide}
					</SwiperSlide>
				))}
			</Swiper>
			<div className={styles.controls}>
				<IconButton className={styles.prev} icon={ArrowLeft01Icon} label="Попередній слайд" variant="secondary" />
				<IconButton className={styles.next} icon={ArrowRight01Icon} label="Наступний слайд" variant="secondary" />
			</div>
		</div>
	);
}
