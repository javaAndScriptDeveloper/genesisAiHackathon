# Аналітика та хуки утримання

Що треба побудувати, щоб (1) користувач повертався до застосунку через корисні хуки, а не через спам, і (2) ми бачили в Amplitude, чи ці хуки працюють.

Документ спирається на продуктовий контекст у [README](../../README.md): North Star, ключові метрики, гейміфікацію (4.7), сповіщення (4.8) і прогрес (4.9).

---

## 1. Що вимірюємо

**North Star:** кількість якісно завершених запланованих тренувань на активного користувача за тиждень.

Щоб цю метрику можна було порахувати, треба домовитися про визначення:

| Термін | Визначення |
|---|---|
| Якісно завершене тренування | Тренування з плану (не довільне), виконано ≥ 70 % запланованих підходів, сесія завершена кнопкою «Завершити», а не закинута. Тренування, скорочене через адаптацію («важко», «є 20 хв»), теж зараховується, якщо виконано ≥ 70 % *скоригованого* плану. |
| Активний користувач (тиждень) | Мав хоч одну змістовну дію: почав тренування, відмітив день відновлення, переглянув прогрес або написав тренеру. Просто відкриття застосунку не рахується. |
| Активація | Завершив перше тренування протягом 72 год після реєстрації. |
| Plan Adherence | Виконані заплановані тренування + дотримані дні відновлення, поділені на всі заплановані дні тижня. |
| Consistency Score | Adherence за останні 4 тижні з більшою вагою для свіжих тижнів (0–100). Показуємо користувачу. |
| D7 / D30 Retention | Користувач, що мав змістовну дію на 7-й / 30-й день (вікно ±1 день) після реєстрації. |

Воронка до підписки (з розділу 8 README):

```
Реєстрація → Onboarding завершено → План отримано → Перше тренування почато
→ Перше тренування завершено (активація) → 2-й тиждень з ≥ 2 тренуваннями
→ Paywall побачено → Підписка → Продовження
```

---

## 2. Хуки: цикл Trigger → Action → Reward → Investment

Кожен хук нижче має всі чотири частини. Якщо якоїсь бракує, хук не утримує.

### Хук 1. «Сьогоднішнє тренування» (головний щоденний цикл)

| Етап | Що бачить користувач | Функціонал, який потрібен |
|---|---|---|
| Trigger (зовнішній) | Push у зручний час: «Сьогодні 25 хв на ноги. Готові о 19:00?» | Розклад тренувань, вибір часу нагадування в onboarding, планувальник push |
| Trigger (внутрішній) | Звичка: «ввечері тренуюсь» | Стабільний час, однаковий ритуал старту |
| Action | Один тап «Почати» на Today | Картка Today з кнопкою старту, без зайвих кроків |
| Reward | Екран завершення: XP, прогрес тижневої цілі, «що покращилось» (новий рекорд, +1 повтор) | Розрахунок XP, порівняння з минулою сесією, анімація святкування |
| Investment | Оцінка складності («легко / нормально / важко») | Форма RPE після тренування, яка змінює наступне тренування |

**Чому повертається:** наступне тренування стає «його», бо враховує відповідь.

### Хук 2. Streak і Consistency Score (тижневий цикл)

- **Trigger:** «Залишилось 1 тренування до тижневої цілі».
- **Action:** виконати заплановане тренування *або* відмітити день відновлення.
- **Reward:** streak росте, бейдж тижня, підсумок неділі.
- **Investment:** накопичений streak, який не хочеться втрачати.

Обов'язкові правила (з README 4.7):
- Streak рахується в **тижнях виконаного плану**, а не в днях поспіль. Дні відновлення зараховуються.
- **Streak freeze**: 1 «заморозка» на місяць (хвороба, поїздка). Бонусна — за 4 тижні поспіль.
- Тренування понад план не дає додаткових XP понад денний ліміт, щоб не заохочувати перевантаження.

### Хук 3. Видимий прогрес (змінна винагорода)

Змінна винагорода (те, чого користувач не може передбачити) — найсильніший елемент циклу. Для нас це:
- **Особисті рекорди** (вага, повтори, час) — з'являються зненацька під час тренування.
- **Інсайт тренера** після сесії: «Присідання +10 % ваги за 3 тижні».
- **Milestones**: 1-ше, 10-те, 50-те тренування, перший місяць.
- **Achievements** з частково прихованими умовами.

