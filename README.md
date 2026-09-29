# Отбор судей — фронтенд v2

SPA на Angular 21 для бэкенда v2 (`e-judge-selection-backend-2`, шлюз `/v1/**`). Проект собран по документу
[«Front v2 — техническая документация»](https://claude.ai/artifact/VaMWEdnjjAwRH53AXyv3Ka): тот же стек, послойная
структура, экраны по доменам вместо копий по ролям, доступ по группам бэкенда.

## Запуск

```bash
npm ci                     # без legacy-peer-deps
npm start                  # http://localhost:4000, /v1 проксируется на шлюз (proxy.conf.json)
npm test                   # unit: Vitest через ng test
npm run e2e                # Playwright: поднимает ng serve, шлюз мокается в тестах
npm run lint               # ESLint + правило слоёв (eslint-plugin-boundaries)
npm run typecheck          # app + spec + e2e
npm run build:production
```

Dev-прокси смотрит на локальный шлюз `http://localhost:8080`. Для стенда поменяйте `target` в `proxy.conf.json`.
На стенде e2e запускаются с `E2E_BASE_URL=<адрес фронта>` — тогда выполняются и сценарии `@stand`.

## Структура

Слой импортирует только слои ниже: `app → flows → features → domain → shared`. Нарушение — ошибка линтера.

```
src/
  app/                 # app.config, app.routes, тема PrimeNG, title strategy
  flows/               # страницы (lazy) по доменам, а не по ролям
    cabinet/           # было flows/application
    administrative/    # было flows/admin + areas/{chairman,board-member,secretary}
    testing/           # было flows/test
    errors/            # /forbidden, 404
    screen.ts          # экран карты маршрутов: доступ + список API (заглушка до переноса)
  features/            # application-wizard, oep-signing, notifications
  domain/
    api/               # *.schema.ts (типы) + сервис на каждый контроллер v2
    stores/            # сигнальные сторы: уведомления, справочники
  shared/
    api/               # interceptors, CSRF, ошибки, SSE
    auth/              # сессия, группы доступа, guards, *appAccess
    ui/                # shell-layout, таблица, заглушка экрана, тосты
    lib/               # даты, валидаторы, языки, safeHtml, скачивание
    config/            # environment: API '/v1', AUTH_API '/v1/auth'
public/locales/        # словари ru/kg: shell, profile + 11 неймспейсов v1
scripts/               # schema-from-java.mjs — временная генерация типов
e2e/                   # Playwright
```

Алиасы путей: `@app/*`, `@flows/*`, `@features/*`, `@domain/*`, `@shared/*`.

## Типы API

`src/domain/api/api.schema.ts` и `auth.schema.ts` имеют форму `openapi-typescript` (`components['schemas']`).
Сервисы используют их через `Schemas['ContestResponse']` из `api.types.ts`.

- `npm run api:gen` — основной путь: генерация из OpenAPI шлюза (`GATEWAY=https://… npm run api:gen`).
- `npm run api:java` — временный путь, пока стенд недоступен: читает Java records и enums из исходников бэкенда
  (`BACKEND_DIR`, по умолчанию `../../IdeaProjects/e-judge-selection-backend-2`). После перехода на `api:gen`
  сервисы менять не нужно.

## Ключевые решения

| Что             | Где                                                   | Как                                                                                                                                                                        |
| --------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Группы доступа  | `shared/auth/access-groups.ts`                        | Копия `AccessGroups.java`; маршрут `canMatch: [access('BOARD')]`, шаблон `*appAccess="'SECRETARY'"`                                                                        |
| Множество ролей | `shared/auth/areas.ts`                                | Токен этапа → `/testing`; есть `STAFF` → `/administrative`; иначе `/cabinet`; при обеих группах — переключатель в шапке                                                    |
| Сессия          | `shared/auth/session.service.ts`                      | Единственное место с токеном; таймер `expiresIn` (предупреждение за 5 мин); выход — `POST /v1/auth/logout` + выход из ЕСИА; ключи v1 в `localStorage` удаляются при старте |
| Запросы         | `shared/api/interceptors.ts`                          | Bearer только к `/v1`; CSRF double-submit с запросом токена и одним повтором после 403; 401 → выход; тост с сообщением и кодом ошибки                                      |
| SSE             | `shared/api/sse.service.ts`                           | Одно соединение на вкладку, `?access_token=`, переподключение с паузой 1→30 с, остановка на 4136                                                                           |
| Уведомления     | `domain/stores/notifications.store.ts`                | Загрузка + перезапрос по событию `notification` вместо опроса каждые 30 с                                                                                                  |
| Личное дело     | `features/application-wizard`                         | Один компонент «список + форма» по конфигурации разделов `/v1/candidate/sections/{SECTION}`                                                                                |
| ОЭП             | `features/oep-signing`                                | `session` → способ → `send-pin` → `authenticate` → `sign`                                                                                                                  |
| Таблицы         | `shared/ui/data-table`                                | Единственная обёртка над `@reforgium/data-grid` + пагинатор PrimeNG                                                                                                        |
| Безопасность    | `docker/default.conf`, `shared/lib/safe-html.pipe.ts` | CSP (скрипты только свои), HTML — через DOMPurify, без `bypassSecurityTrustHtml`; `returnUrl` — только внутренние пути                                                     |

Адреса входа не меняются с v1: `/cabinet/sign-in` (ЕСИА, сюда же возвращается `?code=&state=`),
`/administrative/sign-in` (логин и пароль), `/testing/sign-in` (код этапа).

## Статус переноса

Готово: каркас, сборка, CI, слой API (все контроллеры v2), вход тремя способами, сессия, группы доступа, SSE,
уведомления, дашборд, диалог ОЭП.

Кабинет кандидата (`/cabinet`) перенесён:

| Экран                                                                          | Маршрут                               | Где                                                                  |
| ------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------- |
| Личное дело: личные данные, разделы, импорт дипломов и кадастра, заполненность | `/cabinet/profile`                    | `features/personal-data`, `features/application-wizard`              |
| Конкурсы: список, карточка, подача заявки                                      | `/cabinet/contests`, `/:id`           | `flows/cabinet/pages/contests`, `features/contest-card`              |
| Мои заявки: список, карточка, история, действия по статусу, SSE                | `/cabinet/applications`, `/:id`       | `flows/cabinet/pages/applications`, `features/application-status`    |
| Мастер заявки: контакты, личное дело, анкета, документы, отправка              | `/cabinet/applications/:id/edit`      | `flows/cabinet/pages/application-edit`, `features/application-draft` |
| Вакансии и предложения из резерва                                              | `/cabinet/vacancies`                  | `flows/cabinet/pages/vacancies`                                      |
| Резерв                                                                         | `/cabinet/reserve`                    | `flows/cabinet/pages/reserve`                                        |
| Жалобы                                                                         | `/cabinet/complaints`                 | `flows/cabinet/pages/complaints`                                     |
| Результаты и разбивка баллов                                                   | `/cabinet/results`                    | `flows/cabinet/pages/results`, `features/rating`                     |
| Подтверждение статуса судьи                                                    | `/cabinet/judge-confirmation`         | `flows/cabinet/pages/judge-confirmation`                             |
| Заявки действующего судьи (ACTIVE_JUDGE)                                       | `/cabinet/judge-applications`, `/:id` | `flows/cabinet/pages/judge-applications`                             |

Экраны `/administrative` и `/testing` подключены через `screen()` в `*.routes.ts`: доступ уже как в v2, вместо
контента — заглушка со списком маршрутов API. Перенос экрана = замена `loadComponent` на страницу.

Ещё не сделано: TinyMCE и Chart.js (подключить вместе с экранами, где они нужны), e2e-сценарии на стенде
(`e2e/auth.spec.ts`, `test.fixme`).

### Что попросить у бэкенда

- `vacancyName` в `VacancyApplicationResponse`: кандидату недоступен `GET /vacancy/{id}`, в откликах видно «Вакансия № id».
- `GET /judge-applications/{id}` для владельца (сейчас только сотрудникам) — карточка ищет заявку в `/my`.
- Вложения в жалобах: в `SubmitComplaintRequest` нет файла.
- Файл объявления о конкурсе (`CONTEST_ANNOUNCEMENT`) кандидату недоступен: у него нет владельца, и `FileAccessPolicy.requireReadable`
  отдаёт его только сотрудникам (403, 4316). Нужно разрешить чтение публичных категорий любому авторизованному или
  дать скачивание через конкурс; до этого карточка конкурса не показывает ссылку на объявление.
- Веса этапов и проходной балл для кандидата: значения по умолчанию из `ScoringProperties` зашиты на фронте;
  срок жалобы на этап документов (3 дня) — тоже.

## Отличия от документа

- `@ss/angular-common-kit` не подключён. i18n в v1 шёл через `@reforgium/presentia`, которую kit оборачивал, —
  v2 использует её напрямую. Иконки — PrimeIcons, тосты — `NotifyService` поверх PrimeNG. Приватный registry
  не нужен; шаблон для него — в `.npmrc`.
- Tailwind 4: брейкпоинты и токены — в `@theme` в `src/styles.css`, отдельного `tailwind.config.js` нет.
- Несколько связанных контроллеров сведены в один сервис (`ComplaintsApi` = жалобы + рассмотрение,
  `VacanciesApi` = вакансии + отклики, `JudgeApplicationsApi` = заявки судей + подтверждение статуса).
- Префикс алиасов `@`: без него `domain/...` совпадает с core-модулем Node `domain`, и правило слоёв
  его не проверяет.

## Открытые вопросы

- Адрес шлюза тестового стенда v2 — для dev-прокси, e2e и `api:gen`.
- `ESIA_REDIRECT_URI` бэкенда должен указывать на `https://<домен>/cabinet/sign-in`.
- 14 маршрутов v1 без аналога в v2 (раздел 3 документа) — решение с командой бэкенда до переноса экранов.
- Нужен ли httpOnly-cookie вместо Bearer-токена; тестовые учётки ЕСИ и ОЭП для e2e.
- Показ двух кабинетов для ролей Совета и кандидата: сейчас — переключатель в шапке.
