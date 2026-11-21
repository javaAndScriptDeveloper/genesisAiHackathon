# Fitness Companion — Market Evidence & Unit Economics Report

Prepared Nov 21, 2026 from public benchmarks (2025–2026)

## Executive summary

The pain is real and documented, the MVP metric is clear, but at benchmark acquisition costs paid ads will not pay back: base-case LTV is about $52 against a paid CAC of about $126.

- **Pain and segment: confirmed, with gaps.** Most people who start training quit within weeks, and the top stated barriers are time, confidence, cost and not knowing what to do. A human trainer costs $40-70 per hour (roughly $250-400 per month for two sessions a week), against $2.50-13 per month for an app. We found no hard data on "trainers ignore clients", the first pain in the product brief.
- **MVP success metric:** share of new users who complete at least 3 planned workouts in their first 14 days. It is the early form of your North Star (quality-completed planned workouts per active user per week). Category benchmarks are weak: 3-8% day-30 retention, and activation falls from 26% on day 1 to 10% by day 28.
- **Unit economics (base case):** price $9.99 per month or $59.99 per year; net revenue per paying user about $55 over 11 months; LLM cost only $0.22 per paying user per month (4% of net revenue) when plan generation runs on Sonnet 5.5 and everything else on Haiku 5.5.
- **The real risk is CAC, not AI cost.** For a 12-month payback, blended CAC must stay under about $55. That means at least 56% of users must arrive organically (86% for a 3:1 LTV/CAC).
- **Break-even:** about 1,100 active subscribers cover $5,000 of monthly fixed costs; about 3,250 cover $15,000.

All numbers are labelled below as sourced or as our assumption. Section 6 lists what to verify before showing this to investors.

## 1. Pain and segment: what the data confirms

Five of the six pains in the brief are backed by data: quitting, lack of time and confidence, cost of trainers, unseen progress/motivation, and generic plans. The pain "trainers give too little attention" has no direct number in what we found.

### People start, then quit

