# Модуль прогресу v2 (аналітика + мотивація) — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Один модуль `lib/progress` рахує всю аналітику й мотивацію застосунку (регулярність, тижнева ціль, серія з паузою, XP/рівні, бейджі, рекорди за Brzycki, вага/ІМТ, тижневий звіт, «що покращилось / що далі», події «нового»). Розділ Progress отримує 6 екранів і підсвічування нового. Факти зберігаються в Postgres (Knex + Objection) в окремих таблицях `user_progress_*`, прив'язаних до `users` команди (гостьовий користувач за секретним `progressToken`), а **кожен обчислений знімок аналітики архівується** (append-only).

**Architecture:** Рушій — чисті функції в `frontend/lib/progress` над `History` (адаптер `historyFromFit` уже є). Хук `useProgress()` віддає все екранам; `useFitStats()`, Today, Coach, Profile, Celebration, сповіщення читають тільки з нього. Новий стан (тижнева ціль, паузи, події, `progressToken`) — у `FitState`/reducer. `platform-backend` зберігає сирі факти в 7 таблицях `user_progress_*` і архів знімків у `user_progress_snapshots`; клієнт синхронізує факти пакетами й архівує знімки (`weekly` щотижня, `change` після кожної зміни чисел).

**Tech Stack:** Next.js 16 App Router, React 19, TS strict + `noUncheckedIndexedAccess`, SCSS Modules, react-query, zod 4, Vitest, bun (frontend); Fastify 5, Knex 3, Objection 4, `pg`, Vitest + Testcontainers (backend).

**Spec:** `docs/superpowers/specs/2026-11-21-progress-module-v2-design.md` + вимоги `docs/product/progress-implementation-prompt.md` («промпт», правила розділу 2 — дослівно). Перед роботою: `frontend/AGENTS.md`, `frontend/docs/agent/fitness-app.md`, `frontend/docs/agent/styling.md`.

## Global Constraints

- **Передумова (до Task 20):** користувачка комітить свої незакомічені зміни в `frontend/messages/uk.json`. До того `uk.json` не чіпати.
- Нових залежностей не додавати (ні фронтенд, ні бекенд).
- Правила — дослівно з розділу 2 промпту. Ключові числа:
  - якісне тренування: `completedSets / plannedSets ≥ 0.7`;
  - `C_week = min(100, (якісні + зараховані дні відпочинку) / заплановані дні × 100)`; день відпочинку зараховується, лише якщо **найближчий** запланований тренувальний день того ж тижня (попередній або наступний; при рівній відстані — будь-який із двох) виконано якісно;
  - головне число регулярності — зважене середнє 4 останніх **завершених** тижнів без паузи, ваги `0.4, 0.3, 0.2, 0.1`; тижні на паузі пропускаються; поточний тиждень не входить;
  - тижнева ціль 2–5 якісних тренувань; серія — зараховані тижні поспіль; пауза (1–4 тижні) не обриває й не збільшує; незарахований тиждень без паузи обнуляє; рекорд серії рахується з історії;
  - e1RM за **Brzycki** `w × 36 / (37 − r)` лише при `1 ≤ r ≤ 10`, округлення до 0,1; в UI тільки «≈»/«оцінка», ніколи «максимум»;
  - XP: тренування `round(100 × qualityRatio)` (лише якісне); рекорд +25, не більше 3 за тренування; зарахований тиждень +50; зарахований день відпочинку +5; перехід `n → n+1` коштує `250 + 250·n` XP;
  - вага: 7-денне ковзне середнє; ІМТ `кг / м²`, категорії ВООЗ `<18,5 / 18,5–24,9 / 25–29,9 / ≥30`, нейтральний текст + примітка про м'язи.
