# Модуль прогресу v2 — єдиний модуль аналітики й мотивації

Дата: 2026-11-21. **Вимоги:** [docs/product/progress-implementation-prompt.md](../../product/progress-implementation-prompt.md) (далі — «промпт»; правила й екрани беремо звідти дослівно). Дослідження: `docs/product/progress-research.updated.md`, `docs/product/progress-research-verification.md`. Попередня ітерація: [2026-11-21-progress-analytics-design.md](2026-11-21-progress-analytics-design.md).

## Навіщо

Людина має бачити прогрес і повертатися, а система не має винагороджувати бездіяльність. Зараз у застосунку два набори правил мотивації: Дмитрові (`lib/fit/stats.ts`, `lib/fit/gamification.ts`: серія в тренуваннях, свій XP і бейджі) і наш `lib/progress`. Через це числа на різних екранах можуть розходитися.

**Рішення користувача:** прогрес, уся аналітика й мотивація — **один модуль**. Він рахує регулярність, серію, тижневу ціль, XP, рівні, бейджі, рекорди, вагу, звіти, підказки та «нове». Решта застосунку (Today, Coach, сповіщення, Celebration, Profile) тільки читає з нього.

## Цілі

- Усі правила з розділу 2 промпту — чисті функції в `lib/progress` з тестами, включно з прикладами з промпту.
- Одне джерело чисел для всього застосунку. Старі розрахунки в `lib/fit/stats.ts` і `gamification.ts` видаляються або стають тонкими обгортками над `lib/progress`.
- 6 екранів з розділу 3 промпту в межах вкладки Progress, з дизайн-системи застосунку.
- Підсвічування нового (розділ 3.1 промпту).
- Безкоштовне і платне за прапорцем (розділ 4), через наявний `PremiumGate`.
- Детермінована демо-історія на 12 тижнів (розділ 1).

## Не-цілі

- Справжні push-сповіщення (тільки текст у наявній системі сповіщень, як заглушка).
- Акаунти й вхід (гостьовий користувач за `progressToken`, див. рішення 10).
- Відновлення м'язів і Training Readiness (розділ 5 промпту).
- Обчислення метрик на бекенді (бекенд лише зберігає факти).

## Анти-цілі

Усе з розділу 5 промпту. Крім того: два різні числа одного показника в застосунку; «kg», захардкоджене при виборі фунтів; українські тексти поза i18n.

## Підходи

| Підхід | Плюси | Мінуси |
|---|---|---|
| **A. Один рушій у `lib/progress`, стан у наявному `FitState`/reducer** (обрано) | Одне число скрізь; одне сховище; Today/Coach лише перемикаються на нове API | Змінює reducer і gamification Дмитра; його бейджі й XP мігрують на нові |
| B. Окремий модуль Progress з власним провайдером і сховищем | Менше правок у чужому коді | Два стани, які треба синхронізувати; ризик розбіжностей |
| C. Аналітика на бекенді | Правильно в перспективі | Немає акаунтів і синхронізації; не для хакатону |

## Рішення, ухвалені тут

1. **Архітектура A.** `lib/progress` — чистий рушій без React. `historyFromFit` (вже є) — єдиний вхід зі стану застосунку. Хук `useProgress()` у `lib/fit/store/hooks.ts` повертає все, що потрібно екранам; `useFitStats()` стає обгорткою над ним (ті самі поля для Today/Coach, нові значення).
2. **Новий стан у `FitState`:** `weeklyGoal` (2–5, за замовчуванням із `profile.daysPerWeek`, обмежене 2–5), `pauses: { from, to }[]`, `progressEvents: { id, kind: "badge" | "level" | "pr" | "report", refId, createdAt, seenAt: string | null }[]`, `bestStreak` не зберігаємо (рахується з історії). Старі збереження без цих полів отримують значення за замовчуванням при гідратації.
3. **XP не зберігається, а рахується** з історії за таблицею 2.5 промпту. `SessionLog.xp` і `state.unlocked` лишаються для сумісності, але UI бере XP і бейджі тільки з рушія. Бейджі Дмитра замінюються списком із промпту (розділ 3, «Досягнення»). Бейджі, не пов'язані з прогресом (наприклад, вода), — вирішується в плані: прибрати з досягнень.
4. **Брзицкі** замість Epley скрізь (рекорди, графіки, підказки); в UI — «≈» і «оцінка».
5. **Регулярність v2, серія в тижнях і пауза** — дослівно за 2.2–2.3 промпту. Головне число не включає поточний тиждень і змінюється лише після неділі.
6. **Одиниці:** усі масові значення виводяться через `useUnits()` (кг/фунти).
7. **Тексти:** англійською в `messages/parts/progress.json` (джерело) і українською в `messages/uk.json`. Формат чисел — за локаллю (`uk-UA` для української). **Передумова:** користувачка спершу комітить свої незакомічені зміни в `uk.json`.
8. **Мок-дані:** демо-історію Дмитра (`lib/fit/seed.ts`) розширюємо до 12 тижнів за вимогами розділу 1 промпту; `lib/api/mock/progressDb.ts` лишається тестовим фікстуром.
9. **Маршрути:** `/progress` (головний), `/progress/calendar`, `/progress/records`, `/progress/weight`, `/progress/week/[week]` (вже є), `/progress/achievements`. Вкладки Overview/History/Awards/Check-ins Дмитра: Overview стає головним екраном за промптом, History і Check-ins (фото) лишаються доступними зі списку переходів, Awards замінюється екраном «Досягнення».