Потрібно: історія підходів і ваги по кожній вправі, детектор PR, генерація короткого інсайту (AI, без акценту на AI в UI).

### Хук 4. Тижневий звіт (недільний цикл)

- **Trigger:** push/лист у неділю ввечері «Ваш тиждень: 3 з 3 тренувань».
- **Action:** відкрити звіт.
- **Reward:** підсумок, порівняння з минулим тижнем, рекорди.
- **Investment:** підтвердити або змінити план наступного тижня (кількість днів, тривалість).

Це головна точка, де користувач **сам планує** наступний тиждень, тож з'являється зобов'язання.

### Хук 5. Personal Coach (пам'ять і стосунки)

- **Trigger:** проактивне повідомлення тренера («Учора було важко. Сьогодні зробимо легше?») або власна потреба.
- **Action:** запитання текстом/голосом.
- **Reward:** конкретна дія (план змінено), а не просто відповідь.
- **Investment:** тренер «пам'ятає» обмеження, обладнання, вподобання. Що більше вкладено, то дорожче йти.

### Хук 6. Weekly Challenge (новизна)

Персональний виклик на тиждень у межах можливостей («+2 повтори у віджиманнях», «3 тренування до 20:00»). Дає новизну, коли основний цикл приїдається (зазвичай після 3–4 тижнів).

### Хук 7. Повернення після пропуску (win-back)

- Пропуск 1 тренування → м'яке нагадування наступного дня з варіантом коротшої версії (15 хв).
- 7 днів без дій → «Почнемо з легкого тренування повернення?» + план автоматично знижує навантаження.
- Ніяких докорів і «ви втратили streak!» у тексті.

### Захисні правила для всіх хуків

- Максимум 1 push на день, тихі години, частота налаштовується.
- Біль, запаморочення → тренування зупиняється; така сесія не знижує streak.
- Розраховуємо долю відписок від push (opt-out rate) як guardrail-метрику кожного хука.

---

## 3. Функціонал, який потрібен для хуків

| # | Функція | Для яких хуків | MVP хакатону |
|---|---|---|---|
| 1 | Розклад тренувань + вибір часу нагадування в onboarding | 1, 2, 4 | ✅ |
| 2 | Екран завершення тренування (XP, прогрес тижня, «що покращилось») | 1, 3 | ✅ |
| 3 | Оцінка складності після тренування, що адаптує наступне | 1, 5 | ✅ |
| 4 | Тижнева ціль і streak у тижнях, дні відновлення зараховуються | 2 | ✅ |
| 5 | Історія підходів/ваги + детектор особистих рекордів | 3 | ✅ (демо-дані) |
| 6 | XP / рівні, milestones, 5–10 achievements | 2, 3 | ✅ |
| 7 | Тижневий звіт з плануванням наступного тижня | 4 | ✅ (екран, без розсилки) |
| 8 | Coach з діями над планом | 5 | ✅ |
| 9 | Push-сповіщення (web push / PWA) з налаштуваннями та тихими годинами | 1, 2, 4, 7 | Демо-показ у UI |
| 10 | Streak freeze | 2 | Пізніше |
| 11 | Weekly Challenges | 6 | Пізніше |
| 12 | Win-back сценарії | 7 | Пізніше |
| 13 | Шеринг досягнень | 3 | Пізніше |
| 14 | Подієва аналітика (розділ 4) | усі | ✅ |

---

## 4. Tracking plan (Amplitude)

Назви: `object_action` у snake_case, минулий час. Властивості — snake_case.

### 4.1. Onboarding і активація

| Подія | Коли | Ключові властивості |
|---|---|---|
| `signup_completed` | Створено акаунт | `method` (email/google/apple), `utm_source`, `utm_campaign` |
| `onboarding_step_completed` | Кожен крок анкети | `step_name`, `step_index`, `answer` (без медичних деталей) |
| `onboarding_completed` | Анкету завершено | `goal`, `level`, `location`, `equipment_count`, `days_per_week`, `duration_min`, `has_wearable`, `time_spent_sec` |
| `plan_generated` | План готовий | `plan_id`, `weeks`, `workouts_per_week`, `generation_ms` |
| `plan_viewed` | Користувач подивився план | `source` (onboarding/today/training) |

### 4.2. Тренування (ядро North Star)