- Тиждень — з понеділка за **локальним** часом; дати в рушії — рядки `YYYY-MM-DD` (наявні хелпери `lib/progress/dates.ts`).
- Маса завжди через `useUnits()` (кг/фунти); у рушії — тільки кілограми.
- Тексти: англійські в `frontend/messages/parts/progress.json` → `node scripts/build-messages.mjs`; `en.json` руками не редагувати. Українські — Task 20. Числа форматуються `Intl.NumberFormat(locale)`.
- Дизайн тільки з наявних компонентів і токенів (`components/ui`, `components/features/*`); радіуси через `corners`; іконки — Hugeicons/`SportIcon`; без емодзі й текстових гліфів.
- Не винагороджувати бездіяльність; не перераховувати головне число регулярності щодня; без справжнього Training Readiness.
- Backend: стиль файлів команди (2 пробіли, ESM `.js` імпорти, `knexSnakeCaseMappers` → camelCase у моделях); міграції лише додаються, старі не редагуються.
- Перевірка: frontend `bun run typecheck` (лише відома помилка в незакоміченому `lib/color.ts`) і `bun run test`; backend `npm test` (потрібен Docker).
- Коміти: тема ≤ 72 символи, закінчуються `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Старий збережений стан без нових полів** (`weeklyGoal`, `pauses`, `progressEvents`, `progressToken`) — застосунок завантажується, поля отримують значення за замовчуванням. Тест: Task 8.
2. **Пауза на межі тижнів і поточний тиждень на паузі** — серія не обривається і не росте, регулярність бере наступний старіший тиждень. Тест: Task 2.
3. **Повторна синхронізація того самого пакета / два клієнти з різними `progressToken` / повторне архівування того самого знімка** — без дублікатів, без витоку чужих даних, архів ніколи не перезаписується. Тест: Task 11.
4. **Новий користувач (0 тренувань, сценарій S0)** — жодних нулів-вироків, усі екрани показують порожні стани з підказкою дії. Тест: Task 8b (+ скриншоти S0 у кожній задачі Фази D).
5. **Кілька подій одночасно (2 бейджі + рівень)** — одне святкове вікно; після відкриття звіту крапка на табі й картка зникають. Тест: Task 7, Task 19.

## Тестові сценарії

Кожен екран і кожна функція рушія перевіряється на однакових іменованих станах. Сценарії — детерміновані фікстури (Task 8b), що збираються з тих самих фабрик, що й демо-історія. Їх можна завантажити в застосунок для ручної перевірки та скриншотів.

| ID | Сценарій | Стан | Навіщо |
|---|---|---|---|
| **S0** | Новий користувач, без даних | онбординг пройдено, план є, 0 тренувань, 0 зважувань, 0 подій | порожні стани замість нулів; жодних «0/100» як вироку |
| **S1** | Перший тиждень | 1–2 якісних тренування в поточному тижні, 1 зважування, жодного завершеного тижня | регулярність «ще рахуємо», серія 0 без докору, перший бейдж і святкове вікно |
| **S2** | Прогрес є (основний) | 12 тижнів: пропуски, 1 тиждень паузи, рекорди, зважування 3–5/тиждень ±0,8 кг, усі 3 типи вправ, непереглянутий звіт, 2 нові бейджі + новий рівень | усі блоки заповнені; підсвічування нового; графіки й архів |
| **S3** | Пауза зараз | S2, але поточний тиждень на паузі | серія не обривається і не росте; календар показує паузу; порада не тисне |
| **S4** | Повернення після перерви | 3 тижні без тренувань без паузи, потім 1 тренування | серія 0, регулярність падає чесно, текст підтримує, а не соромить |
| **S5** | Лише власна вага, фунти | тільки bodyweight/timed вправи, `units: imperial` | рекорди в повтореннях/секундах, жодного e1RM, маса у фунтах |
| **S6** | Безкоштовний vs Premium | S2 × `subscription.tier` free/premium | історія > 3 міс., детальні графіки й персональні поради — лише Premium, інакше `PremiumGate` |

**Очікування по екранах (S0 / S2):**

| Екран | S0 — немає даних | S2 — прогрес є |
|---|---|---|
| Головний | картка цілі «0 з N» + «Почати тренування»; замість регулярності й серії — підказка «Перше тренування запустить твій прогрес»; рівень 1, 0 XP без смуги-вироку; «Що покращилось» і «Нові рекорди» приховані; порада — «почни перше тренування» | усі блоки, числа збігаються з рушієм; картка «Звіт готовий»; крапка на табі |
| Календар | місяць із планом (заплановано/відпочинок), без пропусків у минулому до старту | стани дня всіх типів, тиждень паузи, «Як склалось N» з 4 тижнями |
| Рекорди | порожній стан «Рекорди з'являться після тренувань» | фільтри, графік e1RM, «Звідки це число», set records 5/8/10, мітки «Нове» |
| Вага | порожній стан + поле «Вага сьогодні»; ІМТ не показується без ваги | старт/поточна/зміна, точки + 7-денне середнє, ІМТ зі шкалою |
| Звіт | «Перший звіт з'явиться в понеділок» | порівняння з минулим тижнем, 1 покращення, 1 порада, вибір цілі |
| Досягнення | рівень 1, таблиця XP, усі бейджі закриті з «ще N» | отримані зверху, нові з «Нове», закриті з «ще N» |
| Today / Coach | ті самі значення серії й регулярності, що й Progress (S0: нулі не показуються як досягнення) | ті самі значення, що й Progress |

**Як перевіряти:**
- **Юніт-тести:** кожна задача Фази A має тест на S0 (порожня історія → `null`/порожні масиви, без `NaN`) і на S2 (конкретні очікувані числа). Пороги S2 фіксуються в `tests/progress-scenarios.test.ts`.
- **Ручна перевірка й скриншоти:** у dev-режимі `/progress?scenario=S0` … `S6` завантажує фікстуру у стан (лише `process.env.NODE_ENV !== "production"`; поточний стан не губиться: перед заміною зберігається копія в `localStorage` під `fit.state.backup`). Кожен екран Фази D скриншотиться на 390 px щонайменше для S0 і S2.
- **Бекенд:** інтеграційний тест синхронізації й архіву проганяє S0 (порожній знімок, `weekly` не пишеться) і S2 (усі факти, по `weekly`-знімку на кожен завершений тиждень, крім тижня паузи — він архівується з `paused: true`).

---

## File Structure

| Файл | Відповідальність |
|---|---|
| `frontend/lib/progress/types.ts` (mod) | + `Pause`, `ProgressEvent`, `SetRecord`, `LevelInfo`, `BadgeId` |
| `frontend/lib/progress/records.ts` (mod) | Brzycki, типи рекордів, set records 5/8/10 |
| `frontend/lib/progress/consistency.ts` (mod) | `C_week`, головне число, тижнева ціль, серія з паузою |
| `frontend/lib/progress/xp.ts`, `levels.ts` (mod/new) | XP за таблицею, рівні й назви (конфіг) |
| `frontend/lib/progress/badges.ts` (new, замінює `achievements.ts`) | бейджі промпту з прогресом «скільки лишилось» |
| `frontend/lib/progress/improvements.ts` (new, замінює правила в `insights.ts`) | ≤ 2 покращення, рівно 1 порада з шаблонів |
| `frontend/lib/progress/bodyWeight.ts` (new) | старт/поточна/зміна, ковзне середнє, ІМТ |
| `frontend/lib/progress/report.ts` (mod) | тижневий звіт v2, рекомендація цілі, текст push |
| `frontend/lib/progress/events.ts`, `premium.ts` (new) | виявлення нових подій; прапорці платного |
| `frontend/lib/progress/engine.ts` (new) | `progressSnapshot(history, ctx)` — одна точка входу для UI |
| `frontend/lib/fit/scenarios.ts` (new) | фікстури сценаріїв S0–S6 + dev-завантажувач `?scenario=` |
| `frontend/lib/fit/types.ts`, `seed.ts`, `store/reducer.ts`, `store/persist.ts`, `store/hooks.ts` (mod) | новий стан, дії, 12-тижнева демо-історія, `useProgress()` |
| `frontend/lib/fit/stats.ts`, `gamification.ts`, `notifications.ts`, `coach.ts` (mod) | старі розрахунки → виклики рушія |
| `frontend/lib/api/progressSync.ts` (new) | zod-схеми, `fetchSnapshot`, `pushSync`, `markSeenRemote`, хук `useProgressSync` |
| `platform-backend/src/migrations/20261124_01_create_user_progress.ts` (new) | 7 таблиць фактів `user_progress_*` |
| `platform-backend/src/migrations/20261124_02_create_user_progress_snapshots.ts` (new) | архів знімків (append-only) |
| `platform-backend/src/progress/models.ts`, `repo.ts`, `routes.ts` (new) | Objection-моделі, upsert/знімок, Fastify-маршрути |
| `platform-backend/src/app.ts` (mod) | реєстрація маршрутів |
| `platform-backend/test/progress.test.ts` (new) | схема, ідемпотентність, ізоляція пристроїв |
| `frontend/app/(app)/progress/{calendar,records,weight,achievements}/page.tsx` (new), `week/[week]` (mod) | маршрути |
| `frontend/components/features/Progress*` (нові/змінені папки за задачами) | екрани й віджети |
| `frontend/components/features/BadgeIcon`, `NextAchievementCard` (new); `Today`, `Profile`, `Workout/WorkoutSummary` (mod) | досягнення на кожному кроці (Task 18b) |
| `frontend/components/features/BottomNav`, `Celebration`, `Workout` (mod) | крапка «нове», групове вікно, банер рекорду |
| `docs/product/progress-rules.md` (new), `frontend/docs/agent/fitness-app.md` (mod) | формули; правила модуля |

---

## Фаза A — рушій (чисті функції, TDD)

### Task 1: Рекорди за Brzycki і set records

**Files:** Modify `frontend/lib/progress/records.ts`, `types.ts`; Test `frontend/tests/progress-records.test.ts`

**Interfaces — Produces:**
```ts
export function estimate1RM(weightKg: number, reps: number): number | null; // Brzycki, 1..10 повторів, округлення 0.1
export type RecordMetric = "e1rm" | "weight" | "reps" | "time";
export interface SetRecord { reps: 5 | 8 | 10; weightKg: number; date: IsoDate }
export function setRecords(h: History, exerciseId: string): SetRecord[]; // найбільша вага для рівно 5/8/10 повторів
// personalRecords: weighted → e1rm і weight; bodyweight → reps; timed → time (як зараз, формула нова)
```
- [ ] **Step 1: Тести:** `estimate1RM(32, 5) === 36` (36,0), `estimate1RM(24, 7) === 28.8`, `estimate1RM(20, 12) === null`, `estimate1RM(20, 0) === null`; `setRecords` повертає лише 5/8/10 з максимальною вагою; підхід 20 × 12 іде в рекорд `reps`-серії вправи, але не в e1RM. Наявні тести Epley оновити на Brzycki.
- [ ] **Step 2–4:** RED → реалізувати → GREEN (`bun run test tests/progress-records.test.ts`).
- [ ] **Step 5:** commit `feat(progress): Brzycki e1RM and set records`.

### Task 2: Регулярність v2, тижнева ціль, серія з паузою

**Files:** Modify `consistency.ts`, `types.ts`; Test `tests/progress-consistency.test.ts`

**Interfaces — Produces:**
```ts
export interface Pause { from: IsoDate; to: IsoDate }
export interface ProgressContext { weeklyGoal: number; pauses: Pause[] } // weeklyGoal 2..5
export function restDayCredited(h: History, date: IsoDate): boolean;
export function weekScore(h: History, weekStart: IsoDate): number | null; // C_week; null якщо в тижні немає плану
export function isPausedWeek(ctx: ProgressContext, weekStart: IsoDate): boolean; // будь-який день тижня в паузі
export function consistencyV2(h: History, ctx: ProgressContext): { score: number | null; weeks: { weekStart: IsoDate; score: number; weight: number }[] };
export function weekCredited(h: History, ctx: ProgressContext, weekStart: IsoDate): boolean; // якісних ≥ weeklyGoal
export function streakV2(h: History, ctx: ProgressContext): { current: number; best: number };
```
- [ ] **Step 1: Тести (значення з промпту):** план 3 + 4, виконано 0 → `weekScore === 0`; 3 якісних → `100`; тижні 75/80/100/80 (від свіжого) → `consistencyV2.score === 82`; тиждень на паузі пропускається і береться 5-й старіший; поточний тиждень не входить; серія: 3 зараховані + пауза + 1 зарахований → `current 4`; незарахований без паузи → `0`; поточний незавершений не обриває; `best` = максимум за історію. Пауза довша за 4 тижні відкидається (`isPausedWeek` повертає `false` для тижнів поза першими 4).
- [ ] **Step 2–4:** RED → реалізувати → GREEN.
- [ ] **Step 5:** commit `feat(progress): consistency v2, weekly goal and paused streak`.

### Task 3: XP, рівні, бейджі

**Files:** Modify `xp.ts`; Create `levels.ts`, `badges.ts`; Delete `achievements.ts` (+ його тест переписати як `tests/progress-badges.test.ts`); Test `tests/progress-xp.test.ts`

**Interfaces — Produces:**
```ts
export interface XpEntry { date: IsoDate; source: "workout" | "pr" | "week" | "rest"; amount: number }
export function xpLedger(h: History, ctx: ProgressContext): XpEntry[];
export interface LevelInfo { level: number; name: string; xp: number; into: number; span: number; pct: number }
export function levelFor(totalXp: number): LevelInfo; // поріг n→n+1 = 250 + 250n
export const LEVEL_NAMES: string[]; // ключі копірайту: fit.progress.levels.<n>, мінімум 10
export type BadgeId = "first-workout" | "perfect-week" | "streak-2" | "streak-4" | "streak-6" | "streak-10" | "streak-20" | "first-pr" | "prs-5" | "workouts-20" | "workouts-50" | "workouts-100";
export interface Badge { id: BadgeId; unlocked: boolean; unlockedOn: IsoDate | null; current: number; target: number; remaining: number }
export function badges(h: History, ctx: ProgressContext): Badge[];
export function nextBadges(list: Badge[], n: number): Badge[]; // не отримані, за current/target спадно; при рівності — менший remaining
export function recentBadges(list: Badge[], n: number): Badge[]; // отримані, новіші першими
export interface XpBreakdown { workout: number; prs: number; week: number; rest: number; total: number }
export function xpForSession(h: History, ctx: ProgressContext, sessionId: string): XpBreakdown;
export function badgeProgressDelta(before: Badge[], after: Badge[]): { id: BadgeId; from: number; to: number; target: number; unlocked: boolean }[]; // для підсумку тренування
```
- [ ] **Step 1: Тести:** тренування з ratio 0.8 → 80 XP; ratio 0.6 → 0; 4 рекорди в одному тренуванні → +75; зарахований тиждень +50; зарахований день відпочинку +5, незарахований 0; `levelFor(0).level === 1`, `levelFor(499).level === 1`, `levelFor(500).level === 2`, `levelFor(1250).level === 3`; рівень 7→8 потребує 2000; `perfect-week` — тиждень з усіма запланованими тренуваннями якісними; `unlockedOn` — дата, коли умову виконано вперше; `nextBadges` у S0 починається з `first-workout` (remaining 1); `xpForSession` для тренування з ratio 0.8 і 1 рекордом → `{workout: 80, prs: 25, total: 105}`; `badgeProgressDelta` після 2-го тренування тижня показує `perfect-week` 1→2 з 3.
- [ ] **Step 2–4:** RED → GREEN.
- [ ] **Step 5:** commit `feat(progress): XP ledger, levels and badges`.

### Task 4: «Що покращилось» і «Що далі»

**Files:** Create `improvements.ts`; Modify `insights.ts` (лишити лише те, що використовують інші модулі); Test `tests/progress-improvements.test.ts`

**Interfaces — Produces:**
```ts
export type Improvement =
	| { kind: "record"; exerciseId: string; metric: RecordMetric; now: number; before: number; delta: number }
	| { kind: "consistency"; now: number; before: number; delta: number }
	| { kind: "streak"; now: number; before: number; delta: number };