10. **Зберігання в Postgres: окремі таблиці прогресу, прив'язані до `users`.** Команда вже має схему: `users`, `user_devices` (годинники Garmin/Apple), `user_trainings`, `user_device_data_snapshots`. Рішення користувачки — **окремі таблиці для прогресу**. Їхні таблиці ми не змінюємо і не перевантажуємо; наші мають префікс `user_progress_` і ключ `user_id` → `users.id` з каскадним видаленням. Стиль той самий, що в команди: Knex-міграції, Objection-моделі, Testcontainers, `bigIncrements` там, де id генерує сервер, `timestamps(true, true)`.
    - **Ідентичність без акаунтів.** Акаунтів у застосунку ще немає. Тому клієнт один раз генерує секретний `progressToken` (UUID) і зберігає його в `FitState`. Сервер знаходить користувача за цим токеном у `user_progress_settings`, а при першому зверненні створює гостьового користувача в `users`: `name = "Guest"`, `email = guest-<token>@guest.invalid`. Числовий `users.id` назовні не віддається, щоб чужі дані не можна було підібрати перебором. Коли з'являться акаунти, гість зливається зі справжнім користувачем зміною `user_id`.
    - **Сирі факти й архів знімків.** Схема зберігає сирі факти (план, тренування, підходи, паузи, зважування, події «нового»); рушій `lib/progress` рахує з них поточні числа на клієнті, тож формули живуть в одному місці. Кожен обчислений знімок архівується в `user_progress_snapshots`.
    - **Офлайн.** localStorage лишається робочим сховищем. Бекенд — синхронізація й резервна копія: клієнт надсилає зміни пакетом (ідемпотентний upsert), а при порожньому локальному стані підтягує знімок.

## Схема БД (Postgres; усі таблиці мають `user_id bigint not null references users(id) on delete cascade`)

| Таблиця | Колонки | Ключі й обмеження |
|---|---|---|
| `user_progress_settings` | `user_id` PK, `client_token` uuid, `weekly_goal` smallint, `units` text (`metric`/`imperial`), `created_at`, `updated_at` | unique `client_token`; check `weekly_goal between 2 and 5` |
| `user_progress_plan_days` | `user_id`, `date` date, `type` text (`training`/`rest`), `workout_ref` text null | PK (`user_id`, `date`) |
| `user_progress_workouts` | `id` text PK (id з клієнта), `user_id`, `training_id` bigint null → `user_trainings.id` on delete set null, `plan_date` date null, `performed_on` date, `status` text (`completed`/`partial`/`abandoned`), `planned_sets` smallint, `duration_sec` int, `perceived` text null, `adapted` boolean, `ad_hoc` boolean, `created_at` | index (`user_id`, `performed_on`) |
| `user_progress_sets` | `id` text PK, `user_id`, `workout_id` → `user_progress_workouts.id` on delete cascade, `exercise_id` text, `kind` text (`weighted`/`bodyweight`/`timed`), `reps` smallint null, `weight_kg` numeric(6,2) null, `duration_sec` int null, `completed` boolean, `performed_at` timestamptz | index (`user_id`, `exercise_id`, `performed_at`) |
| `user_progress_pauses` | `id` text PK, `user_id`, `from_date` date, `to_date` date | check `to_date >= from_date and to_date - from_date <= 27` |
| `user_progress_weights` | `user_id`, `date` date, `kg` numeric(5,2) | PK (`user_id`, `date`) |
| `user_progress_events` | `id` text PK, `user_id`, `kind` text (`badge`/`level`/`pr`/`report`), `ref_id` text, `payload` jsonb, `created_at` timestamptz, `seen_at` timestamptz null | unique (`user_id`, `kind`, `ref_id`) |
| `user_progress_snapshots` | `id` bigserial PK, `user_id`, `period` text (`weekly`/`change`), `week_start` date null, `taken_at` timestamptz, `engine_version` text, `payload` jsonb, `payload_hash` text | частковий unique (`user_id`, `week_start`) where `period = 'weekly'`; index (`user_id`, `taken_at`); append-only (коментар до таблиці, як у `user_device_data_snapshots`) |