| Подія | Коли | Ключові властивості |
|---|---|---|
| `workout_started` | Тап «Почати» | `workout_id`, `plan_id`, `is_planned`, `scheduled_date`, `planned_duration_min`, `exercise_count`, `source` (today/push/coach/calendar) |
| `exercise_started` | Початок вправи | `exercise_id`, `position`, `video_shown` |
| `exercise_video_played` | Запуск відео техніки | `exercise_id`, `watch_sec` |
| `set_completed` | Завершено підхід | `exercise_id`, `set_index`, `reps`, `weight_kg`, `duration_sec` |
| `exercise_skipped` | Пропуск вправи | `exercise_id`, `reason` |
| `exercise_swapped` | Заміна вправи | `from_exercise_id`, `to_exercise_id`, `initiator` (user/coach/adaptive) |
| `workout_paused` / `workout_resumed` | Пауза / продовження | `workout_id`, `pause_sec` |
| `adaptation_requested` | «Надто важко», «Втомився», «Більше відпочинку», «Скоротити» | `type`, `exercise_id`, `option_chosen` |
| `safety_stop_triggered` | Біль, запаморочення | `symptom_type` (категорія, без вільного тексту) |
| `workout_completed` | Завершено | `workout_id`, `duration_min`, `sets_done`, `sets_planned`, `completion_pct`, `is_quality` (≥ 70 %), `was_adapted`, `xp_earned` |
| `workout_abandoned` | Вихід без завершення | `workout_id`, `last_exercise_position`, `completion_pct` |
| `workout_rated` | Оцінка складності | `workout_id`, `rpe` (easy/ok/hard), `mood` |
| `recovery_day_logged` | Відмічено день відновлення | `scheduled_date` |
| `workout_rescheduled` | Перенесено | `from_date`, `to_date`, `initiator` |

### 4.3. Гейміфікація і прогрес

| Подія | Ключові властивості |
|---|---|
| `xp_earned` | `amount`, `source`, `level_after` |
| `level_up` | `new_level` |
| `streak_extended` | `streak_weeks` |
| `streak_broken` | `previous_streak_weeks`, `freeze_available` |
| `streak_freeze_used` | `streak_weeks` |
| `achievement_unlocked` | `achievement_id`, `category` |
| `personal_record_set` | `exercise_id`, `metric` (weight/reps/time), `improvement_pct` |
| `weekly_goal_completed` | `workouts_done`, `goal` |
| `progress_viewed` | `tab` (calendar/records/body/achievements) |
| `weekly_report_viewed` | `week`, `source` (push/home) |
| `next_week_plan_confirmed` | `changed` (bool), `days_per_week`, `duration_min` |
| `challenge_joined` / `challenge_completed` | `challenge_id`, `type` |
| `achievement_shared` | `achievement_id`, `channel` |

### 4.4. Coach

