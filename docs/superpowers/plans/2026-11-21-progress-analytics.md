# Модуль аналітики прогресу — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вкладка `/progress` у frontend, яка на мок-даних 8 тижнів показує регулярність, тижневу ціль, серію, XP, інсайти, рекорди, календар, підсумки, досягнення, вагу тіла, demo-дані пристрою, а також екрани вправи, тижневого звіту й досягнень.

**Architecture:** Чисті функції розрахунку в `frontend/lib/progress/` (без React і fetch) рахують усе з «сирої» історії. Мок-бекенд (`app/api/mock/[...path]`) генерує детерміновану історію демо-користувача, проганяє її через ці функції і віддає готові зведення. UI — клієнтські секції з `useQuery` через `api.*` і zod-схеми, тож пізніше ті самі ендпоінти реалізує platform-backend.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`), zod 4, @tanstack/react-query 5, SCSS Modules, Vitest, bun.

**Spec:** `docs/superpowers/specs/2026-11-21-progress-analytics-design.md` (читати разом з цим планом). Також `frontend/AGENTS.md` і `frontend/docs/agent/*.md`.

## Global Constraints

- Усі шляхи нижче відносно `frontend/`. Команди запускати з `frontend/`.
- Пакетний менеджер **bun**. Нових залежностей не додавати (графік — власний SVG).
- Без `any`, `@ts-ignore`, небезпечних `as`. Зовнішні дані (відповіді API) — тільки через zod.
- Дати — рядки `YYYY-MM-DD`. Тиждень починається з **понеділка**. День тижня рахувати через `getUTCDay()` від `new Date(date + "T00:00:00Z")`, ніколи через локальний час.
- Якісне тренування: `planned && status === "completed" && sets.length / setsPlanned >= 0.7`.
- Ваги Consistency Score: `0.4, 0.3, 0.2, 0.1` (від найсвіжішого повного тижня).
- XP: 100 за якісне тренування + 10 за кожен рекорд у ньому; 20 за дотриманий день відпочинку; не більше одного нагородженого тренування на день. Рівень `n` досягається при сумарних XP `≥ 100 × (n−1) × n / 2` (рівень 1 = 0, 2 = 100, 3 = 300, 4 = 600, 5 = 1000).
- 1RM за Epley `weight × (1 + reps / 30)`, лише коли `reps <= 10`. Округлення до 0.5 кг.
- Весь текст інтерфейсу — українською в `messages/uk.json` під ключем `progress.*`. Слово «AI» в UI не вживати. Демо-показники пристрою завжди з позначкою «demo».
- Тексти без тиску й докорів (анти-цілі спеки, розділ 2).
- Стилі: SCSS Module поруч з компонентом, rem, токени `--color-*`/`--space-*`, радіуси тільки через `corners.radius`/`corners.nested`. Іконки тільки Hugeicons через `Icon`.
- Кожен екран з даними має скелетон, порожній стан і стан помилки з кнопкою «Спробувати ще».
- Ширина контенту `/progress` — до `48rem`, по центру (мобільна рамка; app shell зробиться окремо).
- Git: працювати в гілці `feature/progress-analytics`. Додавати файли явно за шляхами. `messages/uk.json` і `app/competitors`, `components/sections/CompetitorAnalysis` уже мають незакомічені зміни користувача — **не комітити `uk.json`, доки користувач не скаже, що робити з його змінами**.

## Review Focus

1. **Новий користувач без історії** — кожен ендпоінт повертає валідну форму, Consistency `null` (не 0 і не NaN), UI показує порожній стан, а не падає. Тести: Task 2, Task 7.
2. **Межі тижня і часовий пояс** — неділя належить тижню, що почався в понеділок перед нею; результат не залежить від TZ машини. Тест: Task 1.
3. **Невірні параметри URL** — неіснуюча вправа, кривий `week` або `month` → 404/400 з JSON, без 500. Тест: Task 7.
4. **Людина тренується лише з власною вагою** — без `NaN`/`null` у рекордах, графіках і інсайтах; 1RM не рахується при `reps > 10`. Тест: Task 3.
5. **Тренування понад план / два за день** — додаткових XP немає, день відпочинку з тренуванням не вважається дотриманим. Тест: Task 4.

---

## File Structure

```
lib/progress/
  types.ts          доменні типи історії (вхід для всіх функцій)
  dates.ts          дати: weekStart, addDays, weekday, daysBetween, eachDay
  days.ts           isQualitySession, dayStatus
  consistency.ts    consistencyScore, weeklyGoal, streakWeeks
  records.ts        estimate1RM, exerciseSeries, personalRecords
  xp.ts             xpAndLevel
  summary.ts        periodSummary
  achievements.ts   achievements
  insights.ts       insights
  index.ts          реекспорт
lib/messages.ts     + tf(key, vars) для підстановок
lib/api/
  progressTypes.ts  zod-схеми відповідей /progress/*
  index.ts          + api.progress*
  mock/progressDb.ts        детермінований генератор демо-історії
  mock/progressHandlers.ts  зведення для кожного ендпоінта
app/api/mock/[...path]/route.ts   + маршрути progress
components/ui/LineChart/          SVG-графік (+ приклад у UiKitShowcase)
components/sections/Progress/     секції й блоки (по папці на компонент)
app/progress/page.tsx              головний екран (календар — блок на ньому)
app/progress/exercises/[id]/page.tsx
app/progress/reports/[week]/page.tsx
app/progress/achievements/page.tsx
tests/progress-*.test.ts
```

---

### Task 1: Доменні типи, дати, статус дня

**Files:**
- Create: `lib/progress/types.ts`, `lib/progress/dates.ts`, `lib/progress/days.ts`, `lib/progress/index.ts`
- Test: `tests/progress-days.test.ts`

**Interfaces:**
- Produces (`types.ts`):
```ts
export type IsoDate = string; // YYYY-MM-DD
export type ExerciseKind = "weighted" | "bodyweight" | "timed";
export interface Exercise { id: string; name: string; kind: ExerciseKind }
export interface SetLog { exerciseId: string; reps: number; weightKg: number | null; durationSec: number | null }
export interface PlannedDay { date: IsoDate; type: "workout" | "rest" }
export type Rpe = "easy" | "ok" | "hard";
export interface WorkoutSession {
	id: string; date: IsoDate; planned: boolean; status: "completed" | "abandoned";
	adapted: boolean; durationMin: number; setsPlanned: number; sets: SetLog[]; rpe: Rpe | null;
}
export interface BodyMeasurement { date: IsoDate; weightKg: number }
export interface DeviceDemo { avgWorkoutHeartRate: number; avgDailySteps: number; avgSleepHours: number }
export interface History {
	today: IsoDate; exercises: Exercise[]; plan: PlannedDay[]; sessions: WorkoutSession[];
	body: BodyMeasurement[]; device: DeviceDemo | null;
}
export type DayStatus = "completed" | "adapted" | "missed" | "rest" | "planned" | "none";
```
- Produces (`dates.ts`): `weekStart(d: IsoDate): IsoDate`, `addDays(d: IsoDate, n: number): IsoDate`, `weekday(d: IsoDate): number` (0 = понеділок … 6 = неділя), `daysBetween(a: IsoDate, b: IsoDate): number` (b − a), `eachDay(from: IsoDate, to: IsoDate): IsoDate[]` (включно).
- Produces (`days.ts`): `isQualitySession(s: WorkoutSession): boolean`, `dayStatus(h: History, date: IsoDate): DayStatus`.

`dayStatus` правила: нема запису плану → `"none"`; workout-день з якісним плановим тренуванням → `"adapted"` якщо `adapted`, інакше `"completed"`; workout-день без якісного тренування: `date < today` → `"missed"`, інакше `"planned"`; rest-день → `"rest"`.

- [ ] **Step 0: Гілка**

Run: `git switch -c feature/progress-analytics`

- [ ] **Step 1: Написати тести**

```ts
describe("dates", () => {
	it("weekStart: неділя належить тижню з понеділка перед нею", () => {
		expect(weekStart("2026-11-22")).toBe("2026-11-16");
		expect(weekStart("2026-11-16")).toBe("2026-11-16");
	});
	it("не залежить від часового поясу", () => {
		process.env.TZ = "America/Los_Angeles";
		expect(weekday("2026-11-16")).toBe(0);
		process.env.TZ = "Pacific/Kiritimati";
		expect(weekday("2026-11-22")).toBe(6);
	});
	it("addDays переходить через місяць", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
	it("eachDay включно", () => expect(eachDay("2026-11-16", "2026-11-18")).toEqual(["2026-11-16", "2026-11-17", "2026-11-18"]));
});
describe("isQualitySession", () => {
	it("70% підходів — якісне", () => expect(isQualitySession(session({ setsPlanned: 10, sets: 7 }))).toBe(true));
	it("69% — ні", () => expect(isQualitySession(session({ setsPlanned: 13, sets: 9 }))).toBe(false));
	it("незаплановане або покинуте — ні", () => {
		expect(isQualitySession(session({ planned: false }))).toBe(false);
		expect(isQualitySession(session({ status: "abandoned" }))).toBe(false);
	});
});
describe("dayStatus", () => {
	// history: today = 2026-11-19; plan пн/ср/пт workout, решта rest
	it("completed / adapted / missed / planned / rest / none", () => {
		expect(dayStatus(h, "2026-11-16")).toBe("completed");
		expect(dayStatus(h, "2026-11-11")).toBe("adapted");
		expect(dayStatus(h, "2026-11-13")).toBe("missed");
		expect(dayStatus(h, "2026-11-20")).toBe("planned");
		expect(dayStatus(h, "2026-11-17")).toBe("rest");
		expect(dayStatus(h, "2025-01-01")).toBe("none");
	});
});
```
`session(overrides)` і `h` — локальні фабрики в тесті (sets: N → N однакових `SetLog`).

- [ ] **Step 2:** `bun run test tests/progress-days.test.ts` → FAIL (модулів нема).
- [ ] **Step 3:** Реалізувати `types.ts`, `dates.ts`, `days.ts`, `index.ts` (реекспорт усіх модулів `lib/progress`).
- [ ] **Step 4:** `bun run test tests/progress-days.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add lib/progress tests/progress-days.test.ts && git commit -m "feat(progress): domain types, dates, day status"`

---

### Task 2: Регулярність, тижнева ціль, серія

**Files:**
- Create: `lib/progress/consistency.ts`
- Test: `tests/progress-consistency.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
```ts
export interface Consistency { score: number | null; delta: number | null; fullWeeks: number }
export function consistencyScore(h: History): Consistency;
export interface WeekGoalDay { date: IsoDate; type: "workout" | "rest"; status: DayStatus }
export interface WeekGoal { weekStart: IsoDate; days: WeekGoalDay[]; done: number; planned: number }
export function weeklyGoal(h: History, weekStartDate?: IsoDate): WeekGoal; // default: тиждень today
export function streakWeeks(h: History): number;
export function isRestKept(h: History, date: IsoDate): boolean;
```

Правила:
- `isRestKept`: rest-день, `date <= today`, і в цей день нема жодної сесії (ні планової, ні позапланової).
- Коефіцієнт тижня = (якісні планові тренування тижня + дотримані дні відпочинку) / кількість записів плану в тижні. Тиждень без записів плану не враховується.
- `consistencyScore`: беруться повні тижні **до** поточного (максимум 4, від найсвіжішого). Ваги 0.4/0.3/0.2/0.1; якщо тижнів < 4, ваги наявних тижнів нормуються до суми 1. `score = round(100 × Σ)`; 0 тижнів → `null`. `delta = score − score(тієї ж історії з today − 7 днів)`, `null` якщо будь-яке з двох `null`. `fullWeeks` — скільки тижнів увійшло.
- `weeklyGoal.done` — кількість днів зі статусом `completed`/`adapted`; `planned` — кількість workout-днів.
- `streakWeeks`: рахувати повні тижні назад від останнього повного, поки в тижні всі workout-дні `completed`/`adapted` (тиждень без плану — зупинка). Якщо поточний тиждень уже має всі workout-дні виконаними — +1; незавершений поточний тиждень серію не обриває.

- [ ] **Step 1: Тести**

```ts
it("порожня історія: score null, delta null, streak 0", () => {
	const empty = { ...base, plan: [], sessions: [] };
	expect(consistencyScore(empty)).toEqual({ score: null, delta: null, fullWeeks: 0 });
	expect(streakWeeks(empty)).toBe(0);
});
it("4 ідеальні тижні = 100", () => expect(consistencyScore(perfect4).score).toBe(100));
it("ваги свіжий тиждень важливіший", () => {
	// найсвіжіший тиждень 4/7 (пропущено 3 тренування), три старші 7/7
	expect(consistencyScore(lastWeekBad).score).toBe(Math.round(100 * (0.4 * 4 / 7 + 0.6)));
});
it("один повний тиждень — нормування ваг", () => expect(consistencyScore(oneWeek6of7).score).toBe(86));
it("delta = зміна відносно минулого тижня", () => expect(consistencyScore(improving).delta).toBeGreaterThan(0));
it("тренування в день відпочинку — відпочинок не дотриманий", () => expect(isRestKept(withExtra, "2026-11-17")).toBe(false));
it("weeklyGoal поточного тижня", () => {
	const g = weeklyGoal(h); // today чт 2026-11-19, пн і ср виконані
	expect(g).toMatchObject({ weekStart: "2026-11-16", done: 2, planned: 3 });
	expect(g.days).toHaveLength(7);
});
it("streak: незавершений тиждень не обриває, пропуск обриває", () => {
	expect(streakWeeks(threeFullThenCurrentPartial)).toBe(3);
	expect(streakWeeks(missInLastFullWeek)).toBe(0);
});
```
- [ ] **Step 2:** запустити → FAIL.
- [ ] **Step 3:** реалізувати `consistency.ts`, додати в `index.ts`.
- [ ] **Step 4:** запустити → PASS.
- [ ] **Step 5:** commit `feat(progress): consistency score, weekly goal, streak`.

---

### Task 3: Рекорди, 1RM, ряд показника вправи

**Files:**
- Create: `lib/progress/records.ts`
- Test: `tests/progress-records.test.ts`

**Interfaces:**
- Produces:
```ts
export type RecordMetric = "weight" | "e1rm" | "reps" | "time";
export interface PersonalRecord { exerciseId: string; metric: RecordMetric; value: number; previous: number; date: IsoDate; sessionId: string }
export function estimate1RM(weightKg: number, reps: number): number | null; // null якщо reps > 10 або reps < 1
export interface SeriesPoint { date: IsoDate; value: number }
export function exerciseSeries(h: History, exerciseId: string): SeriesPoint[];
export function personalRecords(h: History): PersonalRecord[]; // хронологічно
export function mainMetric(kind: ExerciseKind): RecordMetric; // weighted→e1rm, bodyweight→reps, timed→time
```

Правила:
- Враховуються тільки сесії зі `status === "completed"`.
- `exerciseSeries`: одна точка на сесію з цією вправою, значення — найкраще за сесію: weighted → max 1RM серед підходів з `reps ≤ 10` (якщо таких нема — max вага), bodyweight → max reps, timed → max `durationSec`. Підходи з `null` у потрібному полі ігноруються.
- `personalRecords`: метрики для weighted — `weight` і `e1rm`, bodyweight — `reps`, timed — `time`. Перша сесія з вправою задає базу і **не** є рекордом. Рекорд — значення за сесію строго більше за попередній максимум.

- [ ] **Step 1: Тести**

```ts
it("Epley з округленням до 0.5", () => {
	expect(estimate1RM(20, 8)).toBe(25.5); // 20 × 1.2667 = 25.33 → 25.5
	expect(estimate1RM(20, 12)).toBeNull();
});
it("перша сесія — база, не рекорд", () => expect(personalRecords(oneSession)).toEqual([]));
it("ріст повторів у віджиманнях — рекорд reps", () => {
	expect(personalRecords(pushups8then12)).toEqual([
		expect.objectContaining({ exerciseId: "pushup", metric: "reps", value: 12, previous: 8 }),
	]);
});
it("тільки власна вага: без NaN і null у ряді", () => {
	const s = exerciseSeries(bodyweightOnly, "pushup");
	expect(s.every((p) => Number.isFinite(p.value))).toBe(true);
});
it("weighted з усіма підходами > 10 повторів — ряд за вагою", () => {
	expect(exerciseSeries(highReps, "goblet_squat").map((p) => p.value)).toEqual([16, 18]);
});
it("покинуті сесії не дають рекордів", () => expect(personalRecords(abandonedBetter)).toEqual([]));
```
- [ ] **Step 2–4:** FAIL → реалізувати → PASS.
- [ ] **Step 5:** commit `feat(progress): personal records and exercise series`.

---

### Task 4: XP і рівень, підсумок періоду, досягнення

**Files:**
- Create: `lib/progress/xp.ts`, `lib/progress/summary.ts`, `lib/progress/achievements.ts`
- Test: `tests/progress-xp.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`isQualitySession`, `isRestKept`, `personalRecords`, `streakWeeks`).
- Produces:
```ts
export interface XpLevel { xp: number; level: number; levelStartXp: number; nextLevelXp: number }
export function xpAndLevel(h: History): XpLevel;
export interface PeriodSummary { workouts: number; missed: number; minutes: number; sets: number; adherencePct: number | null }
export function periodSummary(h: History, from: IsoDate, to: IsoDate): PeriodSummary; // to обрізається до today
export type AchievementId = "first_workout" | "workouts_5" | "workouts_10" | "workouts_25" | "workouts_50"
	| "first_plan_week" | "streak_2" | "streak_4" | "streak_8" | "first_pr" | "prs_5" | "hours_10" | "rest_4_weeks";
export interface Achievement { id: AchievementId; current: number; target: number; unlocked: boolean }
export function achievements(h: History): Achievement[]; // у порядку AchievementId вище
export function nearestAchievements(list: Achievement[], n: number): Achievement[]; // не відкриті, за current/target спадно
```
- `periodSummary`: `workouts` — якісні планові; `missed` — дні `missed`; `minutes`, `sets` — з усіх completed-сесій; `adherencePct = round(100 × (якісні + дотримані відпочинки) / записи плану)`, `null` якщо записів нема.
- Досягнення: target = 1/5/10/25/50 якісних тренувань; `first_plan_week` — 1 повний тиждень з усіма workout-днями виконаними; `streak_*` — `streakWeeks` ≥ 2/4/8 (current = streak, тож це «поточна» серія; максимум історичної серії — не робимо); `first_pr`/`prs_5` — кількість рекордів; `hours_10` — сумарні хвилини, target 600; `rest_4_weeks` — повні тижні поспіль (від останнього), де всі rest-дні дотримані, target 4. `current` обмежується `target`.

- [ ] **Step 1: Тести**

```ts
it("рівні: 0→1, 100→2, 299→2, 300→3, 1000→5", () => {
	expect([0, 100, 299, 300, 1000].map((x) => levelFor(x))).toEqual([1, 2, 2, 3, 5]);
});
it("XP: 2 якісні тренування, 1 рекорд, 3 дотримані відпочинки = 270", () => expect(xpAndLevel(h).xp).toBe(270));
it("два тренування за день — XP лише за одне", () => expect(xpAndLevel(twoSameDay).xp).toBe(100));
it("позапланове тренування в день відпочинку не дає 20 XP за відпочинок", () => expect(xpAndLevel(extraOnRest).xp).toBe(xpWithout20));
it("periodSummary порожнього періоду", () => expect(periodSummary(empty, "2026-11-16", "2026-11-22")).toEqual({ workouts: 0, missed: 0, minutes: 0, sets: 0, adherencePct: null }));
it("досягнення: current не більше target, nearest без відкритих", () => {
	const list = achievements(h);
	expect(list.every((a) => a.current <= a.target)).toBe(true);
	expect(nearestAchievements(list, 3).every((a) => !a.unlocked)).toBe(true);
});
```
`levelFor(xp: number): number` — експортувати з `xp.ts` для тесту.
- [ ] **Step 2–4:** FAIL → реалізувати → PASS.
- [ ] **Step 5:** commit `feat(progress): xp levels, period summary, achievements`.

---

### Task 5: Інсайти і підстановки в тексті

**Files:**
- Create: `lib/progress/insights.ts`
- Modify: `lib/messages.ts` (додати `tf`)
- Test: `tests/progress-insights.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
```ts
export type InsightId = "too_hard" | "weekday_misses" | "strength_gain" | "consistency_up";
export interface Insight { id: InsightId; vars: Record<string, string | number> }
export function insights(h: History, limit?: number): Insight[]; // default limit 2, за пріоритетом
export function exerciseInsight(h: History, exerciseId: string): Insight | null; // strength_gain для однієї вправи
// lib/messages.ts
export function tf(key: string, vars: Record<string, string | number>): string; // замінює {name} у t(key)
```
Правила (пріоритет зверху вниз):
1. `too_hard` — останні 3 сесії з `rpe !== null` усі `"hard"`. vars: `{}`.
2. `weekday_misses` — за останні 56 днів ≥ 2 пропуски в один і той самий день тижня. vars: `{ weekday: 0..6 }` (номер; назву UI бере з `progress.weekdays.<n>`). Якщо таких днів кілька — з найбільшою кількістю.
3. `strength_gain` — серед вправ найбільший відносний приріст `exerciseSeries` між першою точкою у вікні останніх 28 днів і останньою точкою; лише якщо приріст > 0 і точок у вікні ≥ 2. vars: `{ exerciseId, exercise (name), from, to, weeks }` (`weeks = round(days / 7)`, мінімум 1).
4. `consistency_up` — `consistencyScore(h).delta > 0`. vars: `{ delta }`.

- [ ] **Step 1: Тести**

```ts
it("tf підставляє змінні", () => expect(tf("progress.test.template", { n: 3 })).toBe("Разом 3"));
// (ключ progress.test.template — тестовий; див. примітку нижче)
it("пріоритет і ліміт 2", () => expect(insights(allRulesFire).map((i) => i.id)).toEqual(["too_hard", "weekday_misses"]));
it("два пропуски в п'ятницю", () => expect(insights(fridayMisses)).toContainEqual({ id: "weekday_misses", vars: { weekday: 4 } }));
it("strength_gain: віджимання 8 → 12", () => {
	expect(insights(pushupsGrow)).toContainEqual(expect.objectContaining({ id: "strength_gain", vars: expect.objectContaining({ exerciseId: "pushup", from: 8, to: 12 }) }));
});
it("порожня історія — без інсайтів", () => expect(insights(empty)).toEqual([]));
```
Примітка: щоб не чіпати `uk.json` у цій задачі, тестувати `tf` через `vi.mock("@/messages/uk.json", ...)` або винести підстановку в чисту `interpolate(template, vars)` і тестувати її; `tf = (k, v) => interpolate(t(k), v)`. Обрати друге.
- [ ] **Step 2–4:** FAIL → реалізувати → PASS.
- [ ] **Step 5:** commit `feat(progress): rule-based insights, message interpolation`.

---

### Task 6: Генератор демо-історії

**Files:**
- Create: `lib/api/mock/progressDb.ts`
- Test: `tests/progress-mock.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5 (для перевірок у тестах).
- Produces: `export function demoHistory(): History;` `export function emptyHistory(): History;` (той самий `today`, `exercises`, `plan`, без сесій, без ваги, `device: null`).

Вимоги до даних (спека, розділ 5):
- `today = "2026-11-19"` (четвер). Історія з понеділка `2026-09-28`, 8 тижнів + план на наступний тиждень до `2026-11-29`.
- План: пн/ср/пт — workout, інші — rest.
- Вправи (вдома з гантелями): `pushup` «Віджимання» (bodyweight), `goblet_squat` «Присідання з гантеллю» (weighted), `db_row` «Тяга гантелі в нахилі» (weighted), `lunge` «Випади з гантелями» (weighted), `glute_bridge` «Сідничний міст» (bodyweight), `plank` «Планка» (timed), `db_press` «Жим гантелей сидячи» (weighted).
- Детермінований PRNG (mulberry32 з фіксованим seed), без `Math.random` і `Date.now`.
- Пропуски: `2026-10-07` (ср), `2026-10-16` (пт), `2026-10-23` (пт). Адаптовані тренування: 2 (якісні). Три `rpe: "hard"` поспіль у жовтні, потім нормальні. Тренування 30 ± 5 хв, 12 запланованих підходів.
- Прогресія з шумом: віджимання 8 → 12 повторів, присідання 12 → 16 кг тощо. Вага тіла щопонеділка 72.0 → 70.5.
- `device`: `{ avgWorkoutHeartRate: 128, avgDailySteps: 7400, avgSleepHours: 7.1 }`.

- [ ] **Step 1: Тести (фіксують демо-сценарій)**

```ts
const h = demoHistory();
it("детермінований", () => expect(demoHistory()).toEqual(h));
it("3 пропуски, серія 3 тижні, тиждень 2 з 3", () => {
	expect(periodSummary(h, "2026-09-28", h.today).missed).toBe(3);
	expect(streakWeeks(h)).toBe(3);
	expect(weeklyGoal(h)).toMatchObject({ done: 2, planned: 3 });
});
it("6–8 рекордів", () => { const n = personalRecords(h).length; expect(n).toBeGreaterThanOrEqual(6); expect(n).toBeLessThanOrEqual(8); });
it("інсайти для демо: п'ятниці й ріст сили, без too_hard", () => {
	const ids = insights(h).map((i) => i.id);
	expect(ids).toEqual(["weekday_misses", "strength_gain"]);
});
it("consistency в діапазоні 60–95 і зростає", () => {
	const c = consistencyScore(h); expect(c.score).toBeGreaterThanOrEqual(60); expect(c.score).toBeLessThanOrEqual(95); expect(c.delta).toBeGreaterThan(0);
});
it("emptyHistory без сесій", () => expect(emptyHistory().sessions).toEqual([]));
```
- [ ] **Step 2–4:** FAIL → реалізувати (підбирати дані, поки тести не пройдуть) → PASS.
- [ ] **Step 5:** commit `feat(progress): deterministic demo history`.

---

### Task 7: API-контракт, мок-обробники, маршрути

**Files:**
- Create: `lib/api/progressTypes.ts`, `lib/api/mock/progressHandlers.ts`
- Modify: `lib/api/index.ts`, `app/api/mock/[...path]/route.ts`
- Test: `tests/progress-api.test.ts`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces (zod-схеми і типи `z.infer`, імена саме такі):
  - `progressSummarySchema` → `ProgressSummary`:
    `{ today, consistency: {score|null, delta|null, fullWeeks}, week: WeekGoal, streakWeeks, xp: XpLevel, insights: Insight[], records: { recent: PersonalRecord[] (останні 5, нові першими), newThisWeek: number }, totals: { week, month, all: PeriodSummary }, achievements: { unlocked, total, nearest: Achievement[] (3) }, body: BodyMeasurement[], device: DeviceDemo | null, exercises: Exercise[], reports: IsoDate[] (weekStart повних тижнів, нові першими) }`
  - `progressCalendarSchema` → `{ month: "YYYY-MM", days: { date, status: DayStatus }[] }`
  - `exerciseProgressSchema` → `{ exercise: Exercise, metric: RecordMetric, series: SeriesPoint[], best: SeriesPoint | null, records: PersonalRecord[], sessions: { date, sets: SetLog[] }[] (нові першими), insight: Insight | null }`
  - `weeklyReportSchema` → `{ weekStart, summary: PeriodSummary, previous: PeriodSummary, records: PersonalRecord[], insight: Insight | null, nextWeek: WeekGoalDay[] }`
  - `achievementsResponseSchema` → `{ items: Achievement[] }`
  - Мок-обробники (приймають `History`, щоб тестувати з порожньою): `progressSummary(h)`, `progressCalendar(h, month)`, `exerciseProgress(h, id)` (`null` якщо вправи нема), `weeklyReport(h, weekStart)` (`null` якщо тиждень не повний або поза історією), `achievementsList(h)`.
  - `api.progressSummary(debug?)`, `api.progressCalendar(month: string, debug?)`, `api.exerciseProgress(id: string, debug?)`, `api.weeklyReport(weekStart: string, debug?)`, `api.achievements(debug?)`, де `debug?: MockDebug = { delay?: number; fail?: boolean; empty?: boolean }` додається до URL як `?delay=&fail=1&empty=1` (для ручної перевірки станів; у справжньому бекенді ігнорується).
- Маршрути: `GET /api/mock/progress/summary`, `/progress/calendar?month=YYYY-MM`, `/progress/exercises/:id`, `/progress/reports/weekly/:weekStart`, `/progress/achievements`. Параметр `?empty=1` на будь-якому — дані з `emptyHistory()`. `month` або `weekStart` не за форматом (`/^\d{4}-\d{2}$/`, `/^\d{4}-\d{2}-\d{2}$/`, а weekStart ще й понеділок) → 400 `{ error }`; невідома вправа / звіт → 404 `{ error }`. `totals.month` — з першого дня місяця `today` до `today`. Наявні `?delay`/`?fail` працюють і тут.

- [ ] **Step 1: Тести**

```ts
it("summary демо проходить схему", () => expect(progressSummarySchema.safeParse(progressSummary(demoHistory())).success).toBe(true));
it("summary порожньої історії проходить схему, score null", () => {
	const s = progressSummary(emptyHistory());
	expect(progressSummarySchema.safeParse(s).success).toBe(true);
	expect(s.consistency.score).toBeNull();
});
it("усі вправи й усі звіти демо проходять схеми", () => { /* цикл по exercises і reports */ });
it("невідома вправа → null; кривий тиждень → null", () => {
	expect(exerciseProgress(demoHistory(), "nope")).toBeNull();
	expect(weeklyReport(demoHistory(), "2026-11-17")).toBeNull(); // вівторок
});
it("маршрут: 400 на кривий month, 404 на невідому вправу", async () => {
	const res = await GET(new Request("http://x/api/mock/progress/calendar?month=2026-13x"), ctx(["progress", "calendar"]));
	expect(res.status).toBe(400);
	const res2 = await GET(new Request("http://x/api/mock/progress/exercises/nope"), ctx(["progress", "exercises", "nope"]));
	expect(res2.status).toBe(404);
});
```
`ctx(path) = { params: Promise.resolve({ path }) }`.
- [ ] **Step 2–4:** FAIL → реалізувати → PASS. Потім `bun run typecheck` → без помилок.
- [ ] **Step 5:** commit `feat(progress): mock API endpoints and schemas`.

---

### Task 8: Компонент LineChart

**Files:**
- Create: `components/ui/LineChart/LineChart.tsx`, `components/ui/LineChart/LineChart.module.scss`
- Modify: `components/ui/index.ts`, `components/sections/UiKitShowcase/UiKitShowcase.tsx`
- Test: `tests/linechart.test.ts` (для чистої функції масштабування)

**Interfaces:**
- Produces:
```ts
export interface LinePoint { label: string; value: number }
interface LineChartProps { points: LinePoint[]; unit?: string; ariaLabel: string; height?: number /* rem, default 16 */ }
export function LineChart(props: LineChartProps): JSX.Element;
export function scalePoints(values: number[], width: number, height: number, pad: number): { x: number; y: number }[]; // експорт для тесту
```
- SVG з `viewBox`, ширина 100 %, лінія `--color-accent`, точки, підпис першого й останнього значення з одиницею, мін/макс осі. `role="img"` + `aria-label`; під графіком візуально прихована таблиця значень для скрінрідерів. 0 точок — нічого не рендерить (батько показує порожній стан); 1 точка — одна точка по центру; усі значення однакові — горизонтальна лінія посередині (без ділення на 0).

- [ ] **Step 1: Тести** — `scalePoints([5,5,5], 100, 50, 0)` → усі `y === 25`; `scalePoints([1], 100, 50, 0)` → `[{ x: 50, y: 25 }]`; `scalePoints([0,10], 100, 50, 0)` → `[{x:0,y:50},{x:100,y:0}]`.
- [ ] **Step 2–4:** FAIL → реалізувати → PASS.
- [ ] **Step 5:** Додати приклад у `UiKitShowcase` (секція «Дані»), `bun run typecheck`, відкрити `/ui-kit` у `bun run dev`, переглянути.
- [ ] **Step 6:** commit `feat(ui): LineChart`.

---

### Task 9: Головний екран `/progress`

**Files:**
- Create: `app/progress/page.tsx`, `app/progress/loading.tsx`
- Create: `components/sections/Progress/ProgressOverview/` (клієнтський: `useQuery(["progress","summary"])`, стани), і блоки, кожен у своїй папці з `.module.scss`: `ConsistencyCard`, `WeekGoal`, `StreakLevel`, `InsightsCard`, `RecordsList`, `MonthCalendar`, `PeriodTotals`, `AchievementsPreview`, `BodyWeightCard`, `DeviceDemoCard`, `ReportsList`, `ProgressSkeleton`
- Create: `components/sections/Progress/format.ts` (`formatInsight(i: Insight): { title: string; next: string }`, `formatRecord(r, exercises)`, `formatDate(d)` — `Intl.DateTimeFormat("uk-UA")`)
- Modify: `messages/uk.json` (ключі `progress.*`; див. обмеження про коміт)

**Interfaces:**
- Consumes: `api.progressSummary`, `api.progressCalendar`, типи з Task 7, `tf` з Task 5, `LineChart` з Task 8.
- Блоки отримують шматок `ProgressSummary` пропсами; тільки `ProgressOverview` і `MonthCalendar` (свій `useQuery(["progress","calendar",month])` з кнопками попередній/наступний місяць, скелетон сітки під час перемикання) звертаються до API.

Поведінка:
- Порядок блоків як на ескізі спеки 3.1 (A → K).
- `ConsistencyCard`: число, стрілка і `delta` (не показувати, якщо `null`), підпис зі `streakWeeks`. `score === null` → «Рахуємо після першого повного тижня».
- `WeekGoal`: 7 кружків пн–нд зі статусами (`completed` суцільний success, `adapted` success з позначкою, `missed` контур без докору, `planned` контур accent, `rest` маленька точка), підпис «2 з 3 тренувань».
- `InsightsCard`: для кожного інсайту `title` + «Далі: …» з `progress.insights.<id>.title|next`.
- `RecordsList`: останні рекорди з бейджем «Нове» (дата в поточному тижні), посилання на `/progress/exercises/[id]`.
- `PeriodTotals`: `Tabs` тиждень / місяць / весь час.
- `AchievementsPreview`: 3 найближчі з прогрес-баром, «Усі досягнення» → `/progress/achievements`.
- `BodyWeightCard`: `LineChart` ваги, різниця перша → остання; під графіком неактивний рядок «Фото прогресу — скоро» (місце під функцію, без завантаження).
- `DeviceDemoCard`: три показники + `Badge tone="warning"` «demo»; блок не рендериться, якщо `device === null`.
- `ReportsList`: посилання на `/progress/reports/[week]`.
- Порожня історія (`?empty=1` у мок-API або `consistency.fullWeeks === 0 && totals.all.workouts === 0`): `EmptyState` «Перше тренування відкриє твій прогрес» замість блоків.
- Помилка: повідомлення + `Button` «Спробувати ще» → `refetch()`.
- Тексти `progress.*` (приклади, остаточні формулювання на розсуд, без тиску):
  - `insights.weekday_misses.title`: «П'ятниці даються найважче» (назва дня з `progress.weekdays.<n>`, через `{weekday}`), `.next`: «Перенесемо п'ятничне тренування на інший день?»
  - `insights.strength_gain.title`: «{exercise}: {from} → {to} за {weeks} тиж.», `.next`: «Спробуй додати ще один підхід»
  - `insights.too_hard.title`: «Останні тренування були важкими», `.next`: «Наступне зробимо легшим»
  - `insights.consistency_up.title`: «Регулярність +{delta}», `.next`: «Тримай темп — він працює»

- [ ] **Step 1:** Реалізувати `format.ts` з тестом `tests/progress-format.test.ts`: `formatInsight` для кожного `InsightId` повертає рядки без `{` (усі змінні підставлені) — FAIL → реалізувати → PASS.
- [ ] **Step 2:** Реалізувати блоки, `ProgressOverview`, `page.tsx` (metadata з `t("progress.title")`), `loading.tsx` з `ProgressSkeleton` (та сама сітка, що й контент).
- [ ] **Step 3:** `bun run typecheck` і `bun run test` → без помилок.
- [ ] **Step 4:** `bun run dev`, відкрити `/progress` (порт з виводу `bun run dev`) у ширині 390 px і 1440 px; перевірити `?delay=1500` (скелетон), `?fail=1` (помилка), `?empty=1` (порожній стан) — для цього `page.tsx` читає `searchParams` (`delay`, `fail`, `empty`), складає `MockDebug` і передає пропсом у `ProgressOverview`, а той — у `api.*`. Переконатися: нема обрізаного тексту, нема горизонтального скролу.
- [ ] **Step 5:** commit без `messages/uk.json` (див. Global Constraints): `feat(progress): overview screen`.

---

### Task 10: Екрани вправи, тижневого звіту, досягнень

**Files:**
- Create: `app/progress/exercises/[id]/page.tsx`, `app/progress/reports/[week]/page.tsx`, `app/progress/achievements/page.tsx` (+ `loading.tsx` для кожного)
- Create: `components/sections/Progress/ExerciseDetail/`, `WeeklyReport/`, `AchievementsList/` (клієнтські, кожен з `useQuery`, скелетоном, помилкою, 404-станом)
- Modify: `messages/uk.json` (`progress.exercise.*`, `progress.report.*`, `progress.achievements.<id>.title|description`)

**Interfaces:**
- Consumes: `api.exerciseProgress`, `api.weeklyReport`, `api.achievements`, `LineChart`, `format.ts`.

Поведінка:
- `ExerciseDetail`: назва, `LineChart` основного показника (одиниця: кг для `e1rm`/`weight`, «повт.» для `reps`, «с» для `time`), найкраще значення, рекорди, сесії (дата, «3 × 12 × 16 кг» / «3 × 12» / «3 × 45 с»), інсайт. 404 від API → `EmptyState` «Такої вправи немає» з посиланням назад.
- `WeeklyReport`: підсумок тижня поруч з минулим (стрілки ↑/↓ для тренувань, хвилин, % виконання), рекорди тижня, інсайт, план наступного тижня (7 днів як у `WeekGoal`, перевикористати компонент). 404/400 → `EmptyState`.
- `AchievementsList`: сітка всіх досягнень — відкриті з іконкою, закриті з прогресом `current / target`.
- Кнопка «Назад» до `/progress` на кожному екрані (`IconButton` з `label`).

- [ ] **Step 1:** Реалізувати три екрани.
- [ ] **Step 2:** `bun run typecheck`, `bun run test` → без помилок.
- [ ] **Step 3:** `bun run dev`: пройти з `/progress` у кожен рекорд, звіт, «Усі досягнення» і назад; відкрити `/progress/exercises/nope` і `/progress/reports/2026-11-17` — бачимо порожній стан, не 500.
- [ ] **Step 4:** commit `feat(progress): exercise, weekly report and achievements screens`.

---

### Task 11: Фінальна перевірка

- [ ] **Step 1:** `bun run typecheck && bun run test && bun run build` → усе зелене.
- [ ] **Step 2:** `bun run lint` → без помилок у нових файлах.
- [ ] **Step 3:** Додати в `docs/agent/architecture.md` рядок про `lib/progress/` (чисті функції розрахунку прогресу; мок-API віддає зведення, бекенд має реалізувати той самий контракт з `lib/api/progressTypes.ts`).
- [ ] **Step 4:** Пройти перевірку анти-цілей спеки (розділ 2) по текстах і UI: немає тиску, demo позначено, дні відпочинку зараховуються.
- [ ] **Step 5:** commit `docs: progress module architecture note`.
