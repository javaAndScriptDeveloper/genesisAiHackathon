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

## Revision 2 (2026-11-21): інтеграція в застосунок з main

Після rebase на `origin/main` у репозиторії з'явився повний застосунок (Дмитро): `app/(app)/*`, стан у `lib/fit` (`FitState`, `useFit()`, localStorage, демо-історія з `lib/fit/seed.ts`), екран `components/features/Progress` з власними регулярністю, серією, XP/рівнем, досягненнями, календарем, вагою, фото; графіки `components/features/Charts` (`LineChart`, `BarChart`); i18n: англійська — джерело в `messages/parts/*.json` → `node scripts/build-messages.mjs` → `messages/en.json` (`en.json` не редагувати вручну), `uk.json` відкатується на англійську. Правила застосунку — `frontend/docs/agent/fitness-app.md`.

Користувач обрав **вбудувати наш модуль в екран Дмитра**. Старі Tasks 7–11 (мок-API, власний `/progress`, власний LineChart) скасовано.

**Рішення (ruling):**
- Серія, регулярність, XP/рівень, досягнення лишаються Дмитрові (єдине джерело — `useFitStats()`; правило «серія = поспіль виконані планові тренування» записане в `fitness-app.md`). Наші `streakWeeks`, `xpAndLevel`, `achievements`, `consistencyScore` у UI не використовуються.
- Наш внесок у UI: підказки «що покращилось / що далі», зміна регулярності за тиждень, тижневий звіт, прогрес сили по вправі. Дані — зі справжнього `FitState` через адаптер.
- Тексти — англійською в `messages/parts/progress.json` (ключі `fit.progress.*`), потім `node scripts/build-messages.mjs`. `uk.json` не чіпати.
- `lib/api/mock/progressDb.ts` (Task 6) лишається як тестовий фікстур, у застосунку не використовується.

### Task 7: Адаптер FitState → History і хук

**Files:**
- Create: `lib/progress/fromFit.ts`, `tests/progress-fromfit.test.ts`
- Modify: `lib/fit/store/hooks.ts` (додати `useProgressAnalytics`), `lib/progress/index.ts` (НЕ реекспортувати `fromFit`, щоб `lib/progress` не залежав від `lib/fit` через index — імпортувати напряму)

**Interfaces:**
- Consumes: `FitState`, `PlannedWorkout`, `SessionLog` з `lib/fit/types.ts`; `getExercise`/`findExercise` з `lib/fit/exercises.ts`; усе з `lib/progress`.
- Produces:
```ts
export function historyFromFit(state: Pick<FitState, "planned" | "history" | "bodyWeights">, today: IsoDate): History;
// lib/fit/store/hooks.ts
export function useProgressAnalytics(): {
	history: History;
	insights: Insight[];                 // insights(history, 2)
	consistencyDelta: number | null;     // consistencyScore (fit/stats) сьогодні мінус тиждень тому; null якщо немає планових днів у жодному з вікон
	reportWeeks: IsoDate[];              // понеділки повних тижнів з хоч одним записом плану, нові першими, максимум 8
};
```
Правила мапінгу:
- **plan**: діапазон від найранішої до найпізнішої дати серед не-`adHoc` `planned`. Для кожного дня: є не-`adHoc` тренування зі статусом не `skipped`, або `skipped` з `skipReason === "busy"` → `workout`; `skipped` з `recovery`/`unwell` → `rest` (вибачений пропуск, як у Дмитра); інакше → `rest`.
- **sessions**: кожен `SessionLog` → `WorkoutSession`: `id`; `date`; `planned` = `plannedId` вказує на не-`adHoc` planned; `status: "completed"` (і `completed`, і `partial`); `adapted = adaptations.length > 0`; `durationMin = round(durationSec/60)`; `setsPlanned` = кількість сетів у відповідному `PlannedWorkout.exercises` (якщо нема — кількість залогованих сетів); `sets` = сети з не-`skipped` вправ: для `timed` вправ `{ reps: 0, weightKg: null, durationSec: set.reps }`, інакше `{ reps, weightKg: weight ?? null, durationSec: null }`; `rpe`: easy→easy, right→ok, hard→hard.
- **exercises**: унікальні `exerciseId` з історії: `timed` → `timed`; є хоч один сет з `weight` → `weighted`; інакше `bodyweight`. `name` = `getExercise(id).name`; невідомий id — пропустити.
- **body**: `bodyWeights` → `{ date, weightKg: kg }`; **device**: `null`.
- `consistencyDelta` рахувати функцією Дмитра `consistencyScore(planned, today)` з `lib/fit/stats` (та сама цифра, що в кільці), різниця з `consistencyScore(planned, addDays(today, -7))`.