| Finding | Number | Source |
| --- | --- | --- |
| US adults who signed up to a gym as a resolution and quit before year-end | 11% (up from 7% the year before) | [CouponCabin survey](https://www.couponcabin.com/blog/new-years-fitness-goals-survey/) |
| Americans who said they already gave up their fitness resolutions | 44% of 2,000 surveyed | [Fox News](https://www.foxnews.com/lifestyle/nearly-half-of-americans-have-already-given-up-their-fitness-resolutions) |
| UK exercisers: typical time before they drop off | about 33 days | [OnePoll via Edinburgh News](https://www.edinburghnews.scotsman.com/read-this/brits-ditch-exercising-after-33-days-heres-the-real-reason-why-8934225) |
| Of those, who say more motivation would help most / a clearer routine or plan | 20% / 19% | same OnePoll study |
| People who do not know which healthy habits to build | 67% (brand-commissioned by Freeletics) | [Edge Media / OnePoll](https://edgemedianetwork.com/story/286403) |

### Why they quit: time, confidence, cost

| Barrier | Number | Source |
| --- | --- | --- |
| No time to go any more (UK gym members who quit) | 15% | [Pure Gym via The Manual](https://themanual.com/fitness/new-data-shows-the-top-reasons-why-people-quit-the-gym) |
| Time is the biggest roadblock to consistency | 55% (supplement-brand survey, weak) | [DMoose](https://www.dmoose.com/blogs/news-1/4-reasons-of-not-doing-workout) |
| Intimidated by the thought of the gym | 49% | [Fox News survey](https://www.foxnews.com/lifestyle/nearly-half-of-americans-have-already-given-up-their-fitness-resolutions) |
| Dislike working out in front of others (prefer home) | 33% | same survey |
| Gym membership out of price range | 38% | same survey |

### A human trainer is expensive

| Option | Price | Source |
| --- | --- | --- |
| In-person trainer, per hour (US) | $40-70 | [GoodRx](https://www.goodrx.com/well-being/movement-exercise/how-much-does-a-personal-trainer-cost) |
| Average per session (US) | $60 | [Bark](https://www.bark.com/en/us/personal-trainer/personal-trainer-cost) |
| Two sessions a week, per month | $250-400 | [FitBudd](https://www.fitbudd.com/academy/how-much-do-personal-trainers-cost-a-detailed-breakdown-per-hour-month-and-at-the-gym) |
| Online training, per month | $50-150 | [GoodRx](https://www.goodrx.com/well-being/movement-exercise/how-much-does-a-personal-trainer-cost) |

A fitness app at $2.50-13 per month costs less than one trainer session a month, which is the price gap the product can use.

### Existing apps also lose people

- Health and fitness apps keep 3% of users at day 30 (AppsFlyer) or 8% (Adjust); activation falls from 26% on day 1 to 10% by day 28 ([Business of Apps](https://businessofapps.com/data/health-fitness-app-benchmarks)).
- Across all app categories, retention is 26% at day 1, 13% at day 7 and 7% at day 30 ([Adjust](https://www.adjust.com/blog/what-makes-a-good-retention-rate/)).
- 63% of consumers have used a health, fitness or wearable app, but such apps are often downloaded and quickly dropped ([eMarketer, Jan 2026 survey](https://www.emarketer.com/content/ai-will-power-next-phase-of-health-app-growth)).

### What users complain about in current AI and personalized apps

- **Generic at first:** Fitbod's algorithm feels generic until it learns from enough workouts, and billing through the App Store causes complaints ([Indie Hackers review](https://www.indiehackers.com/post/fitbod-app-review-2026-honest-take-after-real-testing-45d5f07a1b)).
- **Repetitive and blind to the individual:** AI plans are reported as repetitive and miss factors a human trainer would notice ([Rolling Out](https://rollingout.com/2025/06/20/ai-workout-plans-risks)); even a favorable review of the Ray coach notes repetitive coaching language and no form checking ([Tom's Guide](https://www.tomsguide.com/ai/im-a-former-personal-trainer-and-this-ai-fitness-app-is-surprisingly-legit)).
- **Injuries and limits:** ChatGPT used as a trainer lacked set-and-rep structure and injury awareness ([IDEA Health & Fitness](https://www.ideafit.com/dont-let-ai-be-your-only-coach)); Zing Coach has no accommodations for some conditions, and 32% of its 220+ reviews are one star, mostly about hidden fees and misleading ads ([Dr. Muscle](https://dr-muscle.com/zing-coach-ai-workout-app-honest-review-by-expert-2)).

### Segment fit: beginners and amateurs

The MVP focus on beginners fits the data: about half of new January sign-ups on Strava have not trained before ([Deadspin, citing Strava](https://deadspin.com/the-psychology-of-quitting-why-most-people-fail-their-fitness-goals-and-how-not-to/)), and the main barriers (time, confidence, price, not knowing what to do) are exactly what a home-friendly, adaptive plan addresses. Caveat: nearly all of this data is US and UK, much of it from commissioned surveys. We found no data on Ukrainian or CEE users.

## 2. Market size and competitor prices

Analyst firms put the 2025 fitness-app market between $2.9 and $12.3 billion, growing 13-21% a year; the spread is wide, so treat any single figure as indicative.

| Estimate, 2025 | Size | Growth (CAGR) | Source |
| --- | --- | --- | --- |
| Fortune Business Insights | $12.27B | to $38.71B by 2034 | [report page](https://www.fortunebusinessinsights.com/fitness-app-market-116380) |
| Straits Research | $12B | 13% (2026-34) | [MENAFN](https://menafn.com/1111812179/Fitness-App-Market-Size-Share-Growth-Analysis-Report-2034) |
| IMARC Group | $3.5B | 21.4% (2026-34) | [IMARC](https://imarcgroup.com/fitness-app-market) |
| Global Growth Insights | $2.92B | 17.5% (2026-35) | [report page](https://www.globalgrowthinsights.com/market-reports/fitness-app-market-122458) |
| Mordor Intelligence (2026) | $15.35B (digital fitness) | 13% (2026-31) | [Mordor](https://www.mordorintelligence.com/industry-reports/digital-fitness-apps-market) |

Revenue is concentrated: in Health & Fitness the top 10% of apps take 92.6% of subscription revenue ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)). The category also monetizes well: it has the highest 12-month revenue per install of any category, $1.21 (same source), and the only one where annual plans dominate (60.6% of revenue, [Adapty](https://adapty.io/state-of-in-app-subscriptions-2026)).

### Competitor pricing

| Product | Price | Notes | Source |
| --- | --- | --- | --- |
| Fitbod | $12.99 per month; $79.99 per year | 15M+ downloads, 2.5M+ active users, 4.8 App Store rating | [TechRadar](https://www.techradar.com/health-fitness/fitbod-app-review), [Indie Hackers](https://www.indiehackers.com/post/fitbod-app-review-2026-honest-take-after-real-testing-45d5f07a1b) |
| Freeletics Coach | $34.99 per 3 months; $79.99 per year (US store) | 6 subscription options | [App Store](https://apps.apple.com/us/app/id654810212?l=en-us) |
| FitOn PRO | $29.99 per year | free tier plus paid extras | [Under30CEO](https://www.under30ceo.com/ai-fitness-apps/) |
| Typical AI fitness app | $0-15 per month | beginner-oriented apps | [Under30CEO](https://www.under30ceo.com/ai-fitness-apps/) |

Our planned price ($9.99 per month, $59.99 per year) sits below Fitbod and Freeletics and well above FitOn, which is consistent with a "personal trainer" position.

## 3. Key MVP success metric

The MVP should be judged on one metric: the share of new users who complete at least 3 planned workouts within 14 days of onboarding ("activated and adhering"). Our targets of 20% or more at day 7 and 10% or more at day 30 are proposals, set above category medians.

Why this metric: the strongest predictor of day-30 retention is completing a meaningful first action on day 1; apps that nail first-session activation retain at 2-3x the rate of those that do not ([UXCam](https://uxcam.com/blog/mobile-app-retention-benchmarks/)). It also feeds revenue: about 35% of annual cancellations happen in month 1 ([RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)), so users who do not train early are the ones who cancel. It is the early version of your North Star (quality-completed planned workouts per active user per week).

| Metric | Category benchmark | MVP target (our proposal) | Why it matters |
| --- | --- | --- | --- |
| Activated and adhering: 3 planned workouts in 14 days | not published; H&F activation falls from 26% (day 1) to 10% (day 28) | 25% of new users | leading indicator of retention and of paying |
| First workout completed within 24 hours of onboarding | not published | 35% | strongest early predictor of day-30 retention |
| Retention day 7 | 13% all categories (Adjust) | 20% | habit forming |
| Retention day 30 | 3-8% for H&F (AppsFlyer, Adjust) | 10% | gate for scaling paid ads |
| Planned workouts completed per weekly active user | not published | 2.0 per week, with plan adherence 60% or more | your North Star |
| Install to paid | 1.8-3.7% (Adapty) | 3% | feeds CAC and LTV (section 4) |

Guardrails: count a workout as "quality-completed" only if at least 80% of planned sets were done, and count planned recovery days as adherence, so the metric never rewards overtraining. Sources for the benchmarks: [Business of Apps](https://businessofapps.com/data/health-fitness-app-benchmarks), [Adjust](https://www.adjust.com/blog/what-makes-a-good-retention-rate/), [Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/).

Decision rule: scale paid acquisition only after two consecutive weekly cohorts reach day-30 retention of 10% or more and install-to-paid of 3% or more; below that, spend on organic channels only.

## 4. Baseline unit economics

In the base case a paying user is worth about $52 after all costs, and acquiring one through ads costs about $126, so LTV/CAC is 0.41 on paid traffic and 0.82 with half the users organic. The model has three scenarios; inputs are tagged **S** (sourced) or **A** (our assumption).

### Price and revenue per paying user

| Input | Value | Tag | Basis |
| --- | --- | --- | --- |
| Price | $9.99 per month; $59.99 per year | A | between FitOn and Fitbod (section 2) |
| Store fee | 15% | S | [Apple Small Business Program](https://www.revenuecat.com/blog/engineering/small-business-program); [Google Play subscriptions 15%](https://www.revenuecat.com/blog/growth/enroll-app-store-small-business-program/) |
| Net per payment | $8.49 monthly; $50.99 annual | calc | price x 0.85 |
| Share of subscribers on annual plan | 45% / 55% / 60% | A | H&F annual plans are 60.6% of revenue ([Adapty](https://adapty.io/state-of-in-app-subscriptions-2026)) |
| Annual renewal rate | 23% / 30% / 36% | S | median retention 23% high-priced vs 36% low-priced apps ([RevenueCat via 9to5Mac](https://9to5mac.com/2026/03/04/new-report-looks-into-the-sustainability-of-the-subscription-app-market-for-2026/)); AI apps 21% vs 31% non-AI ([DEV, citing RevenueCat](https://dev.to/zaraai_0b75675ddc9204c716/ai-apps-generate-41-more-revenue-per-user-but-lose-79-of-annual-subscribers-before-month-13-485a)) |
| Paid months per monthly subscriber | 3 / 4 / 5 | A | anchored to the all-category renewal curve 59% / 45% / 37% / 32% / 28% ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)) |
| Install to paid | 1.8% / 3.0% / 4.5% | S | 1.78% onboarding paywall; 9.5% install-to-trial x 35% trial-to-paid in H&F ([Adapty](https://adapty.io/state-of-in-app-subscriptions-2026)) |
| Cost per install (CPI) | $4.70 / $3.77 / $3.00 | S, A | $4.70 iOS average ([Adapty](https://adapty.io/blog/customer-acquisition-cost/)); $3.77 H&F median ([AppTweak](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks?coupon=BL)); $3.00 is our assumption |
| Share of users arriving organically | 50% in all scenarios | A | TikTok, ASO, referrals |

### Cost per user, including the model

LLM prices (per million tokens, input / output): Claude Sonnet 5.5 $2 / $10 ([pricing summary](https://www.eesel.ai/blog/claude-sonnet-5-5-pricing)); Claude Haiku 5.5 $0.10 / $0.50 for prompts up to 100K tokens ([Kanaries](https://docs.kanaries.net/articles/haiku-pricing), [Anthropic via VKTR](https://www.vktr.com/ai-platforms/anthropic-cuts-smallmodel-pricing-90-with-claude-haiku-55/)).

Usage assumption per paying user per month (**A**, deliberately generous, no caching or batch discount applied): weekly plan generation 4 calls of 6K in / 2K out and weekly report 4 calls of 5K in / 0.8K out (both on Sonnet); coach chat 12 calls of 4K in / 0.4K out, in-workout adaptation 16 calls of 3K in / 0.3K out, notification copy 30 calls of 1K in / 0.1K out (all on Haiku). Total: 170K input and 24K output tokens.

| Routing | LLM cost per paying user per month | Share of net revenue (about $4.93 per month) |
| --- | --- | --- |
| All Haiku 5.5 | $0.03 | 0.6% |
| **Hybrid: plans and reports on Sonnet, rest on Haiku (base)** | **$0.22** | **4.4%** |
| All Sonnet 5.5 | $0.58 | 11.7% |
| Hybrid at 3x usage (heavy user) | $0.66 | 13.3% |

A free user costs about $0.03 once (onboarding plan on Sonnet) plus $0.003 per month on Haiku. Not included: voice input and speech output, and extended-thinking tokens, which would raise output cost. Infrastructure and analytics are assumed at $0.10 per paying user per month (**A**).

### Scenarios

| Metric (per paying user) | Conservative | Base | Optimistic |
| --- | --- | --- | --- |
| Months paid (average) | 8.7 | 11.2 | 13.3 |
| Net revenue over lifetime | $43.8 | $55.3 | $64.8 |
| LLM plus infrastructure | $5.1 | $3.6 | $4.0 |
| **LTV (after all costs)** | **$38.7** | **$51.8** | **$60.8** |
| CAC if all users paid | $261 | $126 | $67 |
| CAC with 50% organic | $131 | $63 | $33 |
| LTV / CAC, paid only | 0.15 | 0.41 | 0.91 |
| LTV / CAC, 50% organic | 0.30 | 0.82 | 1.83 |
| Payback, 50% organic (months) | 29 | 14 | 7 |
| Revenue per install (LTV x install-to-paid) | $0.70 | $1.55 | $2.74 |

Sanity check: the base revenue per install of $1.55 is close to the $1.21 H&F median ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)) and the $0.63 at 60 days ([RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025?category=x)), so the model is not inflated.

### Break-even

Base case, contribution per paying user is $4.61 per month. Fixed monthly costs (team, tools, video, design) are not known to us, so two cases are shown (**A**).

|  | Fixed costs $5,000 per month | Fixed costs $15,000 per month |
| --- | --- | --- |
| Active paying subscribers to break even | 1,084 | 3,253 |
| New subscribers needed per month to hold that base | 97 | 290 |
| Installs per month needed (at 3% install-to-paid) | 3,219 | 9,658 |
| Ad spend per month if all installs were paid | $12,137 | $36,412 |
| Ad spend per month if 50% organic | $6,069 | $18,206 |

What has to be true: for a 12-month payback, blended CAC must be under $55, so at least 56% of users must be organic. For a 3:1 LTV/CAC (CAC under $17) at least 86% must be organic; with paid-only traffic, install-to-paid would need to reach 22%, which no benchmark supports.

## 5. Risks and recommendations

The plan works only if the product earns most of its users organically and keeps them past the first month; model cost is the smallest of the risks.

1. **Go organic first.** Paid ads at benchmark CPI cannot reach a 12-month payback unless install-to-paid roughly doubles. Use TikTok and build-in-public content, app-store search, and referrals, and hold paid spend until the gate in section 3 is met.
2. **Reconsider pure freemium.** Hard paywalls convert 10.7% of trials at day 35 versus 2.1% for freemium, while one-year retention is about the same (27% vs 28%) ([RevenueCat](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)). A free onboarding plan preview followed by a trial paywall fits the Today-screen value better than a long free tier.
3. **Lead with the annual plan.** Annual plans carry most H&F revenue, and annual subscribers who renew stay; but about 35% of annual cancellations come in month 1, so the first two weeks of onboarding and reminders decide LTV.
4. **Watch price carefully.** Two sources point opposite ways: lower-priced apps keep more subscribers (36% vs 23%), while high-priced annual plans reach a one-year LTV of $70 against $17 for low-priced ones ([Adapty](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/)). Test $59.99 against $79.99 per year in the first cohorts.
5. **Control AI cost, but do not over-optimize it.** Route plan generation and weekly reports to Sonnet and everything else to Haiku; cache the user profile; cap tokens per user; track "AI cost per active user" in Amplitude. Voice features are not priced here and should be modeled before launch.
6. **Do not sell it as AI.** Subscriptions to AI apps renew less (21% vs 31% for annual plans, per a secondary summary of RevenueCat), which supports the "personal trainer" positioning in the brief.
7. **Trust and safety.** Complaints about existing apps cluster around generic plans, ignored injuries and hidden fees. Show prices clearly, keep the stop-on-pain rule from the brief, and avoid showing blood pressure without a compatible device.
8. **Close the evidence gaps.** Run a 30-50 user pilot (onboarding to first workout) and a landing-page waitlist test; interview users in Ukraine and Central Europe, where we found no data and where CPI and prices are likely lower.

## 6. Assumptions, limits and sources

Treat the figures as planning ranges, not as audited facts: most come from search results read as snippets, and only the Adapty H&F benchmark page was opened in full (RevenueCat's own report page could not be fetched).

**Our assumptions (tagged A in section 4):** price points; plan mix; paid months for monthly plans; 50% organic share; CPI of $3.00 in the optimistic case; LLM usage per user; infrastructure cost of $0.10 per paying user per month; fixed costs of $5,000 and $15,000 per month. Please replace the fixed costs with your real team and tooling budget.

**Known limits:**

- Many consumer surveys are brand-commissioned or undated; the Strava figure is secondhand; the "71% abandon fitness apps by month 3" claim circulates widely but we could trace it only to older blog posts, so it is not used in the numbers.
- Benchmarks mix categories and plan types (the Adapty renewal curve is all-category); H&F-specific renewal and refund rates were not published in what we could read.
- Market-size reports disagree by about 4x.
- Model prices were verified for October 2026; they change often. Haiku 5.5 is cheaper only for prompts up to 100K tokens.
- Excluded: taxes and VAT, refunds, chargebacks, payment-provider fees outside the stores, voice features, Garmin integration costs, team salaries.
- Almost all data is US or UK; nothing specific to Ukraine or CEE.

**Main sources:** [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026) · [Adapty H&F benchmarks](https://adapty.io/blog/health-fitness-app-subscription-benchmarks/) · [Adapty State of in-app subscriptions 2026](https://adapty.io/state-of-in-app-subscriptions-2026) · [Business of Apps H&F benchmarks](https://businessofapps.com/data/health-fitness-app-benchmarks) · [Adjust retention](https://www.adjust.com/blog/what-makes-a-good-retention-rate/) · [AppTweak Apple Ads benchmarks](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks?coupon=BL) · [Adapty CAC benchmarks](https://adapty.io/blog/customer-acquisition-cost/) · [GoodRx trainer costs](https://www.goodrx.com/well-being/movement-exercise/how-much-does-a-personal-trainer-cost) · [Claude Sonnet 5.5 pricing](https://www.eesel.ai/blog/claude-sonnet-5-5-pricing) · [Claude Haiku 5.5 pricing](https://docs.kanaries.net/articles/haiku-pricing) · [App store fees](https://www.revenuecat.com/blog/engineering/small-business-program). The other links sit next to the figures they support.