export function improvements(h: History, ctx: ProgressContext): Improvement[]; // порівняння з today−28, ≤ 2, найбільші відносні
export type AdviceId = "plateau" | "goal-remaining" | "near-record";
export interface Advice { id: AdviceId; vars: Record<string, string | number> }
export function advice(h: History, ctx: ProgressContext): Advice | null; // рівно одна; пріоритет: goal-remaining (ще N до неділі) → near-record (≤ 5% до рекорду) → plateau (2 тижні без росту основної вправи)
```
- [ ] **Step 1: Тести:** віджимання 15 → 18 за 4 тижні → `{kind:"record", now:18, before:15, delta:3}`; ніколи > 2 покращень; порада одна або `null` для нового користувача; шаблони `fit.progress.advice.<id>` існують в `en.json`.
- [ ] **Step 2–4:** RED → GREEN.
- [ ] **Step 5:** commit `feat(progress): improvements and single advice`.

### Task 5: Вага тіла та ІМТ

**Files:** Create `bodyWeight.ts`; Test `tests/progress-bodyweight.test.ts`

**Interfaces — Produces:**
```ts
export function movingAverage(entries: BodyMeasurement[], days: 7): { date: IsoDate; avg: number }[];
export function weightSummary(entries: BodyMeasurement[], period: "month" | "3m" | "year", today: IsoDate): { start: number | null; current: number | null; change: number | null; points: BodyMeasurement[]; avg: { date: IsoDate; avg: number }[] };
export type BmiCategory = "under" | "normal" | "over" | "obese";
export function bmi(kg: number, heightCm: number): { value: number; category: BmiCategory }; // value округлено 0.1
```
- [ ] **Step 1: Тести:** `bmi(70, 175)` → `22.9`, `normal`; межі 18.5 / 25 / 30; ковзне середнє по календарних 7 днях (дні без зважувань не рахуються як 0); порожній список → усі `null`.
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `feat(progress): body weight trend and BMI`.

### Task 6: Тижневий звіт v2

**Files:** Modify `report.ts`; Test `tests/progress-report.test.ts`

**Interfaces — Produces:**
```ts
export interface WeeklyReportV2 {
	weekStart: IsoDate; credited: boolean; paused: boolean;
	summary: { workouts: number; minutes: number; qualitySets: number; xp: number };
	previous: { workouts: number; minutes: number; qualitySets: number; xp: number };
	improvement: Improvement | null; advice: Advice | null;
	recommendedGoal: number; // 2..5: середнє якісних за останні 4 тижні, округлене, обмежене 2..5
	pushText: { key: "fit.progress.push.weekly"; params: { done: number; goal: number; streak: number } };
}
export function weeklyReportV2(h: History, ctx: ProgressContext, weekStart: IsoDate): WeeklyReportV2;
```
- [ ] **Step 1: Тести:** звіт за минулий тиждень не залежить від пізніших даних; `recommendedGoal` для 2/3/4/3 → 3; тиждень на паузі → `paused: true`, `credited: false`.
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `feat(progress): weekly report v2`.

### Task 7: Події «нового», прапорці платного, єдина точка входу

**Files:** Create `events.ts`, `premium.ts`, `engine.ts`; Test `tests/progress-engine.test.ts`

**Interfaces — Produces:**
```ts
export interface ProgressEvent { id: string; kind: "badge" | "level" | "pr" | "report"; refId: string; createdAt: string; seenAt: string | null }
export function detectEvents(before: ProgressSnapshot, after: ProgressSnapshot, now: string): ProgressEvent[]; // id = `${kind}:${refId}`
export function reportReadyEvent(h: History, ctx: ProgressContext, now: string): ProgressEvent | null; // з понеділка, для минулого тижня
export function unseen(events: ProgressEvent[]): { any: boolean; byKind: Record<ProgressEvent["kind"], number> };
export function celebrationGroup(events: ProgressEvent[]): { badges: string[]; level: number | null } | null; // одне вікно на всі непереглянуті badge/level
export const PREMIUM = { historyMonths: 3, detailedCharts: true, personalAdvice: true } as const;
export function visibleHistoryFrom(today: IsoDate, isPremium: boolean): IsoDate | null; // null = без обмеження
export interface ProgressSnapshot { consistency: ReturnType<typeof consistencyV2>; streak: { current: number; best: number }; week: { goal: number; quality: number; days: WeekGoalDay[] }; level: LevelInfo; badges: Badge[]; records: PersonalRecord[]; improvements: Improvement[]; advice: Advice | null }
export function progressSnapshot(h: History, ctx: ProgressContext): ProgressSnapshot;
export const ENGINE_VERSION: string; // "2.0.0"; підвищувати при зміні будь-якої формули
export function snapshotHash(s: ProgressSnapshot): string; // стабільний хеш: JSON з відсортованими ключами → FNV-1a (без нових залежностей)
```
- [ ] **Step 1: Тести:** різниця двох знімків з 2 новими бейджами і новим рівнем → 3 події, `celebrationGroup` → одне вікно з обома бейджами й рівнем; повторне виявлення тих самих подій не створює дублікатів (той самий `id`); `unseen` після `seenAt` → `any: false`; `snapshotHash` однаковий для знімків з різним порядком ключів і різний при зміні будь-якого числа.
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `feat(progress): events, premium flags and snapshot entry point`.

## Фаза B — стан застосунку і єдине джерело

### Task 8: Новий стан, дії, 12-тижнева демо-історія

**Files:** Modify `frontend/lib/fit/types.ts`, `seed.ts`, `store/reducer.ts`, `store/persist.ts`; Test `frontend/tests/fit.test.ts`, `tests/progress-seed.test.ts`

**Interfaces — Produces:**
```ts
// FitState +
progressToken: string;       // crypto.randomUUID() при першому запуску; секрет, за яким сервер знаходить гостьового користувача
weeklyGoal: number;          // 2..5, за замовчуванням clamp(profile.daysPerWeek, 2, 5)
pauses: Pause[];
progressEvents: ProgressEvent[];
archivedWeeks: IsoDate[];    // тижні, weekly-знімок яких уже в архіві
archiveQueue: ArchiveItem[]; // ненадіслані знімки (Task 12)
// Action +
| { type: "set-weekly-goal"; goal: number }
| { type: "add-pause"; from: IsoDate; to: IsoDate }      // відхиляється, якщо > 4 тижнів або перетин
| { type: "remove-pause"; from: IsoDate }
| { type: "record-events"; events: ProgressEvent[] }       // ідемпотентно за id
| { type: "mark-seen"; kinds?: ProgressEvent["kind"][]; ids?: string[]; now: string }
| { type: "apply-remote"; snapshot: RemoteSnapshot }       // з Task 12
| { type: "archive-queued"; item: ArchiveItem }
| { type: "archive-sent"; ids: string[]; weeks: IsoDate[] }
```
- Гідратація: відсутні поля → значення за замовчуванням (Review Focus 1).
- `seedHistory` → 12 тижнів: пропуски, один тиждень паузи, кілька рекордів, зважування 3–5 разів на тиждень із детермінованим шумом ±0,8 кг, усі три типи вправ; детермінований (`mulberry32`, фіксований seed).
- [ ] **Step 1: Тести:** гідратація старого JSON без нових полів; `add-pause` на 5 тижнів відхиляється; `record-events` двічі → без дублікатів; демо: 12 тижнів, ≥ 1 тиждень паузи, ≥ 3 рекорди, зважувань у кожному тижні 3–5, `seedHistory` двічі дає однаковий результат.
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `feat(fit): progress state, actions and 12-week demo history`.

### Task 8b: Фікстури сценаріїв S0–S6

**Files:** Create `frontend/lib/fit/scenarios.ts`, `frontend/tests/progress-scenarios.test.ts`; Modify `frontend/components/features/AppShell/*` або `app/(app)/layout.tsx` (dev-перемикач `?scenario=`)

**Interfaces — Produces:**
```ts
export type ScenarioId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
export function scenarioState(id: ScenarioId, today: IsoDate, opts?: { premium?: boolean }): FitState; // детерміновано, з тих самих фабрик, що seedHistory
export const SCENARIO_IDS: ScenarioId[];
```
- `S2` = 12-тижнева демо-історія з Task 8 + непереглянутий звіт + 2 нові бейджі + новий рівень у `progressEvents`.
- Dev-перемикач: `?scenario=S2` у dev → бекап поточного стану в `fit.state.backup`, `hydrate` фікстурою; `?scenario=restore` повертає бекап. У production параметр ігнорується.
- [ ] **Step 1: Тести (`progress-scenarios.test.ts`), для кожного сценарію через `progressSnapshot(historyFromFit(state), ctx)`:**
  - S0: `consistency.score === null`, `streak.current === 0`, `level.level === 1`, `records`/`improvements` порожні, `advice?.id` — порада для старту, жодного `NaN` у знімку (рекурсивна перевірка).
  - S1: `consistency.score === null` (немає завершеного тижня), бейдж `first-workout` отримано.
  - S2: `consistency.score` у межах 60–95, `streak.current ≥ 2`, ≥ 3 рекорди, `unseen.any === true`, `celebrationGroup` містить 2 бейджі й рівень.
  - S3: серія така сама, як у S2 без поточного тижня; `isPausedWeek(ctx, weekStart(today)) === true`.
  - S4: `streak.current === 0`, регулярність нижча, ніж у S2.
  - S5: жоден рекорд не має метрики `e1rm`/`weight`.
  - S6: `visibleHistoryFrom` для free = `today − 3 міс.`, для premium = `null`.
  - Однакові `scenarioState(id, today)` двічі → `toEqual`.
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `test(progress): named scenarios S0–S6 and dev loader`.

### Task 9: `useProgress()` як єдине джерело

**Files:** Modify `frontend/lib/fit/store/hooks.ts`, `stats.ts`, `gamification.ts`, `notifications.ts`, `coach.ts`, `store/reducer.ts` (finish → `record-events`), `components/features/{Today,Coach,Profile,TrainingInsight,Celebration,Awards}/*`; Test `tests/fit.test.ts`, `tests/progress-hooks.test.ts`

**Interfaces — Produces:**
```ts
export function useProgress(): ProgressSnapshot & { history: History; ctx: ProgressContext; unseen: ReturnType<typeof unseen> };
// useFitStats() лишає свої поля, але streak/consistency/level/xp беруться з useProgress():
//   streak.current/longest ← streakV2.current/best (тижні); consistency ← consistencyV2.score ?? 0; level ← LevelInfo; xp ← сума xpLedger
```
- Видалити з `stats.ts` / `gamification.ts`: `computeStreak`, `consistencyScore`, `sessionXp`, `levelInfo`, `totalXp`, `levelOf`, `ACHIEVEMENTS`, `evaluateAchievements` (або лишити як однорядкові обгортки, якщо їх імпортує код поза цим списком — перевірити `grep`). `fitness-app.md`: правило серії переписати на тижні з паузою.
- Тексти, що кажуть «sessions in a row», замінити на тижні (ключі в `parts/*.json`).
- `finish` у reducer: порахувати `progressSnapshot` до і після, `detectEvents` → `record-events`; `sync` (раз на день) → `reportReadyEvent`.
- Сповіщення `weekly-summary`: текст з `weeklyReportV2.pushText`, у понеділок о 9:00 локально (заглушка в наявній системі).
- [ ] **Step 1: Тести:** Today, Coach і Progress отримують однакові `streak`/`consistency` для того самого стану (тест на рівні хука з `renderHook`-подібним викликом чистої функції `progressSnapshot`); завершення тренування з новим рекордом додає подію `pr`.
- [ ] **Step 2–4:** RED → GREEN; `grep -rn "computeStreak\|consistencyScore\|levelOf\|totalXp\|evaluateAchievements" frontend/components frontend/lib` → лише рушій.
- [ ] **Step 5:** commit `refactor(fit): read all progress numbers from lib/progress`.

## Фаза C — схема БД і синхронізація

### Task 10: Міграції й Objection-моделі

**Files:** Create `platform-backend/src/migrations/20261124_01_create_user_progress.ts`, `platform-backend/src/migrations/20261124_02_create_user_progress_snapshots.ts`, `platform-backend/src/progress/models.ts`; Test `platform-backend/test/progress.test.ts`

Схема — таблиця «Схема БД» у дизайн-документі (дослівно). Моделі: `ProgressSettingsModel`, `ProgressPlanDayModel`, `ProgressWorkoutModel` (relation `sets` → `ProgressSetModel`), `ProgressSetModel`, `ProgressPauseModel`, `ProgressWeightModel`, `ProgressEventModel`, `ProgressSnapshotModel` (архів: у моделі немає методів оновлення/видалення, репозиторій лише вставляє); `tableName` як у схемі, поля camelCase (`knexSnakeCaseMappers`). `numeric` повертати як `number` (`$parseDatabaseJson` або `pg.types.setTypeParser(1700, parseFloat)` у `db.ts`).
- [ ] **Step 1: Тести:** після `migrate` (разом з міграціями команди) існують 8 таблиць `user_progress_*` з колонками зі схеми; видалення рядка `users` каскадно видаляє всі дані прогресу цього користувача; `user_progress_workouts.training_id` при видаленні `user_trainings` стає `null` (`information_schema.columns`); check `weekly_goal` відхиляє 6; check паузи відхиляє 29 днів; `down` прибирає всі таблиці; видалення `user_progress_workouts` каскадно видаляє `user_progress_sets`; `user_progress_snapshots` має частковий unique (`user_id`, `week_start`) `where period = 'weekly'` і index (`user_id`, `taken_at`); `payload` — `jsonb not null`.
- [ ] **Step 2–4:** RED → GREEN (`npm test` у `platform-backend`).
- [ ] **Step 5:** commit `feat(backend): progress schema and models`.

### Task 11: Ендпоінти синхронізації

**Files:** Create `platform-backend/src/progress/repo.ts`, `routes.ts`; Modify `src/app.ts`; Test `test/progress.test.ts`

**Interfaces — Produces:**
```ts
// Усі з заголовком x-progress-token (UUID), інакше 400 { error }. repo.resolveUser(token, { create }) знаходить user_id через user_progress_settings.client_token; при першому записі створює users { name: "Guest", email: `guest-${token}@guest.invalid` } + settings в одній транзакції. users.id назовні не віддається.
GET  /api/progress/snapshot      → 200 RemoteSnapshot (порожні масиви для невідомого токена, користувач не створюється)
POST /api/progress/sync          body RemoteSnapshot (часткові масиви дозволені) → 200 { ok: true, counts }
POST /api/progress/events/seen   body { ids: string[]; seenAt: string } → 200 { updated: number }
POST /api/progress/archive       body { period: "weekly" | "change"; weekStart: string | null; takenAt: string; engineVersion: string; payload: object; payloadHash: string } → 201 { archived: true } | 200 { archived: false } (дублікат)
GET  /api/progress/archive?from=&to=&period= → 200 { snapshots: { period, weekStart, takenAt, engineVersion, payload }[] } за зростанням takenAt
interface RemoteSnapshot { device: { weeklyGoal: number; units: "metric" | "imperial"; heightCm: number | null }; planDays: …; workouts: (Workout & { sets: SetLog[] })[]; pauses: …; weights: …; events: … }
```
- Валідація тіла — JSON Schema у Fastify-маршруті (без нових бібліотек), ліміт тіла 1 МБ. Upsert в одній транзакції: `insert … onConflict(pk).merge()`; `set_logs` тренування замінюються повністю.
- [ ] **Step 1: Тести:** sync двічі тим самим тілом → ті самі кількості рядків; два токени не бачать даних один одного; перший `sync` з новим токеном створює рівно одного гостьового користувача, повторний — жодного; без заголовка → 400; некоректний `kind` → 400; `events/seen` проставляє `seen_at` лише для свого користувача; архів: `weekly` за той самий тиждень двічі → 1 рядок, другий виклик `archived: false`, перший payload не змінився; `change` з тим самим хешем, що й останній знімок користувача → не пишеться, з іншим → пишеться; `GET archive` повертає лише знімки свого користувача в межах дат; у коді репозиторію немає `update`/`delete` для `user_progress_snapshots` (перевірити `grep`).
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `feat(backend): progress snapshot and sync endpoints`.

### Task 12: Клієнт синхронізації

**Files:** Create `frontend/lib/api/progressSync.ts`; Modify `lib/fit/store/FitProvider.tsx` (запуск хука); Test `frontend/tests/progress-sync.test.ts`

**Interfaces — Produces:**
```ts
export const remoteSnapshotSchema: z.ZodType<RemoteSnapshot>;
export function toRemote(state: FitState): RemoteSnapshot;             // FitState → сирі факти (kind вправи з lib/fit/exercises)
export function fromRemote(s: RemoteSnapshot): Partial<FitState>;      // для apply-remote
export function archiveSnapshot(s: ProgressSnapshot, period: "weekly" | "change", weekStart: IsoDate | null, now: string): Promise<void>;
export function useProgressSync(): void; // при старті: локальна історія порожня → GET snapshot → apply-remote; далі після змін — POST sync з debounce 3 с; помилки мовчки повторюються пізніше (офлайн-перш)
```
- `fetch("/api/progress/…")` напряму, як `lib/api/trainers.ts` (rewrite на бекенд). Демо-історію (`demo: true`) не синхронізувати й не архівувати.
- Архів: після кожної зміни стану, що змінила `snapshotHash`, — `archiveSnapshot(…, "change")` (debounce разом із sync); при першому відкритті після неділі — `weekly`-знімок за кожен завершений тиждень, якого ще немає (перевірка локальним списком надісланих тижнів у `FitState.archivedWeeks: IsoDate[]`, поле додати в Task 8). Невдале архівування повторюється пізніше; черга знімків зберігається локально (`FitState.archiveQueue`, максимум 50, найстаріші `change` відкидаються першими, `weekly` — ніколи).
- [ ] **Step 1: Тести:** `fromRemote(toRemote(state))` зберігає тренування, підходи, паузи, вагу, події; некоректна відповідь сервера відкидається zod без зміни стану; зміна стану без зміни чисел не ставить знімок у чергу; черга при переповненні відкидає найстаріші `change`, але не `weekly`; демо-історія не потрапляє в архів.
- [ ] **Step 2–4:** RED → GREEN. **Step 5:** commit `feat(progress): sync facts with platform-backend`.

## Фаза D — екрани (розділ 3 промпту, 390 px)

**Взаємодія (обов'язково, не статичні картинки):**
- **Календар:** гортання місяців кнопками «‹ ›» і свайпом вліво/вправо (pointer events, без нових бібліотек), кнопка «Сьогодні» повертає до поточного місяця; тап по дню → нижня панель (`Sheet`) з деталями: тренування (вправи, підходи, хвилини, якісне чи ні), відпочинок (зарахований чи ні й чому), пауза, пропуск; тап по колонці тижня → внесок тижня в регулярність; на головному екрані — компактна смуга поточного тижня, тап по ній відкриває календар на цьому тижні.
- **Графіки** (рекорди, вага, регулярність): перемикач періоду (4 тижні / 3 місяці / рік; понад 3 місяці — Premium), тап або перетягування по графіку показує точку з датою й значенням, кнопка «Розгорнути» відкриває графік на весь екран (`Sheet`) з тим самим перемикачем і горизонтальним гортанням, якщо точок багато.
- **Картки на головному** — клікабельні й ведуть на відповідний екран (регулярність → календар з розкладом «Як склалось», серія → календар, рівень → досягнення, рекорд → екран рекордів з цією вправою).
- Усе з клавіатури й скрінрідера: кнопки, а не `div`; свайп дублюється кнопками.

Кожен екран: скелетон до `ready`, поведінка за таблицею «Очікування по екранах» для **S0 і S2** (плюс S3–S6, де екран їх стосується), `ScreenHeader` з `back`, тексти через `useT()`, маса через `useUnits()`, графіки з `role="img"` + текстовий опис. Після кожного екрана — скриншоти на 390 px для `?scenario=S0` і `?scenario=S2` (`bun run dev`, Playwright або вручну), нічого не обрізано.

### Task 13: Головний екран Progress

**Files:** Modify `components/features/Progress/Progress.tsx` (+ нові дочірні компоненти `ProgressWeekGoal`, `ProgressScoreCards`, `ProgressLevelBar`, `ProgressHighlights`, `ProgressNavList`); `app/(app)/progress/page.tsx`

Порядок блоків — промпт, розділ 3.1: картка тижневої цілі (дні тижня: виконано / відпочинок / сьогодні / попереду, кнопка «Почати тренування» через `useStartWorkout`), дві картки «Регулярність N/100» (міні-бари 4 тижнів з `consistencyV2.weeks`) і «Серія N тижнів» (рекорд), смуга рівня й XP разом зі стрічкою «Наступні досягнення» (`nextBadges(…, 3)` з прогресом і «ще N») та «Останні отримані» (`recentBadges(…, 3)`, тап → `/progress/achievements`), «Що покращилось» (≤ 2) і «Що далі» (1 дія + кнопка), «Нові рекорди» (2 картки), список переходів: Календар, Вага, Звіт, Досягнення (+ Історія й Фото — наявні вкладки Дмитра стають пунктами списку). Картка «Звіт за тиждень готовий» зверху, якщо є непереглянута подія `report`.
- [ ] **Step 1:** тест на чисту функцію вибору «нових рекордів» (2 найсвіжіші, нові першими). **Step 2:** UI. **Step 3:** typecheck/test + скриншот (з демо-історією і з порожнім станом). **Step 4:** commit `feat(progress): main screen v2`.

### Task 14: Календар і пауза

**Files:** Create `app/(app)/progress/calendar/page.tsx`, `components/features/ProgressCalendar/*`

Місяць зі станами дня (тренування, зарахований відпочинок, пропуск за планом, пауза, сьогодні) + легенда; гортання місяців (кнопки, свайп, «Сьогодні»), тап по дню → `Sheet` з деталями дня, тап по тижню → його внесок у регулярність (див. «Взаємодія»); колонка тижня (зараховано / пауза / поточний); картка серії; «Як склалось N» — 4 тижні з вагами й значеннями з `consistencyV2.weeks`; картка «Поставити на паузу» → `Sheet` з вибором 1–4 тижнів → `add-pause`; зняття паузи через підтвердження.
- [ ] Реалізувати, тест на функцію станів дня (`calendarDayState(h, ctx, date)` у `lib/progress`), скриншот, commit `feat(progress): calendar and pause`.

### Task 15: Рекорди

**Files:** Create `app/(app)/progress/records/page.tsx`, `components/features/ProgressRecords/*`; Modify `components/features/ExerciseProgress/*` (графік e1RM, set records)

Фільтр «Усі / З вагою / Власна вага» (`SegmentedControl`); картка вправи з інтерактивним графіком e1RM (період, тап по точці, «Розгорнути»), плашкою «Звідки це число» (формула Brzycki на прикладі найкращого підходу: «32 кг × 5 → ≈ 36,0 кг») і set records 5/8/10; список рекордів: тип, дата, приріст; мітка «Нове» для непереглянутих `pr`. Відкриття екрана → `mark-seen` для `pr`.
- [ ] Реалізувати, скриншот, commit `feat(progress): records screen`.

### Task 16: Вага тіла

**Files:** Create `app/(app)/progress/weight/page.tsx`, `components/features/ProgressWeight/*`; Modify `components/features/CheckIns/*` (зважування переїжджає сюди, фото лишаються в Check-ins)

Старт, поточна, зміна; перемикач періоду (місяць / 3 місяці / рік; понад 3 місяці — `PremiumGate`); інтерактивний графік точок + 7-денне середнє (`LineChart` розширити другою серією, тапом по точці й режимом «Розгорнути», без нової бібліотеки); ІМТ зі шкалою категорій і нейтральним текстом + примітка; поле «Вага сьогодні» + «Зберегти» (`add-body-weight`, react-hook-form + zod).
- [ ] Реалізувати, скриншот, commit `feat(progress): body weight screen`.

### Task 17: Тижневий звіт v2

**Files:** Modify `components/features/WeeklyReport/*`, `app/(app)/progress/week/[week]/page.tsx`

Превʼю push-сповіщення зверху; підсумок; порівняння з минулим тижнем (тренування, хвилини, якісні підходи, XP); одне покращення й одна порада; вибір цілі на новий тиждень (2–5, рекомендована позначена) → `set-weekly-goal`. Відкриття → `mark-seen` для `report`.
- [ ] Реалізувати, скриншот, commit `feat(progress): weekly report v2`.

### Task 18: Досягнення

**Files:** Create `app/(app)/progress/achievements/page.tsx`; Modify/replace `components/features/Awards/*`

Картка рівня (назва з `LEVEL_NAMES`); таблиця «Як отримати XP» (з констант Task 3, не дублювати числа в копірайті); сітка бейджів (`BadgeIcon` з Task 18b): нові з міткою «Нове» першими, далі закриті за близькістю (`nextBadges`) з кільцем прогресу й «ще N», далі отримані з датою. Відкриття → `mark-seen` для `badge`, `level`.
- [ ] Реалізувати, скриншот, commit `feat(progress): achievements screen`.

### Task 18b: Досягнення на кожному кроці

**Files:** Modify `components/features/Today/*` (чип рівня, картка «Наступне досягнення»), `components/features/Workout/WorkoutSummary.tsx` (розклад XP, анімований рівень, просування бейджів), `components/features/Profile/*` (полиця бейджів), `components/features/WeeklyReport/*` («Отримано цього тижня», «Наступне на черзі»); Create `components/features/BadgeIcon/*` (спільний вигляд бейджа: іконка; закритий — приглушений, з кільцем прогресу й замком; отриманий — акцентний, з галочкою), `components/features/NextAchievementCard/*`. `BadgeIcon` робиться першим кроком і використовується також у Task 18 і Task 19.

**Interfaces:** Consumes `nextBadges`, `recentBadges`, `xpForSession`, `badgeProgressDelta`, `levelFor` (Task 3), `useProgress()` (Task 9), `shareText`.

Поведінка — таблиця «Видимість досягнень» у дизайн-документі (дослівно), разом із межами мотивації звідти ж.
- [ ] **Step 1:** тест на чисту функцію `nextAchievementCopy(badge: Badge): { key: string; params: Record<string, number | string> }` — «ще N тренувань / тижнів / рекордів» за типом бейджа; S0 → ще 1 тренування до `first-workout`.
- [ ] **Step 2:** UI у всіх місцях з таблиці.
- [ ] **Step 3:** typecheck/test; скриншоти 390 px для S0, S1 (перший бейдж щойно отримано) і S2 на Today, підсумку тренування, Profile і звіті.
- [ ] **Step 4:** commit `feat(progress): show achievements across the app`.

### Task 19: Підсвічування нового

**Files:** Modify `components/features/BottomNav/*`, `Celebration/*`, `Workout/*` (банер рекорду), компоненти з Task 13–18; Test `tests/progress-engine.test.ts` (доповнити)

Крапка на табі Progress при `unseen.any` + `aria-label` «Progress, new» (ключ); святкове вікно (наявний `Celebration`/`Sheet`) одне на групу з `celebrationGroup`: новий рівень — на весь екран, бейджі — bottom sheet з `BadgeIcon`; кнопки «Поділитися» (`shareText`), «Подивитись усі», «Закрити» (закриття → `mark-seen`), анімація лише без `prefers-reduced-motion`; банер «Новий рекорд» одразу після підходу в режимі тренування (порівняння з `personalRecords` до підходу); картка рівня й нові рекорди з легким акцентним підсвічуванням до перегляду.
- [ ] **Step 1: Тести (промпт 3.1):** непереглянутий звіт → `unseen.any` і картка; після `mark-seen` → обидва зникають; 2 бейджі + рівень → одна група.
- [ ] **Step 2–4:** RED → GREEN, скриншоти. **Step 5:** commit `feat(progress): highlight new badges, levels, records and reports`.

## Фаза E — локалізація, документація, перевірка

### Task 20: Українські тексти

**Передумова:** зміни користувачки в `uk.json` закомічені.
**Files:** Modify `frontend/messages/uk.json` (усі ключі `fit.progress.*`, `fit.insight.*`, нові ключі задач 9, 13–19)
- [ ] Перекласти без тиску й докорів; «≈» для оцінок; числа через `Intl.NumberFormat("uk-UA")` («76,0 кг», «1 340 XP») — перевірити утиліту форматування в `lib/fit/format.ts`, розширити за потреби. Тест: усі ключі `fit.progress` з `en.json` присутні в `uk.json`. Commit `feat(i18n): Ukrainian copy for progress`.

### Task 21: Документація і фінальна перевірка

- [ ] `docs/product/progress-rules.md`: розділ 2 промпту в остаточному вигляді (формули, приклади з тестів) + розділ «Архів знімків» (що, коли і з якою версією рушія архівується; правило «лише додавання»).
- [ ] `frontend/docs/agent/fitness-app.md`: модуль прогресу — єдине джерело; нове правило серії; синхронізація.
- [ ] `bun run typecheck`, `bun run test`, `bun run build` (в окремому worktree, щоб не зачепити dev-сервер), eslint по змінених файлах; backend `npm test`.
- [ ] Пройти всі 6 екранів + Today/Coach для кожного сценарію S0–S6 (скриншоти 390 px у PR), звірити з таблицею «Очікування по екранах».
- [ ] Пройти критерії готовності промпту (розділ 6) і анти-цілі (розділ 5).
- [ ] Commit `docs: progress rules and module notes`.