- [ ] **Step 1: Тести** (`progress-fromfit.test.ts`): фікстура з `seedHistory(profile, "2026-11-19")` (`lib/fit/seed.ts`; профіль — мінімальний валідний `Profile`):
```ts
it("seed: план і сесії мапляться, без NaN", () => {
	const h = historyFromFit(seed, "2026-11-19");
	expect(h.sessions.length).toBe(seed.history.length);
	expect(h.plan.length).toBeGreaterThan(0);
	expect(h.sessions.every((s) => Number.isFinite(s.durationMin) && s.setsPlanned > 0)).toBe(true);
});
it("skipped recovery → rest, skipped busy → missed", () => { /* мала ручна FitState */ });
it("timed вправа → durationSec, вага → weighted", () => { /* мала ручна FitState */ });
it("порожній стан → порожня історія, insights []", () => {
	const h = historyFromFit({ planned: [], history: [], bodyWeights: [] }, "2026-11-19");
	expect(h.plan).toEqual([]); expect(insights(h)).toEqual([]);
});
```
- [ ] **Step 2–4:** RED → реалізувати `historyFromFit` і хук (`useMemo` від `state`, `today` з `useFit()`) → GREEN. `bun run typecheck`.
- [ ] **Step 5:** commit `feat(progress): adapt app state to progress history`.

### Task 8: Overview — підказки й зміна регулярності

**Files:**
- Modify: `components/features/Progress/Progress.tsx` (+ `.module.scss` за потреби), `messages/parts/progress.json`, згенерований `messages/en.json`
- Create: `components/features/ProgressInsights/ProgressInsights.tsx` + `.module.scss`, `lib/progress/insightCopy.ts` (+ тест `tests/progress-insightcopy.test.ts`)

**Interfaces:**
- Consumes: `useProgressAnalytics()` (Task 7), `useT()`.
- Produces: `insightKeys(i: Insight): { title: string; next: string; params: Record<string, string | number> }` — ключі `fit.progress.insights.<id>.title|next`; для `weekday_misses` параметр `weekday` = `WEEKDAYS[n]` з `lib/fit/dates.ts`... (локалізація днів: ключі `fit.progress.weekdays.0..6`, UI підставляє `t(...)`); `<ProgressInsights insights={Insight[]} fallback={string} />`.

Поведінка:
- Картку «Training insight» замінити на `ProgressInsights`: заголовок «What's working», для кожної підказки — рядок-висновок і рядок «Next: …». Якщо підказок немає — показати існуючий `summary` Дмитра (fallback). Кнопку «Share» зберегти.
- Біля кільця регулярності — `Badge` зі зміною: `+6 vs last week` (success), `−3 vs last week` (neutral, без докору), `null`/0 — нічого.
- Англійські тексти (без тиску):
  - `insights.title`: "What's working"; `next`: "Next: {text}"
  - `weekday_misses`: title "{weekday} sessions slip most often", next "Move that session to a day that suits you better?"
  - `strength_gain`: title "{exercise}: {from} → {to} in {weeks} wk", next "Try adding one more set."
  - `too_hard`: title "Your last sessions felt hard", next "We'll make the next one lighter."
  - `consistency_up`: title "Consistency up {delta} points", next "Keep this rhythm — it works."
  - `consistencyDelta`: "{sign}{n} vs last week"
- [ ] **Step 1:** тест `insightKeys`: для кожного `InsightId` повертає існуючі ключі (перевірити, що `t(key)` з `lib/messages` не повертає сам ключ — тобто ключ є в `en.json`) і всі плейсхолдери покриті `params`. RED → реалізувати + додати тексти в `parts/progress.json` + `node scripts/build-messages.mjs` → GREEN.
- [ ] **Step 2:** компонент і правки Overview. `bun run typecheck`, `bun run test`.
- [ ] **Step 3:** dev-сервер уже на `http://localhost:3100`: відкрити `/progress` (демо-історію додає онбординг; якщо треба — пройти онбординг з демо-історією), переконатися, що картка підказок і бейдж видно, тексти не обрізані.
- [ ] **Step 4:** commit `feat(progress): insights and consistency trend on overview`.

