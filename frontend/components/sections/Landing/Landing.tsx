"use client";

import { AiMagicIcon, ArrowRight02Icon, ChartUpIcon, Dumbbell03Icon, FireIcon, HeartCheckIcon, Restaurant01Icon, Shield01Icon, Tick02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { Spotty } from "@/components/features/Spotty/Spotty";
import { Badge, Icon, Picture, type IconDefinition } from "@/components/ui";
import { EXERCISES } from "@/lib/fit/exercises";
import { AWARD_INFO } from "@/lib/fit/awardsInfo";
import { LanguageSelect } from "@/components/features/LanguageSelect/LanguageSelect";
import { LOCALES } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./Landing.module.scss";

const APP_HREF = "/today";

type FeatureKey = "workout" | "awards" | "community" | "nutrition";
const FEATURES: { key: FeatureKey; shot: string; icon: IconDefinition; points: number }[] = [
	{ key: "workout", shot: "shot-workout", icon: Dumbbell03Icon, points: 3 },
	{ key: "awards", shot: "shot-awards", icon: ChartUpIcon, points: 3 },
	{ key: "community", shot: "shot-community", icon: UserGroupIcon, points: 3 },
	{ key: "nutrition", shot: "shot-nutrition", icon: Restaurant01Icon, points: 3 },
];
const FAQ = ["q1", "q2", "q3", "q4", "q5"] as const;

// Phone-shaped frame around a real app screenshot.
function Phone({ shot, alt, className, priority = false }: { shot: string; alt: string; className?: string; priority?: boolean }) {
	return (
		<div className={`${styles.phone} ${className ?? ""}`}>
			<Picture name={shot} alt={alt} width={390} height={844} sizes="(max-width: 768px) 70vw, 320px" priority={priority} className={styles.phoneImg} />
		</div>
	);
}

export function Landing() {
	const { t } = useI18n();

	return (
		<div className={styles.root}>
			<header className={styles.nav}>
				<Link href="/welcome" className={styles.brand}>
					<span className={styles.logo} aria-hidden>
						<Icon icon={Dumbbell03Icon} size={18} />
					</span>
					{t("landing.brand")}
				</Link>
				<nav className={styles.navLinks} aria-label={t("landing.brand")}>
					<a href="#features">{t("landing.nav.features")}</a>
					<a href="#how">{t("landing.nav.how")}</a>
					<a href="#faq">{t("landing.nav.faq")}</a>
				</nav>
				<div className={styles.navRight}>
					<LanguageSelect className={styles.lang} />
					<Link href={APP_HREF} className={styles.navCta}>
						{t("landing.nav.open")}
					</Link>
				</div>
			</header>

			<main>
				<section className={styles.hero}>
					<div className={styles.heroText}>
						<Badge tone="accent">
							<Icon icon={AiMagicIcon} size={12} />
							{t("landing.hero.eyebrow")}
						</Badge>
						<h1 className={styles.title}>{t("landing.hero.title")}</h1>
						<p className={styles.lead}>{t("landing.hero.body")}</p>
						<div className={styles.ctas}>
							<Link href={APP_HREF} className={styles.primary}>
								{t("landing.hero.cta")}
								<Icon icon={ArrowRight02Icon} size={18} />
							</Link>
							<a href="#how" className={styles.secondary}>
								{t("landing.hero.secondary")}
							</a>
						</div>
						<p className={styles.note}>{t("landing.hero.note", { n: LOCALES.length })}</p>
					</div>

					<div className={styles.heroVisual}>
						<span className={styles.glow} aria-hidden />
						<Phone shot="shot-today" alt={t("landing.features.workout.tag")} className={styles.heroPhone} priority />
						<Phone shot="shot-workout" alt={t("landing.features.workout.title")} className={styles.heroPhoneBack} priority />
						<span className={`${styles.chip} ${styles.chipA}`}>
							<Icon icon={Tick02Icon} size={14} />
							{t("landing.hero.chipPlan")}
						</span>
						<span className={`${styles.chip} ${styles.chipB}`}>
							<Icon icon={FireIcon} size={14} />
							{t("landing.hero.chipStreak", { n: 9 })}
						</span>
						<span className={`${styles.chip} ${styles.chipC}`}>
							<Icon icon={HeartCheckIcon} size={14} />
							{t("landing.hero.chipCoach")}
						</span>
					</div>
				</section>

				<ul className={styles.facts}>
					<li><strong>{EXERCISES.length}</strong><span>{t("landing.facts.exercises")}</span></li>
					<li><strong>{Object.keys(AWARD_INFO).length}</strong><span>{t("landing.facts.achievements")}</span></li>
					<li><strong>{LOCALES.length}</strong><span>{t("landing.facts.langs")}</span></li>
					<li><strong>5</strong><span>{t("landing.facts.minutes")}</span></li>
				</ul>

				<section id="how" className={styles.section}>
					<h2 className={styles.h2}>{t("landing.how.title")}</h2>
					<ol className={styles.steps}>
						{(["quiz", "plan", "train"] as const).map((s, i) => (
							<li key={s} className={styles.step}>
								<span className={styles.stepNum}>{i + 1}</span>
								<h3>{t(`landing.how.steps.${s}.title`)}</h3>
								<p>{t(`landing.how.steps.${s}.body`)}</p>
							</li>
						))}
					</ol>
				</section>

				<section id="features" className={styles.section}>
					<h2 className={styles.h2}>{t("landing.features.title")}</h2>
					<div className={styles.rows}>
						{FEATURES.map((f, i) => (
							<article key={f.key} className={styles.row} data-flip={i % 2 === 1 || undefined}>
								<div className={styles.rowText}>
									<span className={styles.tag}>
										<Icon icon={f.icon} size={16} />
										{t(`landing.features.${f.key}.tag`)}
									</span>
									<h3>{t(`landing.features.${f.key}.title`)}</h3>
									<p>{t(`landing.features.${f.key}.body`)}</p>
									<ul className={styles.points}>
										{Array.from({ length: f.points }, (_, n) => (
											<li key={n}>
												<Icon icon={Tick02Icon} size={16} strokeWidth={2.5} />
												{t(`landing.features.${f.key}.points.${n + 1}`)}
											</li>
										))}
									</ul>
								</div>
								<div className={styles.rowVisual}>
									<span className={styles.glow} aria-hidden />
									<Phone shot={f.shot} alt={t(`landing.features.${f.key}.title`)} />
								</div>
							</article>
						))}
					</div>

					<ul className={styles.cards}>
						{([["adapt", HeartCheckIcon], ["coach", AiMagicIcon], ["safe", Shield01Icon]] as const).map(([key, icon]) => (
							<li key={key} className={styles.card}>
								<span className={styles.cardIcon}>
									<Icon icon={icon} size={22} />
								</span>
								<h3>{t(`landing.features.${key}.title`)}</h3>
								<p>{t(`landing.features.${key}.body`)}</p>
							</li>
						))}
					</ul>
				</section>

				<section className={styles.spotty}>
					<Spotty mood="cheer" size="lg" />
					<div>
						<h2 className={styles.h2}>{t("landing.spotty.title")}</h2>
						<p className={styles.lead}>{t("landing.spotty.body")}</p>
					</div>
				</section>

				<section className={styles.section} data-center>
					<h2 className={styles.h2}>{t("landing.pricing.title")}</h2>
					<div className={styles.plans}>
						{(["free", "premium"] as const).map((plan) => (
							<article key={plan} className={styles.plan} data-featured={plan === "premium" || undefined}>
								{plan === "premium" && <Badge tone="accent">{t("landing.pricing.premium.badge")}</Badge>}
								<h3>{t(`landing.pricing.${plan}.name`)}</h3>
								<p className={styles.price}>{t(`landing.pricing.${plan}.price`)}</p>
								<ul className={styles.points}>
									{[1, 2, 3, 4].map((n) => (
										<li key={n}>
											<Icon icon={Tick02Icon} size={16} strokeWidth={2.5} />
											{t(`landing.pricing.${plan}.points.${n}`)}
										</li>
									))}
								</ul>
								<Link href={APP_HREF} className={plan === "premium" ? styles.primary : styles.secondary}>
									{t(`landing.pricing.${plan}.cta`)}
								</Link>
							</article>
						))}
					</div>
					<p className={styles.note}>{t("landing.pricing.note")}</p>
				</section>

				<section id="faq" className={styles.section}>
					<h2 className={styles.h2}>{t("landing.faq.title")}</h2>
					<div className={styles.faq}>
						{FAQ.map((q) => (
							<details key={q} className={styles.faqItem}>
								<summary>{t(`landing.faq.items.${q}.q`)}</summary>
								<p>{t(`landing.faq.items.${q}.a`)}</p>
							</details>
						))}
					</div>
				</section>

				<section className={styles.final}>
					<h2 className={styles.h2}>{t("landing.cta.title")}</h2>
					<p className={styles.lead}>{t("landing.cta.body")}</p>
					<Link href={APP_HREF} className={styles.primary}>
						{t("landing.cta.button")}
						<Icon icon={ArrowRight02Icon} size={18} />
					</Link>
				</section>
			</main>

			<footer className={styles.footer}>
				<span>{t("landing.footer.rights")}</span>
				<span>{t("landing.footer.disclaimer")}</span>
				<Link href={APP_HREF}>{t("landing.footer.app")}</Link>
			</footer>
		</div>
	);
}