| Подія | Ключові властивості |
|---|---|
| `coach_opened` | `source` (tab/workout/push) |
| `coach_message_sent` | `input` (text/voice), `intent` (класифікований: replace_exercise, short_on_time, tired, why_progress…), `context_screen` |
| `coach_action_applied` | `action_type` (plan_changed/exercise_replaced/rest_suggested), `accepted` |
| `coach_proactive_shown` | `trigger` (hard_workout/missed/pr) |
| `ai_request_completed` | `feature` (coach/plan/insight), `model`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms` — **серверна подія** для метрики AI Cost per Active User |

Текст повідомлень у Amplitude **не відправляємо**, лише класифікований `intent`.

### 4.5. Сповіщення

| Подія | Ключові властивості |
|---|---|
| `push_permission_prompted` / `push_permission_granted` | `context` |
| `notification_sent` | `type` (reminder/missed/achievement/weekly_report/coach/winback), `campaign_id` — **серверна** |
| `notification_opened` | `type`, `campaign_id`, `minutes_since_sent` |
| `notification_settings_changed` | `type`, `enabled`, `quiet_hours` |

### 4.6. Монетизація

| Подія | Ключові властивості |
|---|---|
| `paywall_viewed` | `trigger` (feature_gate/after_nth_workout/weekly_report), `variant` |
| `trial_started` | `plan` (monthly/yearly), `price`, `currency` |
| `subscription_started` / `subscription_renewed` / `subscription_cancelled` | `plan`, `price`, `cancel_reason` — **серверні** (з вебхуків оплати) |

### 4.7. User properties

`goal`, `level`, `location`, `days_per_week`, `has_wearable`, `subscription_status`, `current_level`, `streak_weeks`, `total_workouts`, `consistency_score`, `signup_date`, `push_enabled`, `locale`.

### 4.8. Чого не відправляємо в Amplitude

Медичні обмеження, симптоми вільним текстом, пульс та інші дані з Garmin/Apple Health, фото прогресу, вагу тіла, текст чату з тренером. Це персональні дані про здоров'я: вони залишаються в нашій БД. В аналітику йдуть лише агреговані або категоріальні значення (наприклад `has_wearable`, `symptom_type`).

---

## 5. Дашборди

1. **North Star**: якісні заплановані тренування / WAU по тижнях, розбивка за `goal` і `level`.
2. **Activation funnel**: `signup_completed` → `onboarding_completed` → `plan_generated` → `workout_started` → `workout_completed` (вікно 72 год). Де відвал по кроках onboarding.
3. **Retention**: D1/D7/D30 когорти за тижнем реєстрації; окремо для тих, хто активувався і хто ні.
4. **Ефективність хуків**:
   - Push: open rate за `type`, частка `workout_started` з `source = push` протягом 2 год, opt-out rate.
   - Streak: retention W4 у користувачів зі streak ≥ 2 vs без.
   - Прогрес: retention тих, хто отримав `personal_record_set` у перші 2 тижні.
   - Coach: retention тих, хто мав `coach_action_applied` vs ні.
   - Тижневий звіт: частка `next_week_plan_confirmed` і adherence наступного тижня.
5. **Якість тренувань**: `completion_pct`, частка `workout_abandoned` і на якій вправі, топ `exercise_skipped` / `exercise_swapped`, частота `adaptation_requested` за вправою (сигнал, що вправа погано підібрана).
6. **Безпека**: `safety_stop_triggered` на 100 тренувань — guardrail, не має рости.
7. **Монетизація**: paywall → trial → підписка за `trigger`; churn за когортами; AI cost на активного користувача.

---

## 6. Перші експерименти

| Гіпотеза | Метрика | Guardrail |
|---|---|---|
| Час нагадування, обраний в onboarding, збільшує старт тренувань порівняно з фіксованим 18:00 | `workout_started` з push / надіслані push | opt-out rate |
| Екран «що покращилось» після тренування підвищує D7 | D7 retention | — |
| Streak у тижнях (з днями відновлення) vs у днях | W4 retention, adherence | `safety_stop_triggered`, тренування понад план |
| Paywall після 3-го завершеного тренування vs одразу після onboarding | trial start, D30 | активація |

---

## 7. Технічна реалізація

**Клієнт (frontend, Next.js):**
- Модуль `lib/analytics/` з одною функцією `track(event, props)` та React-хуком `useTrack()`. Компоненти не викликають SDK Amplitude напряму, тож постачальника можна змінити в одному місці.
- Типізований каталог подій: `type AnalyticsEvent = { name: 'workout_completed'; props: {...} } | ...`. TypeScript не дасть надіслати подію з помилкою в назві чи без обов'язкової властивості.
- `identify(userId, userProps)` після входу, `reset()` після виходу. До реєстрації — анонімний device id, який зливається з user id.
- Автоматичний `screen_viewed` у layout за зміною маршруту.
- Згода на аналітику (cookie/consent) до ініціалізації SDK.
- У dev-режимі події пишуться в консоль, а не в Amplitude.

**Сервер (platform-backend):**
- Серверні події, які не можна довіряти клієнту або які відбуваються без клієнта: `notification_sent`, `subscription_*`, `ai_request_completed`, обчислення `workout_completed.is_quality`, streak, XP. Через Amplitude HTTP API.
- Таблиця `events` у Postgres як джерело правди для гейміфікації (streak, XP, PR рахуються з наших даних, а не з Amplitude).

**Для хакатону мінімум:** `track()` + `useTrack()`, типізований каталог із подіями розділів 4.1–4.3, Amplitude у frontend, дашборди 1–3.

---

## 8. Відкриті питання

- Поріг «якісного» тренування: 70 % підходів чи інший? Перевірити на перших даних.
- Web push у PWA на iOS працює лише після додавання на головний екран. Чи робимо email як резервний канал для тижневого звіту?
- Чи рахувати довільні (не заплановані) тренування в Activation?
- Яка ціна і коли показувати paywall у MVP?