**Архів знімків (на запит користувачки «архівувати всі снепшот-дані»).** Кожен обчислений `ProgressSnapshot` архівується в `user_progress_snapshots`. Записи **лише додаються**: рядки не оновлюються і не видаляються.
- `weekly` — один знімок на завершений тиждень, у ніч з неділі на понеділок разом із перерахунком регулярності. Повторна спроба за той самий тиждень нічого не змінює (`on conflict do nothing`).
- `change` — знімок після кожної зміни, яка змінила числа. Новий рядок пишеться, лише якщо `payload_hash` відрізняється від останнього знімка цього користувача.
- `engine_version` — версія формул рушія, тож старі знімки лишаються зрозумілими після зміни правил.

Ендпоінти (усі з заголовком `x-progress-token`, UUID, інакше 400; невідомий токен на `snapshot`/`archive GET` → порожні дані, на запис → створюється гостьовий користувач): `GET /api/progress/snapshot`, `POST /api/progress/sync`, `POST /api/progress/events/seen`, `POST /api/progress/archive`, `GET /api/progress/archive?from=&to=&period=`, `GET /api/progress/workouts?from=&to=&status=&limit=&cursor=` (історія тренувань, див. нижче). Тіло `RemoteSnapshot`: `settings` (`weeklyGoal`, `units`, `heightCm`; ключ навмисно не `device`, щоб не плутати з `user_devices` команди), `planDays`, `workouts` (з `sets`), `pauses`, `weights`, `events`; `users.id` назовні не віддається.

## Дані з Check-ins (на запит користувачки)

Модуль аналітики **зчитує все, що людина вносить у Check-ins**, і записує це:
- у знімки прогресу;
- в архів;
- у БД.

Що зчитуємо з `FitState`:

| Check-in | Поле стану | Що робимо |
|---|---|---|
| Зважування | `bodyWeights` (`date`, `kg`, `at`) | Кожен запис потрапляє в журнал check-ins. Останнє значення дня йде в `user_progress_weights` (тренд, ІМТ) |
| Цільова вага | `goalWeightKg`, `goalSetAt` | Запис у журналі, коли ціль змінюється. У знімку — «до цілі N кг» |
| Фото прогресу | `photos` (`id`, `date`, `weightKg?`) | **Лише метадані**: дата і вага на момент фото. Зображення (`dataUrl`) **ніколи не надсилається** — це обіцянка в інтерфейсі Check-ins |

**Рушій.**
- `History` отримує поле `checkIns: CheckIn[]`, де `CheckIn = { id, kind: "weight" | "goal" | "photo", date, at, weightKg?, goalKg? }`. Його заповнює `historyFromFit`.
- `ProgressSnapshot` отримує блок `checkIns`:
  - `lastWeighIn`;
  - `weighInsThisWeek`;
  - `weighInsLast4Weeks`;
  - `photos`;
  - `lastPhotoDate`;
  - `goalKg`;
  - `toGoalKg`.

  Тож у кожному архівному знімку видно й регулярність самих check-ins.

**БД.** Нова таблиця `user_progress_checkins` (окрема, як і решта таблиць прогресу):

| Колонки | Ключі й обмеження |
|---|---|
| `id` text PK (id з клієнта), `user_id` → `users` on delete cascade, `kind` text (`weight`/`goal`/`photo`), `date` date, `taken_at` timestamptz, `weight_kg` numeric(5,2) null, `goal_kg` numeric(5,2) null, `created_at` | check на `kind`; index (`user_id`, `taken_at`); жодних колонок для зображень |