### Task 9: Тижневий звіт

**Files:**
- Create: `app/(app)/progress/week/[week]/page.tsx`, `components/features/WeeklyReport/WeeklyReport.tsx` + `.module.scss`
- Modify: `components/features/Progress/Progress.tsx` (картка «Weekly reports» в Overview зі списком `reportWeeks`, посилання з `transitionTypes={["nav-forward"]}` як у інших drill-down), `messages/parts/progress.json`, `messages/en.json`

**Interfaces:**
- Consumes: `useProgressAnalytics()`, `periodSummary`, `personalRecords`, `weeklyGoal`, `insights` з `lib/progress`; `ScreenHeader` (`back`), `Stat`, `Card`, `EmptyState`, `WeekStrip` (для наступного тижня, якщо його API підходить; інакше простий ряд з 7 днів).
- Сторінка: `PageProps<"/progress/week/[week]">`, валідує `week` (`/^\d{4}-\d{2}-\d{2}$/` і понеділок, і повний тиждень ≤ today); невалідний → `EmptyState` «Report not found» з кнопкою назад на `/progress`.

Вміст звіту: тиждень (дати), `Stat`: тренування (done/planned), хвилини, % виконання плану — кожен зі стрілкою/різницею проти попереднього тижня (`periodSummary` за попередній тиждень); рекорди тижня (`personalRecords` з датою в тижні, назва вправи + значення з одиницею); одна підказка (`insights(history with today = неділя тижня, 1)`); план наступного тижня (`weeklyGoal(history, addDays(week, 7))`). Порожній тиждень (0 тренувань) — короткий нейтральний текст без докору.
- [ ] **Step 1:** реалізувати; `bun run typecheck`, `bun run test`.
- [ ] **Step 2:** відкрити `/progress` → картка звітів → звіт → назад; відкрити `/progress/week/2026-11-17` (вівторок) → «Report not found».
- [ ] **Step 3:** commit `feat(progress): weekly report screen`.

### Task 10: Прогрес сили на екрані вправи

**Files:**
- Create: `components/features/ExerciseProgress/ExerciseProgress.tsx` + `.module.scss`
- Modify: `components/features/ExerciseDetail/ExerciseDetail.tsx` (секція після `ExerciseGuide`), `messages/parts/progress.json`, `messages/en.json`

**Interfaces:**
- Consumes: `useProgressAnalytics().history`, `exerciseSeries`, `mainMetric`, `personalRecords`, `exerciseInsight` з `lib/progress`; `LineChart` з `components/features/Charts/Charts`.

Поведінка: заголовок «Your progress»; `LineChart` останніх 8 точок (`label` = `formatMonthDay(date)`, одиниця: `e1rm`/`weight` → " kg", `reps` → " reps", `time` → " s"); «Best: …», останні 3 рекорди цієї вправи; `exerciseInsight` якщо є (той самий `insightKeys`). Менше 2 точок → текст «Log this exercise twice to see your trend.» Секція не залежить від Premium (базовий прогрес; розширена аналітика Дмитра лишається за `PremiumGate`).
- [ ] **Step 1:** реалізувати; `bun run typecheck`, `bun run test`.
- [ ] **Step 2:** відкрити `/training/exercise/<id вправи з демо-історії>` — графік і рекорди; вправа без історії — текст-заглушка.
- [ ] **Step 3:** commit `feat(progress): strength trend on exercise detail`.

### Task 11: Фінальна перевірка

- [ ] **Step 1:** `bun run typecheck` (лише відома помилка `lib/color.ts`), `bun run test`, `bun run build`.
- [ ] **Step 2:** `bun run lint` — без помилок у змінених файлах.
- [ ] **Step 3:** у `docs/agent/fitness-app.md` додати рядок: `lib/progress/` — чисті функції аналітики прогресу (підказки, тижневий звіт, ряд сили по вправі); `historyFromFit` адаптує `FitState`; серія/XP/досягнення лишаються в `lib/fit`.
- [ ] **Step 4:** перевірити анти-цілі спеки по нових текстах.
- [ ] **Step 5:** commit `docs: progress analytics in fitness app`.