Синхронізація (`POST /api/progress/sync`, `GET /api/progress/snapshot`) отримує масив `checkIns`.

## Історія тренувань (API модуля аналітики)

Модуль аналітики **віддає історію тренувань** окремим ендпоінтом, щоб екрани (History, Coach, звіти) не тягнули весь `snapshot`.

`GET /api/progress/workouts` (заголовок `x-progress-token`, як і решта):

| Параметр | Що робить |
|---|---|
| `from`, `to` | Межі за `performedOn`, включно (`YYYY-MM-DD`) |
| `status` | `completed` / `partial` / `abandoned` |
| `limit` | 1–200, за замовчуванням 50 |
| `cursor` | Непрозорий курсор з попередньої сторінки (`nextCursor`) |

Відповідь: `{ workouts: HistoryWorkout[], nextCursor: string | null }`.
- Порядок: від найновішого (`performedOn` desc, далі `id` desc). Пагінація keyset, тож вставки між запитами не дублюють і не гублять записи.
- `HistoryWorkout` = `WorkoutDto` (усі поля з `sync`, разом із `sets`) + `summary`:
  - `totalSets`, `completedSets`, `plannedSets`;
  - `exercises` — унікальні вправи в порядку виконання;
  - `volumeKg` — сума повтори × вага лише по виконаних підходах з вагою;
  - `durationSec`.
- Лише свої тренування; `users.id` назовні не віддається. Невідомий токен → порожня сторінка, користувач не створюється.
- Некоректні параметри або курсор → 400.

## Видимість досягнень (максимальна мотивація)

Досягнення мають бути **видно на кожному кроці**, а не лише на екрані «Досягнення». Людина завжди бачить, що вже отримала, що отримає наступним і скільки до цього лишилось.

| Де | Що показуємо |
|---|---|
| **Today** | Чип рівня в шапці. Картка «Наступне досягнення»: найближчий бейдж, прогрес-бар і «ще 1 тренування». Тап відкриває «Досягнення» |
| **Підсумок тренування** (`WorkoutSummary`) | Розклад зароблених XP (+80 за тренування, +25 за рекорд) з анімованим заповненням рівня. Бейджі, що просунулися («Ідеальний тиждень: 2/3»). Отримані бейджі й новий рівень — одразу святкове вікно |
| **Головний Progress** | Під тижневою ціллю: смуга рівня і стрічка «Наступні досягнення» (3 найближчі з прогресом) та «Останні отримані» (3 іконки). Тап відкриває «Досягнення» |
| **Досягнення** | Закриті бейджі відсортовані за близькістю до отримання, з кільцем прогресу й «ще N». Отримані — з датою. Нові — першими, з міткою «Нове» |
| **Святкове вікно** | Новий рівень: на весь екран, з назвою рівня й XP. Бейджі: bottom sheet, усе одним вікном. Кнопки «Поділитися» (наявний `shareText`), «Подивитись усі», «Закрити» |
| **Тижневий звіт** | «Отримано цього тижня» (бейджі, рівень) і «Наступне на черзі» |
| **Profile** | Полиця бейджів: 3 останні, лічильник «N з M», тап відкриває «Досягнення» |
| **Нижня навігація** | Крапка на табі Progress, поки нове не переглянуто (вже в плані) |

**Вигляд бейджа:** у кожного своя іконка (Hugeicons або `SportIcon`). Закритий бейдж приглушений, з кільцем прогресу. Отриманий — в акцентному кольорі теми. Колір не єдина ознака: є ще іконка-замок або галочка й текст.

**Межі мотивації (анти-цілі лишаються):**
- жодного бейджа чи XP за бездіяльність;
- жодних «ти втратиш серію!» і таймерів-страшилок;
- підказка «ще N» лише про досяжне в межах плану, без тиску тренуватися понад план;
- анімації вимикаються з `prefers-reduced-motion`;
- щонайбільше одне святкове вікно за сесію (події групуються).

## На розсуд того, хто будує

Розбиття компонентів, анімації святкового вікна (з урахуванням `prefers-reduced-motion`), назви рівнів (у конфігу), точне розташування мітки «Нове».

## Відкриті питання (не блокують план)

- Узгодити з Дмитром заміну його правил (рішення ухвалила користувачка).
- Остаточний поділ «безкоштовне / платне» — продукт (у коді — прапорець).
