# Интеграция фронтенда с бэкендом Тандоо v2

Документ для разработчиков клиента. Описывает, как шлюз обрабатывает запрос (аутентификация, CSRF, CORS, заголовки, лимиты), формат ошибок, SSE, файлы, пагинацию и полный перечень маршрутов трёх сервисов.

Источник истины — код в `gateway/`, `common/`, `auth-service/`, `api-service/`, `audit-service/` и OpenAPI по адресу `/swagger-ui.html` на шлюзе. При расхождении верить коду и OpenAPI.

---

## 1. Топология и базовый URL

Клиент общается **только со шлюзом** (`gateway`, порт 8080 в compose). Внутренние сервисы снаружи недоступны.

| Префикс пути | Куда уходит |
|---|---|
| `/v1/events/**` | api-service (SSE, отдельный таймаут 660 с) |
| `/v1/auth/**`, `/v1/users/**`, `/.well-known/**` | auth-service |
| `/v1/audit/**` | audit-service |
| `/v1/**` (всё остальное) | api-service |
| `/docs/auth/**`, `/docs/api/**`, `/docs/audit/**` | OpenAPI соответствующего сервиса (rewrite на корень) |
| `/v1/csrf` | обрабатывает сам шлюз |
| `/swagger-ui.html`, `/actuator/health/**` | сам шлюз |

Любой путь, содержащий сегмент `internal` (`/internal/**`, `/v1/internal/**`, `/x/internal/**`, регистр не важен, после percent-decoding), шлюз отвечает **404** до маршрутизации. Это служебный контур, снаружи его нет.

---

## 2. Порядок обработки запроса на шлюзе

Фильтры в порядке выполнения. Каждый может завершить запрос.

| # | Фильтр | Что делает | Отказ |
|---|---|---|---|
| 1 | `TraceIdFilter` | Берёт `X-Trace-Id` от клиента, если он подходит под `^[A-Za-z0-9-]{8,64}$`, иначе генерирует UUID без дефисов. Пишет его в запрос вниз и в ответ клиенту. | — |
| 2 | `InternalPathBlockFilter` | Блокирует пути с сегментом `internal`. | 404, пустое тело |
| 3 | `CsrfFilter` | Double-submit проверка для небезопасных методов. | 403 `{reason, traceId}` |
| 4 | CORS (`CorsWebFilter`) | Preflight и заголовки CORS. | 403 без тела при чужом Origin |
| 5 | `JwtAuthenticationFilter` | Проверяет JWT, чёрный список, пишет `X-User-*`. Публичные пути пропускает. | 401 `4010` / 401 `4317` |
| 6 | `SseRateLimitFilter` | Только `/v1/events/**`: лимит подписок и одновременных соединений. | 429 `4301` / 429 `4136` |
| 7 | `InternalKeyFilter` | Добавляет `X-Internal-Key` для внутреннего сервиса. | — |

Затем сервис (`GatewayContextFilter` в `common`) проверяет `X-Internal-Key`, строит контекст пользователя из `X-User-*`, применяет `@PreAuthorize` по группам доступа и, для ролей Совета, рабочее окно.

---

## 3. Аутентификация (JWT)

### 3.1 Как получить токен

Три публичных входа, все возвращают одинаковый `TokenResponse`:

| Способ | Запрос | Кто |
|---|---|---|
| Пароль | `POST /v1/auth/login` `{username, password}` | роли Совета, админы |
| ЕСИА (PKCE) | `GET /v1/auth/esia/start` → редирект на `authorizationUrl` → `POST /v1/auth/esia/exchange` `{code, state}` | кандидаты, судьи |
| Одноразовый код этапа | `POST /v1/auth/otp-login` `{code}` (6 символов) | кандидат на тесте/эссе, «stage-токен» |

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 21600,
  "user": { "id": 1, "username": "…", "fullName": "…", "roles": ["SECRETARY"], "role": "SECRETARY", "language": "RU" }
}
```

- `roles` — множество ролей (Р4). `role` — legacy одиночное значение, для старого клиента. Новый код — только `roles`.
- Токен приходит **только в теле**. Cookie сессии нет. Хранение — задача клиента (память/`sessionStorage`).
- **Refresh-токена нет.** Истёк — логин заново. TTL: обычный 6 ч (`JWT_TTL`), stage-токен 4 ч (`JWT_STAGE_TTL`). `expiresIn` в секундах.
- Регистрация `POST /v1/auth/register` — только для белого списка ролей (по умолчанию CHAIRMAN, VICE_CHAIRMAN, BOARD_MEMBER, SECRETARY). Ответ 201 `UserResponse`.

### 3.2 Как передавать токен

```
Authorization: Bearer <jwt>
```

Исключение — SSE (`/v1/events/**`): `EventSource` не умеет заголовки, поэтому там принимается `?access_token=<jwt>`. **Больше нигде** query-параметр не работает.

### 3.3 Что внутри токена

RS256, подпись ключом auth-service, публичный ключ — `GET /.well-known/jwks.json`. Клиенту декодировать токен не обязательно, но можно (payload не шифруется):

| Claim | Содержимое |
|---|---|
| `sub` | id пользователя (строка) |
| `iss` | `tandoo-auth` |
| `jti`, `iat`, `exp` | стандартные |
| `pin`, `username`, `fullName` | ПДн |
| `roles` | массив строк `Role` |
| `lang` | `RU` / `KG` / `EN` |
| `exerciseId`, `exerciseType` | только в stage-токене: `TEST` или `ESSAY` |

Шлюз проверяет подпись, `iss`, `exp` (допуск 30 с). Невалидный, просроченный, без `Bearer` → **401, errorCode 4010**.

### 3.4 Выход и отзыв сессий

- `POST /v1/auth/logout` → 204. Помечает все токены пользователя отозванными до их естественного истечения.
- Смена ролей или статуса пользователя администратором тоже отзывает все его сессии.
- Шлюз опрашивает список отзывов каждые 10 с. Отозванный токен → **401, errorCode 4317** («Сессия завершена. Войдите заново»). Задержка до 10 с между logout и фактическим отказом — норма.
- Для ЕСИА дополнительно `GET /v1/auth/esia/logout-url` → `{"url": …}` для внешнего выхода.

Клиент: на любой 401 (`4010`, `4317`) сбрасывать состояние и вести на логин. Не пытаться повторить запрос.

### 3.5 Публичные пути (без токена и без CSRF)

```
/v1/auth/login  /v1/auth/register  /v1/auth/otp-login  /v1/auth/esia/**
/.well-known/jwks.json  /v1/csrf  /actuator/health/**
/v3/api-docs/**  /swagger-ui/**  /swagger-ui.html  /docs/**
```

Всё остальное требует токен.

---

## 4. CSRF (double-submit cookie)

Включён по умолчанию (`GATEWAY_CSRF_ENABLED`, выключать только локально для Swagger).

### 4.1 Правило

Для каждого запроса с методом **POST, PUT, PATCH, DELETE** на непубличный путь шлюз требует:

1. cookie `XSRF-TOKEN` присутствует и не пуста;
2. заголовок `X-XSRF-TOKEN` присутствует;
3. значения **совпадают побайтно**.

GET, HEAD, OPTIONS, TRACE и публичные пути (логин, регистрация, ЕСИА, otp-login) — без проверки.

### 4.2 Как получить токен

```
GET /v1/csrf
→ 200 {"token": "<base64url 32 байта>", "headerName": "X-XSRF-TOKEN"}
   Set-Cookie: XSRF-TOKEN=<тот же token>; Path=/; SameSite=Lax; Secure; Max-Age=43200
```

- Cookie **не HttpOnly**: JS может прочитать её и подставить в заголовок. Это штатный путь для same-site клиента.
- Токен **stateless**: сервер ничего не хранит, проверяется только равенство. Значит, любой `GET /v1/csrf` выдаёт рабочий токен, «протухание» на сервере невозможно, только истечение cookie (12 ч).
- Токен **не привязан к пользователю**: можно получить до логина и использовать после.

### 4.3 Рекомендуемый поток на клиенте

1. При старте приложения (или при первом небезопасном запросе) вызвать `GET /v1/csrf`, сохранить `token` в памяти.
2. На каждый POST/PUT/PATCH/DELETE ставить `X-XSRF-TOKEN: <token>` и отправлять cookie (`credentials: 'include'` при cross-origin, см. §5).
3. Получили `403` с телом `{"reason": …}` → запросить новый токен и **повторить запрос один раз**.

```ts
// axios-подобный интерсептор
let csrf: string | null = null;

async function ensureCsrf() {
  if (!csrf) csrf = (await http.get('/v1/csrf')).data.token;
  return csrf;
}

http.interceptors.request.use(async (cfg) => {
  if (!['get', 'head', 'options'].includes(cfg.method!)) {
    cfg.headers['X-XSRF-TOKEN'] = await ensureCsrf();
  }
  return cfg;
});

http.interceptors.response.use(undefined, async (err) => {
  const r = err.response;
  if (r?.status === 403 && r.data?.reason && !err.config.__csrfRetried) {
    csrf = null;
    err.config.__csrfRetried = true;
    return http.request(err.config);
  }
  throw err;
});
```

### 4.4 Ошибка CSRF

Тело **отличается** от общего контракта ошибок (нет `errorCode`):

```json
{ "reason": "COOKIE_MISSING" | "HEADER_MISSING" | "TOKEN_MISMATCH", "traceId": "…" }
```

Отличать по наличию `reason`. Лечение одинаковое для всех трёх: новый токен, повтор.

### 4.5 Типичные причины `COOKIE_MISSING`

- Фронт на другом origin и запрос без `credentials: 'include'` → браузер не отправляет cookie.
- `Secure=true` (дефолт), а клиент ходит по `http://` не на `localhost`. Браузер cookie отбрасывает. Локально по http: `GATEWAY_CSRF_COOKIE_SECURE=false`.
- `SameSite=Lax` (дефолт) при фронте и API на **разных сайтах** (не просто разных портах): cookie не уйдёт с POST. Решение — один сайт (reverse proxy) или `GATEWAY_CSRF_COOKIE_SAME_SITE=None` вместе с `Secure=true`.
- Cookie `XSRF-TOKEN` перезаписана другой копией приложения на том же домене (тот же `Path=/`) → `TOKEN_MISMATCH`. После смены вкладки/окна брать токен заново.

---

## 5. CORS

Конфигурация шлюза (`CorsConfig`):

| Параметр | Значение |
|---|---|
| Allowed origins | явный список из `CORS_ALLOWED_ORIGINS` (через запятую). **Нет дефолта**: без переменной шлюз не стартует. `*` запрещён. |
| Allow credentials | `true` |
| Allowed methods | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| Allowed headers | `*` (любые, включая `Authorization`, `X-XSRF-TOKEN`, `X-Trace-Id`) |
| Exposed headers | `X-Trace-Id`, `Content-Disposition` |
| Max-Age preflight | 3600 с |

Что это значит для клиента:

- Origin должен совпадать **точно**, включая схему и порт: `http://localhost:3000` ≠ `http://localhost:3001` ≠ `https://localhost:3000`. Каждый dev/stage/prod origin — отдельная запись в переменной.
- `fetch(..., { credentials: 'include' })` / `axios.defaults.withCredentials = true` обязательны, иначе cookie CSRF не пойдёт и `Set-Cookie` не сохранится.
- Из JS в ответе читаются только `X-Trace-Id` и `Content-Disposition` (плюс безопасные по умолчанию: `Content-Type`, `Content-Length` и пр.). Другие кастомные заголовки ответа JS не увидит.
- Отказ CORS шлюз отдаёт как **403 без тела** и без CORS-заголовков. В браузере это выглядит как «CORS error» на уровне сети, в `response` ничего нет. Первое, что проверять при такой ошибке — точное совпадение origin со списком.
- Preflight `OPTIONS` не требует ни токена, ни CSRF.

---

## 6. Заголовки

### 6.1 Клиент → шлюз

| Заголовок | Когда |
|---|---|
| `Authorization: Bearer <jwt>` | все непубличные запросы |
| `X-XSRF-TOKEN` | POST/PUT/PATCH/DELETE на непубличные пути |
| `Cookie: XSRF-TOKEN=…` | то же (браузер сам) |
| `X-Trace-Id` | опционально; для сквозной трассировки из клиента. Формат `[A-Za-z0-9-]{8,64}`, иначе игнорируется и генерируется свой |
| `Content-Type: application/json` | тела JSON; для загрузок `multipart/form-data` |

`Accept-Language` **не читается**. Язык ошибок и контента берётся из claim `lang` токена, который auth-service берёт из профиля пользователя. Смена языка = смена настройки пользователя и перелогин.

### 6.2 Зарезервированные заголовки

Шлюз **вырезает** из клиентского запроса и выставляет сам: `X-User-*` (`X-User-Id`, `X-User-Pin`, `X-User-Full-Name`, `X-User-Roles`, `X-User-Language`), `X-Username`, `X-Exercise-*`, `X-Internal-Key`. Посылать их бессмысленно, подделать контекст нельзя.

### 6.3 Шлюз → клиент

| Заголовок | Содержимое |
|---|---|
| `X-Trace-Id` | id запроса. **Логировать в клиенте и прикладывать к багрепортам** — по нему ищутся логи всех сервисов. Тот же id приходит в поле `traceId` тела ошибки. |
| `Content-Disposition` | у скачиваний: `attachment; filename*=UTF-8''…` (RFC 5987, кириллица закодирована) |

---

## 7. Формат ошибок

### 7.1 Тело

Все сервисы и шлюз (кроме CSRF, §4.4) отдают:

```json
{
  "errorCode": 4001,
  "message": "Текст на языке пользователя",
  "fields": { "email": "должно быть корректным адресом" },
  "traceId": "9f2c…"
}
```

- `errorCode` — прикладной номер из Приложения Б спеки. **Ветвиться по нему, не по `message`** и не только по HTTP-статусу.
- `fields` — только у ошибок валидации (400 / 4001): путь поля → сообщение. Иначе поле отсутствует (`NON_NULL`).
- `message` локализован по `lang` пользователя через внешний сервис локализации; при его недоступности или для RU — русский текст из каталога. Ошибки без аутентификации (401 со шлюза) всегда на русском.

### 7.2 Инфраструктурные коды, которые клиент обязан обрабатывать

| HTTP | errorCode | Причина | Действие клиента |
|---|---|---|---|
| 401 | 4010 | нет/невалидный/просроченный токен | на логин |
| 401 | 4317 | сессия отозвана (logout, смена ролей/статуса) | на логин, показать «сессия завершена» |
| 403 | `{reason}` | CSRF | новый `/v1/csrf`, повтор один раз |
| 403 | 4030 | доступ запрещён (в т.ч. обработчик без аннотации доступа) | скрыть действие, показать сообщение |
| 403 | 4031 | доступ запрещён по роли (`@PreAuthorize`/runtime-проверка) | то же |
| 403 | 4302 | вне рабочего окна (только если **все** роли пользователя — роли Совета) | показать сообщение с окном; окно — `GET /v1/schedule-settings` (админ) |
| 400 | 4001 | валидация тела/параметров; см. `fields` | подсветить поля |
| 400 | 4143 | нарушение целостности БД (дубликат и т.п.) | показать сообщение |
| 404 | 4040 | ресурс/маршрут не найден | — |
| 413 | 5005 | файл больше лимита (50 МБ файл, 64 МБ запрос) | проверять размер до отправки |
| 429 | 4301 | лимит подписок SSE (10/мин на пользователя) | backoff перед реконнектом |
| 429 | 4136 | лимит одновременных SSE (3 на пользователя) | закрыть лишние вкладки/соединения |
| 503 | 5000 | необработанная ошибка сервера | «попробуйте позже», прислать `traceId` |

Прикладные коды (41xx, 42xx, 43xx…) — в спеке, Приложение Б, и в OpenAPI каждого маршрута. Примеры из контроллеров: 4109 нужно переголосование, 4116 ответ уже дан, 4133/4313 время теста/эссе истекло, 4134 неверный код этапа, 4135 эссе уже сдано, 4200 кандидат не открыт для оценки, 4278 ошибки строк импорта.

---

## 8. SSE (поток событий)

```
GET /v1/events?access_token=<jwt>&channels=notification&channels=vote
Accept: text/event-stream
```

- Единственный маршрут с токеном в query. Через шлюз `Authorization` тоже принимается, но `EventSource` его не ставит. При кастомном клиенте (fetch + ReadableStream) можно заголовок.
- **Токен попадает в URL** → в логи прокси и историю. Не логировать URL целиком на клиенте.
- Каналы: `joinMeeting`, `vote`, `meetingStatus`, `applicationStatus`, `notification`. Регистр не важен, неизвестные игнорируются, пусто = все.
- События:
  - `connected` — первым, data `{"channels":[…]}`;
  - `heartbeat` — каждые 15 с, data `{"ts":"…"}`; если нет 45 с — переподключаться;
  - `error` — при лимите соединений в api-service: data `{"code":"SSE_MAX_CONNECTIONS_REACHED","errorCode":4136}`, затем закрытие;
  - канальные события — **только сигнал «обнови данные»**, без текстов и ПДн. По сигналу клиент делает обычный GET.
- Таймауты: emitter в api-service 10 мин, маршрут на шлюзе 660 с. Обрыв раз в ~10 мин — норма, `EventSource` переподключится сам. При ручном реконнекте соблюдать лимит 10 подписок/мин, иначе 429 `4301`.
- Лимит 3 соединения на пользователя на шлюзе и в api-service. Несколько вкладок — держать одно соединение (SharedWorker/BroadcastChannel) или мириться с 429/`error`.
- CSRF на SSE не действует (GET). Токен истёк → соединение оборвётся с 401, `EventSource` начнёт бесконечный реконнект: проверять `exp` и закрывать поток самостоятельно.

---

## 9. Файлы

### 9.1 Загрузка

| Маршрут | Форма |
|---|---|
| `POST /v1/file/upload?category=<FileCategory>&ownerUserId=<опц.>` | `multipart/form-data`, part `file` |
| `POST /v1/reference`, `PUT /v1/reference/{id}` | parts `document` (JSON `ReferenceDocumentRequest`, `Content-Type: application/json`) и `file` |
| `POST /v1/questions/import` | part `file` (xlsx) |

- Не выставлять `Content-Type` вручную для multipart: браузер сам добавит boundary.
- Ответ загрузки — `StoredFileRef {id, fileName, contentType, size, category, ownerUserId}`. Дальше `id` кладётся в запись раздела личного дела / заявки.
- Лимит: 50 МБ на файл, 64 МБ на запрос → иначе 413 `5005`.
- `FileCategory`: PERSONAL_INFO, EDUCATION, ACADEMIC_DEGREE, CERTIFICATE, WORK_EXPERIENCE, AWARD, RELATIVE, ASSET, ADDITIONAL_INFO, CANDIDATE_DOCUMENT, APPLICATION_ATTACHMENT, CONTEST_ANNOUNCEMENT, VACANCY_ATTACHMENT, JUDGE_DECREE, JUDGE_ASSIGNMENT, JUDGE_QUALIFICATION, REFERENCE_DOCUMENT, QUESTION_IMPORT.

### 9.2 Скачивание

| Маршрут | Content-Type | Content-Length |
|---|---|---|
| `GET /v1/file/{fileId}/download` | сохранённый | всегда |
| `GET /v1/documents/{fileId}/download` | `application/pdf` | только для файлов до порога, крупные — стриминг без длины |
| `GET /v1/decision/{id}/download` | `application/pdf` | нет |
| `GET /v1/questions/import/template` | xlsx | да |

- Все — `Content-Disposition: attachment`. `inline` нигде нет; для предпросмотра PDF грузить blob и открывать через `URL.createObjectURL`.
- Скачивание требует `Authorization`, поэтому **прямая ссылка `<a href>` не сработает** (браузер не добавит заголовок). Качать через fetch с токеном → blob → ссылка. Имя файла — из `Content-Disposition` (`filename*`), заголовок разрешён в CORS.
- Генерация документов (`/documents/generate`, `/complaints/{id}/conclusion`, `/complaints/{id}/test-review-document`, `/candidate/profile/{userId}/presentation`, `/contest-results/{id}/reserve-list`) возвращает `StoredFileRef`; скачивать вторым запросом через `/v1/documents/{id}/download`.
- Прогресс-бар без `Content-Length` невозможен — учитывать для решений.

---

## 10. Пагинация и сортировка

Параметры Spring `Pageable`: `page` (с нуля), `size`, `sort=field,asc|desc` (повторяемый).

| Сервис | size по умолчанию | Макс. size |
|---|---|---|
| api-service | 20 | 2000 |
| auth-service `/v1/users` | 20 | 2000 |
| audit-service | 50 | 2000 |

Ответ всегда `PageResponse<T>`:

```json
{ "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0, "last": true }
```

Стандартный Spring `Page` JSON (`pageable`, `numberOfElements` …) **не является контрактом** и не приходит. Часть списков не пагинирована и возвращает плоский массив — отмечено в таблицах §13.

Даты/время — ISO-8601 `Instant` (UTC, суффикс `Z`) или `LocalDate`/`LocalDateTime` в `Asia/Bishkek` по полю; смотреть OpenAPI конкретного DTO. Фильтры `from`/`to`, `createdFrom`/`createdTo` — ISO date-time.

---

## 11. Роли и группы доступа

Роли (`Role`): SUPER_ADMIN, ADMIN, CHAIRMAN, VICE_CHAIRMAN, BOARD_MEMBER, SECRETARY, ACTIVE_JUDGE, CANDIDATE. У пользователя **множество** ролей. `JUDGE_PENDING_APPROVAL` из v1 отсутствует: судья на подтверждении = CANDIDATE + статус заявки судьи.

Группы доступа в таблицах маршрутов:

| Аннотация | Роли |
|---|---|
| `@SuperAdminAccess` | SUPER_ADMIN |
| `@AdminAccess` | SUPER_ADMIN, ADMIN |
| `@ChairmanAccess` | CHAIRMAN, VICE_CHAIRMAN |
| `@BoardAccess` | CHAIRMAN, VICE_CHAIRMAN, BOARD_MEMBER |
| `@SecretaryAccess` | SECRETARY |
| `@CouncilAccess` | CHAIRMAN, VICE_CHAIRMAN, BOARD_MEMBER, SECRETARY |
| `@StaffAccess` | SUPER_ADMIN, ADMIN + Council |
| `@CandidateAccess` | CANDIDATE, ACTIVE_JUDGE |
| `@ActiveJudgeAccess` | ACTIVE_JUDGE |
| `@AuthenticatedAccess` | любой пользователь с токеном (проверка владения внутри) |
| `@InternalAccess` | только сервис→сервис, снаружи недоступно |
| `@PublicEndpoint` | без токена |

Правило проверки прав — «есть хоть одна из ролей группы». Дополнительные runtime-проверки (владение объектом, «докладчик этой заявки», «председатель этого заседания») дают 403 `4031`. UI должен скрывать действия по ролям, но всегда обрабатывать 403.

Рабочее окно: если **все** роли пользователя — из Council (CHAIRMAN, VICE_CHAIRMAN, BOARD_MEMBER, SECRETARY), запросы вне окна `ScheduleSettings` → 403 `4302`. Админам и кандидатам окно не действует.

---

## 12. OpenAPI и чеклист интеграции

- Swagger UI: `GET /swagger-ui.html` на шлюзе, три спеки в выпадающем списке. Сырые JSON: `/docs/auth/v3/api-docs`, `/docs/api/v3/api-docs`, `/docs/audit/v3/api-docs`. Публичны.
- Для Swagger «Try it out» локально нужно `GATEWAY_CSRF_ENABLED=false` (он не подставляет `X-XSRF-TOKEN`).

Чеклист перед первым запуском фронта против стенда:

1. Origin фронта (точно, со схемой и портом) есть в `CORS_ALLOWED_ORIGINS`.
2. `withCredentials` / `credentials: 'include'` включены глобально.
3. Интерсептор CSRF (§4.3) стоит на POST/PUT/PATCH/DELETE и повторяет запрос при `{reason}`.
4. Интерсептор 401 (`4010`, `4317`) → сброс сессии → логин.
5. `X-Trace-Id` из ответа логируется и показывается в окне ошибки.
6. Скачивания идут через fetch с токеном, а не по прямой ссылке.
7. SSE: один поток на пользователя, `access_token` в query, реконнект с backoff, проверка `exp`.
8. Ошибки разбираются по `errorCode`, `fields` подсвечиваются.
9. По http без TLS локально: `GATEWAY_CSRF_COOKIE_SECURE=false`.

---

## 13. Полный перечень маршрутов

Легенда: `[a*, b]` — query-параметры, `*` обязателен; `+pg` — `page`, `size`, `sort`; `(201)`/`(204)` — статус ответа, иначе 200; `(класс)` — аннотация на контроллере. `Тело` — request DTO (`—` если нет; `MP` — multipart).

### 13.1 Шлюз

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/csrf` | public | — | `{token, headerName}` + cookie `XSRF-TOKEN` | выдать CSRF-токен |
| GET | `/swagger-ui.html` | public | — | HTML | Swagger UI трёх сервисов |
| GET | `/actuator/health/**` | public | — | health | проверка живости |

### 13.2 auth-service

**Вход и сессия** (`/v1/auth`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/auth/login` | @PublicEndpoint | `LoginRequest {username, password}` | `TokenResponse` | вход паролем |
| POST | `/v1/auth/register` | @PublicEndpoint | `RegistrationRequest {username 3-100, password 8-128, pin 14 цифр, firstName, lastName, middleName?, role}` | `UserResponse` (201) | регистрация по белому списку ролей |
| POST | `/v1/auth/otp-login` | @PublicEndpoint | `OtpLoginRequest {code}` | `TokenResponse` (stage) | вход одноразовым кодом этапа |
| POST | `/v1/auth/logout` | @AuthenticatedAccess | — | (204) | отозвать все токены пользователя |
| GET | `/v1/auth/esia/start` | @PublicEndpoint | — | `{authorizationUrl, state}` | старт ЕСИА PKCE |
| POST | `/v1/auth/esia/exchange` | @PublicEndpoint | `{code, state}` | `TokenResponse` | обмен кода на JWT; новый ПИН → создаётся CANDIDATE |
| GET | `/v1/auth/esia/logout-url` | @PublicEndpoint | — | `{url}` | URL внешнего выхода ЕСИА |
| GET | `/.well-known/jwks.json` | @PublicEndpoint | — | JWK Set | публичные ключи |

**Пользователи** (`/v1/users`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/users` `[query, role, createdFrom, createdTo, +pg]` | @StaffAccess + runtime: SUPER_ADMIN, ADMIN, CHAIRMAN, VICE_CHAIRMAN | — | `PageResponse<UserResponse>` | список (без администраторов) |
| GET | `/v1/users/board-members` `[activeOnly=false]` | @StaffAccess + тот же runtime | — | `List<UserResponse>` | члены Совета для назначения докладчика |
| GET | `/v1/users/me` | @AuthenticatedAccess | — | `UserResponse` | текущий аккаунт |
| PATCH | `/v1/users/{id}/status` | @AdminAccess | `{status: ACTIVE\|INACTIVE\|DELETED}` | `UserResponse` | смена статуса, отзыв сессий |
| PUT | `/v1/users/{id}/roles` | @AdminAccess | `{roles: Set<Role>}` | `UserResponse` | замена множества ролей, отзыв сессий |

`UserResponse`: `{id, username, pin, firstName, lastName, middleName, fullName, email, roles, role(legacy), status, esiaUser, language, createdAt}`.

**Внутренние** (снаружи 404): `GET /internal/revocations`, `GET /internal/users/{id}`, `GET /internal/users/by-pin/{pin}`, `POST /internal/users/{id}/roles/grant`, `POST /internal/users/{id}/roles/revoke`.

### 13.3 api-service

**Заявка на конкурс** (`/v1/contest-application`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/contest-application/contest/{contestId}` | @CandidateAccess | `ApplicationDraftRequest` | `ApplicationResponse` (201) | создать черновик |
| PATCH | `/v1/contest-application/{applicationId}` | @CandidateAccess | `ApplicationDraftRequest` | `ApplicationResponse` | править черновик |
| POST | `/v1/contest-application/send-for-review/{applicationId}` | @CandidateAccess | — | `ApplicationResponse` | подать / переподать секретарю |
| POST | `/v1/contest-application/withdraw/{applicationId}` | @CandidateAccess | — | `ApplicationResponse` | отозвать |
| PUT | `/v1/contest-application/register/{applicationId}` | @SecretaryAccess | — | `ApplicationResponse` | зарегистрировать (номер, докладчик) |
| PUT | `/v1/contest-application/returned-for-correction/{applicationId}` | @SecretaryAccess | `ReturnForCorrectionRequest` | `ApplicationResponse` | вернуть на доработку с причиной |
| POST | `/v1/contest-application/canceled/{applicationId}` | @AdminAccess | — | `ApplicationResponse` | административная отмена |
| PUT | `/v1/contest-application/assign-board-member/{applicationId}` `[boardMemberId*]` | @ChairmanAccess | — | `ApplicationResponse` | переназначить докладчика |
| PATCH | `/v1/contest-application/{applicationId}/ready` | @BoardAccess | `ReadyRequest` | `ApplicationResponse` | докладчик отметил готовность |
| GET | `/v1/contest-application/ready` `[contestId*]` | @CouncilAccess | — | `ReporterReadinessResponse` | сводка готовности докладчиков |
| GET | `/v1/contest-application/{applicationId}` | @AuthenticatedAccess | — | `ApplicationResponse` | карточка (владелец/персонал) |
| GET | `/v1/contest-application/{applicationId}/history` | @AuthenticatedAccess | — | `List<ApplicationStatusHistoryResponse>` | история статусов |
| GET | `/v1/contest-application/my` `[+pg]` | @CandidateAccess | — | `PageResponse<ApplicationResponse>` | мои заявки |
| GET | `/v1/contest-application/for-secretary` `[contestId*, +pg]` | @SecretaryAccess | — | `PageResponse<ApplicationResponse>` | заявки конкурса кроме черновиков |
| GET | `/v1/contest-application/by-contest/{contestId}` `[status* Set, +pg]` | @CouncilAccess | — | `PageResponse<ApplicationResponse>` | по статусам |
| GET | `/v1/contest-application/my-reporting` `[contestId*]` | @BoardAccess | — | `List<ApplicationResponse>` | где я докладчик |

**Оценка документов** (`/v1/document-assessment`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| PUT | `/v1/document-assessment` | @BoardAccess | `SectionScoreRequest` | `SectionScoreResponse` | оценка раздела докладчиком |
| GET | `/v1/document-assessment` `[applicationId*]` | @CouncilAccess | — | `List<SectionScoreResponse>` | все оценки разделов |
| GET | `/v1/document-assessment/summary` `[applicationId*]` | @CouncilAccess | — | `AssessmentSummaryResponse` | итог + каталог разделов |

**Бан** (`/v1/candidate`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/candidate/ban-status` | @CandidateAccess | — | `BanStatusResponse` | своё ограничение |
| GET | `/v1/candidate/{userId}/ban-status` | @StaffAccess | — | `BanStatusResponse` | ограничение кандидата |

**Личное дело** (`/v1/candidate/profile`, `/v1/candidate/sections`, `/v1/additional-info/questions`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/candidate/profile` | @CandidateAccess | `ProfileRequest` | `ProfileResponse` (201) | создать ПДн (однократно) |
| PUT | `/v1/candidate/profile` | @CandidateAccess | `ProfileRequest` | `ProfileResponse` | обновить ПДн |
| GET | `/v1/candidate/profile` | @CandidateAccess | — | `ProfileResponse` | свои ПДн |
| GET | `/v1/candidate/profile/{userId}` | @AuthenticatedAccess | — | `ProfileResponse` | ПДн (владелец/персонал) |
| GET | `/v1/candidate/profile/{userId}/full` | @StaffAccess | — | `FullProfileResponse` | всё личное дело |
| POST | `/v1/candidate/profile/education/import-diplomas` | @CandidateAccess | — | `ImportResultResponse` | импорт дипломов |
| POST | `/v1/candidate/profile/assets/import-cadastre` | @CandidateAccess | — | `ImportResultResponse` | импорт недвижимости |
| POST | `/v1/candidate/profile/{userId}/presentation` | @CouncilAccess | `PresentationRequest` | `StoredFileRef` | PDF карточки кандидата |
| GET | `/v1/candidate/sections/{section}` `[userId]` | @AuthenticatedAccess | — | `List<…>` по разделу | записи раздела (свои / чужие персоналом) |
| GET | `/v1/candidate/sections/{section}/{id}` | @AuthenticatedAccess | — | объект раздела | одна запись |
| POST | `/v1/candidate/sections/{section}` | @CandidateAccess | JSON раздела | объект (201) | создать запись |
| PUT | `/v1/candidate/sections/{section}/{id}` | @CandidateAccess | JSON раздела | объект | обновить |
| DELETE | `/v1/candidate/sections/{section}/{id}` | @CandidateAccess | — | (204) | логическое удаление |
| GET | `/v1/additional-info/questions` | @AuthenticatedAccess | — | `List<AdditionalInfoQuestionResponse>` | активные вопросы |
| GET | `/v1/additional-info/questions/all` | @AdminAccess | — | `List<…>` | все, включая неактивные |
| POST | `/v1/additional-info/questions` | @AdminAccess | `AdditionalInfoQuestionRequest` | `…Response` (201) | создать вопрос |
| PUT | `/v1/additional-info/questions/{id}` | @AdminAccess | `AdditionalInfoQuestionRequest` | `…Response` | обновить вопрос |

`{section}`: PERSONAL_DATA (только чтение, запись → 4001), EDUCATION, ACADEMIC_DEGREE, CERTIFICATE, EMPLOYMENT, AWARD, RELATIVE, ASSET, ADDITIONAL_INFO, DOCUMENT. Форма JSON каждого раздела — в OpenAPI.

**Жалобы** (`/v1/complaints`, `/v1/complaint-reviews`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/complaints` | @CandidateAccess | `SubmitComplaintRequest` | `ComplaintResponse` (201) | подать жалобу |
| GET | `/v1/complaints/{complaintId}` | @AuthenticatedAccess | — | `ComplaintResponse` | карточка (автор/персонал) |
| GET | `/v1/complaints/my` `[+pg]` | @CandidateAccess | — | `PageResponse<ComplaintResponse>` | мои жалобы |
| GET | `/v1/complaints` `[type, status, contestId, +pg]` | @StaffAccess | — | `PageResponse<ComplaintResponse>` | поиск |
| POST | `/v1/complaints/{complaintId}/test-review-document` | @AuthenticatedAccess | — | `StoredFileRef` | документ о пересмотре теста |
| POST | `/v1/complaints/{complaintId}/conclusion` | @SecretaryAccess | — | `StoredFileRef` | заключение |
| POST | `/v1/complaint-reviews` | @CouncilAccess | `AttachComplaintRequest` | `ComplaintResponse` | прикрепить к заседанию |
| POST | `/v1/complaint-reviews/{meetingId}/close` | @BoardAccess | — | `MeetingResponse` | закрыть рассмотрение (все проголосованы, иначе 4029) |
| GET | `/v1/complaint-reviews/{meetingId}` | @StaffAccess | — | `ComplaintReviewMaterialsResponse` | материалы с голосами |

**Конкурс** (`/v1/contest`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/contest/create-name` | @ChairmanAccess | `ContestNameRequest` | `ContestResponse` (201) | создать с названием |
| PATCH | `/v1/contest/update-name/{contestId}` | @SecretaryAccess | `ContestNameRequest` | `ContestResponse` | переименовать |
| PATCH | `/v1/contest/{contestId}` | @SecretaryAccess | `ContestDetailsRequest` | `ContestResponse` | детали до публикации |
| POST | `/v1/contest/{contestId}/publish` | @SecretaryAccess | — | `ContestResponse` | опубликовать |
| DELETE | `/v1/contest/{contestId}` | @ChairmanAccess | — | `ContestResponse` (200) | отменить |
| PUT | `/v1/contest/steps/{contestId}` | @SecretaryAccess | `List<ContestStepRequest>` | `List<ContestStepResponse>` | заменить календарный план |
| PUT | `/v1/contest/{contestId}/stage-window/{stage}` | @SecretaryAccess | `StageWindowRequest` | `ContestResponse` | окно этапа (TESTING/ESSAY/INTERVIEW) |
| GET | `/v1/contest/{contestId}` | @AuthenticatedAccess | — | `ContestResponse` | карточка |
| GET | `/v1/contest/steps/{contestId}` | @AuthenticatedAccess | — | `List<ContestStepResponse>` | шаги |
| GET | `/v1/contest/all` `[+pg]` | @StaffAccess | — | `PageResponse<ContestResponse>` | все |
| GET | `/v1/contest` `[status* Set, +pg]` | @StaffAccess | — | `PageResponse<ContestResponse>` | по статусам |
| GET | `/v1/contest/type` `[type*, status=PUBLISHED, +pg]` | @AuthenticatedAccess | — | `PageResponse<ContestResponse>` | по типу инстанции |
| GET | `/v1/contest/completed` `[+pg]` | @AuthenticatedAccess | — | `PageResponse<ContestResponse>` | архив |
| GET | `/v1/contest/available` `[+pg]` | @CandidateAccess | — | `PageResponse<ContestCardResponse>` | для кандидата с видимым статусом |

**Дашборд, решения** (`/v1/dashboard`, `/v1/decision`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/dashboard` | @StaffAccess | — | `List<MetricValue>` | метрики по роли |
| GET | `/v1/decision/by-application/{applicationId}` | @StaffAccess | — | `List<DecisionResponse>` | решения по заявке |
| GET | `/v1/decision/by-meeting/{meetingId}` | @StaffAccess | — | `List<DecisionResponse>` | решения заседания |
| POST | `/v1/decision/{id}/generate` | @SecretaryAccess | `Map` (опц., напр. `reason`) | `DecisionResponse` | сформировать файл (4067 пока не все проголосовали) |
| POST | `/v1/decision/{id}/confirm` | @ChairmanAccess | — | `DecisionResponse` | подтвердить |
| GET | `/v1/decision/{id}/download` | @StaffAccess | — | PDF | скачать |

**Справочники, праздники, нормативные документы, настройки, веса** (`/v1/directory`, `/v1/holidays`, `/v1/reference`, `/v1/schedule-settings`, `/v1/weights`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/directory` | @AuthenticatedAccess | — | `DirectoryCode[]` | коды справочников |
| GET | `/v1/directory/{code}` `[parentId, search, activeOnly=true, +pg]` | @AuthenticatedAccess | — | `PageResponse<DirectoryItemResponse>` | поиск |
| GET | `/v1/directory/{code}/all` | @AuthenticatedAccess | — | `List<DirectoryItemResponse>` | все активные (для селектов) |
| GET | `/v1/directory/{code}/{id}` | @AuthenticatedAccess | — | `DirectoryItemResponse` | элемент |
| POST | `/v1/directory/{code}` | @AdminAccess | `DirectoryItemRequest` | `DirectoryItemResponse` (201) | создать |
| PUT | `/v1/directory/{code}/{id}` | @AdminAccess | `DirectoryItemRequest` | `DirectoryItemResponse` | обновить |
| PATCH | `/v1/directory/{code}/{id}/active` `[active*]` | @AdminAccess | — | `DirectoryItemResponse` | вкл/выкл |
| PUT | `/v1/directory/{code}/sort-order` | @AdminAccess | `List<SortOrderRequest>` | (200, пусто) | порядок |
| POST | `/v1/directory/{code}/sync` | @AdminAccess | — | `SyncResult` | синхронизация с внешним сервисом |
| GET | `/v1/holidays` | @AuthenticatedAccess | — | `List<HolidayResponse>` | праздники |
| GET | `/v1/holidays/{id}` | @AuthenticatedAccess | — | `HolidayResponse` | один |
| POST | `/v1/holidays` | @AdminAccess | `HolidayRequest` | `HolidayResponse` (201) | создать |
| PUT | `/v1/holidays/{id}` | @AdminAccess | `HolidayRequest` | `HolidayResponse` | обновить |
| DELETE | `/v1/holidays/{id}` | @AdminAccess | — | (204) | удалить |
| GET | `/v1/reference` | @AuthenticatedAccess | — | `List<ReferenceDocumentResponse>` | активные нормативные документы |
| POST | `/v1/reference` | @AdminAccess | MP: `document` (JSON) + `file` | `ReferenceDocumentResponse` (201) | загрузить |
| PUT | `/v1/reference/{id}` | @AdminAccess | MP: `document` + `file`? | `ReferenceDocumentResponse` | обновить |
| DELETE | `/v1/reference/{id}` | @AdminAccess | — | (204) | деактивировать |
| GET | `/v1/schedule-settings` | @AdminAccess | — | `ScheduleSettingsResponse` | рабочее окно |
| PUT | `/v1/schedule-settings` | @SuperAdminAccess | `ScheduleSettingsRequest` | `ScheduleSettingsResponse` | изменить окно |
| GET | `/v1/weights` | @StaffAccess | — | `List<SectionWeightResponse>` | веса разделов |
| PUT | `/v1/weights/{section}` | @AdminAccess | `SectionWeightRequest` | `SectionWeightResponse` | вес раздела |

`{code}`: COUNTRY, CITIZENSHIP, NATIONALITY, REGION, DISTRICT, CITY, STREET, POSTAL_CODE, COURT, COURT_NAME, COURT_INSTANCE, COURT_INSTANCE_TYPE, SPECIALIZATION, UNIVERSITY, STUDY_FORM, EDUCATION_DEGREE, LANGUAGE_LEVEL, EMPLOYMENT_TYPE, DOCUMENT_TYPE, ASSET_TYPE, EXCLUSION_REASON, AGE_REQUIREMENT, EDUCATION_REQUIREMENT, WORK_EXPERIENCE_REQUIREMENT.

**Документы и файлы** (`/v1/documents`, `/v1/file`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/documents/generate` | @StaffAccess | `GenerateDocumentRequest {type, model, ownerUserId}` (ADMISSION, NON_ADMISSION, CANDIDATE_PRESENTATION) | `StoredFileRef` | сформировать документ |
| GET | `/v1/documents/{fileId}/download` | @AuthenticatedAccess | — | PDF | скачать (владелец/персонал) |
| POST | `/v1/file/upload` `[category*, ownerUserId]` | @AuthenticatedAccess | MP: `file` | `StoredFileRef` (201) | загрузить |
| GET | `/v1/file/{fileId}` | @AuthenticatedAccess | — | `StoredFileRef` | метаданные |
| GET | `/v1/file/{fileId}/download` | @AuthenticatedAccess | — | файл | скачать |
| DELETE | `/v1/file/{fileId}` | @AuthenticatedAccess | — | (204) | логическое удаление |

**Эссе** (`/v1/essay`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/essay/my` `[applicationId]` | @CandidateAccess (класс) | — | `EssaySubmissionResponse` | тема, ответы, остаток времени |
| PUT | `/v1/essay/my/reply` `[applicationId]` | @CandidateAccess (класс) | `EssayReplyRequest` | `EssaySubmissionResponse` | сдать (4135 уже сдано, 4313 время вышло) |
| GET | `/v1/essay/reply` `[contestId*, +pg]` | @BoardAccess (класс) | — | `PageResponse<EssaySubmissionResponse>` | моя очередь проверки |
| GET | `/v1/essay/reply/all` `[contestId*, +pg]` | @BoardAccess (класс) | — | `PageResponse<…>` | все сданные |
| GET | `/v1/essay/reply/{submissionId}` | @BoardAccess (класс) | — | `EssaySubmissionResponse` | эссе с оценками |
| PUT | `/v1/essay/reply/{submissionId}/score` | @BoardAccess (класс) | `EssayScoreRequest` | `EssaySubmissionResponse` | оценить (4005 повтор, 4003 диапазон) |
| GET | `/v1/essay/reply/progress` `[contestId*]` | @BoardAccess (класс) | — | `List<ReviewerProgressResponse>` | прогресс проверяющих |
| GET | `/v1/essay/topic` | @AdminAccess (класс) | — | `List<EssayTopicResponse>` | темы |
| GET | `/v1/essay/topic/{id}` | @AdminAccess (класс) | — | `EssayTopicResponse` | тема |
| POST | `/v1/essay/topic` | @AdminAccess (класс) | `EssayTopicRequest` | `EssayTopicResponse` (201) | создать |
| PUT | `/v1/essay/topic/{id}` | @AdminAccess (класс) | `EssayTopicRequest` | `EssayTopicResponse` | обновить |
| DELETE | `/v1/essay/topic/{id}` | @AdminAccess (класс) | — | (204) | деактивировать |

**Собеседование** (`/v1/interviews`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/interviews` `[contestId*, meetingId*, +pg]` | @BoardAccess (класс) | — | `PageResponse<InterviewCandidateResponse>` | кандидаты заседания с флагом `active` |
| PATCH | `/v1/interviews/assessment` `[meetingId*, applicationId*]` | @BoardAccess (класс) | `InterviewAssessmentRequest` | `InterviewAssessmentResponse` | оценить по критериям (4200 не открыт) |
| GET | `/v1/interviews/my` `[meetingId*, applicationId*]` | @BoardAccess (класс) | — | `InterviewAssessmentResponse` | мои оценки |

**Трек судьи** (`/v1/judge-applications`, `/v1/active-judge-confirmations`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/judge-applications` | @ActiveJudgeAccess | `JudgeApplicationDraftRequest` | `JudgeApplicationResponse` (201) | черновик |
| POST | `/v1/judge-applications/{id}/submit` | @ActiveJudgeAccess | — | `JudgeApplicationResponse` | подать |
| GET | `/v1/judge-applications/my` | @ActiveJudgeAccess | — | `List<JudgeApplicationResponse>` | мои |
| GET | `/v1/judge-applications/{id}/my/scores` | @ActiveJudgeAccess | — | `JudgeScoresResponse` | мои баллы |
| PUT | `/v1/judge-applications/{id}/register` | @SecretaryAccess | — | `JudgeApplicationResponse` | зарегистрировать |
| PUT | `/v1/judge-applications/{id}/reporter` | @ChairmanAccess | `JudgeRequests.Reporter` | `JudgeApplicationResponse` | докладчик |
| PATCH | `/v1/judge-applications/{id}/ready` | @BoardAccess | `JudgeRequests.Ready` | `JudgeApplicationResponse` | готовность докладчика |
| PUT | `/v1/judge-applications/{id}/professional-score` | @BoardAccess | `JudgeRequests.ProfessionalScore` | `JudgeApplicationResponse` | профессиональная оценка |
| PUT | `/v1/judge-applications/{id}/document-score` | @BoardAccess | `JudgeRequests.DocumentScore` | `List<DocumentSectionScore>` | оценка раздела документов |
| POST | `/v1/judge-applications/{id}/files` | @SecretaryAccess | `JudgeRequests.AttachFile` | `JudgeApplicationResponse` | прикрепить файл |
| POST | `/v1/judge-applications/{id}/meetings` | @CouncilAccess | `JudgeRequests.ScheduleMeeting` | `MeetingResponse` (201) | назначить заседание |
| POST | `/v1/judge-applications/{id}/invite-interview` | @SecretaryAccess | `JudgeRequests.InterviewInvitation` | `JudgeApplicationResponse` | пригласить на собеседование |
| GET | `/v1/judge-applications/{id}` | @StaffAccess | — | `JudgeApplicationResponse` | карточка |
| GET | `/v1/judge-applications` `[contestId*, status Set, +pg]` | @StaffAccess | — | `PageResponse<…>` | по конкурсу/статусам |
| GET | `/v1/judge-applications/under-review` `[+pg]` | @StaffAccess | — | `PageResponse<…>` | на рассмотрении |
| GET | `/v1/judge-applications/active-for-secretary` `[+pg]` | @SecretaryAccess | — | `PageResponse<…>` | ждут секретаря |
| POST | `/v1/active-judge-confirmations` | @CandidateAccess | `JudgeConfirmationRequest` | `JudgeConfirmationResponse` | черновик подтверждения статуса |
| POST | `/v1/active-judge-confirmations/{id}/submit` | @CandidateAccess | — | `JudgeConfirmationResponse` | подать |
| GET | `/v1/active-judge-confirmations/my/latest` | @CandidateAccess | — | `JudgeConfirmationResponse` | последнее моё |
| GET | `/v1/active-judge-confirmations/my/history` | @CandidateAccess | — | `List<…>` | история |
| GET | `/v1/active-judge-confirmations` `[status Set, +pg]` | @StaffAccess | — | `PageResponse<…>` | список |
| GET | `/v1/active-judge-confirmations/{id}` | @StaffAccess | — | `JudgeConfirmationResponse` | карточка |
| POST | `/v1/active-judge-confirmations/{id}/review` | @SecretaryAccess | — | `JudgeConfirmationResponse` | взять в работу |
| POST | `/v1/active-judge-confirmations/{id}/approve` | @SecretaryAccess | — | `JudgeConfirmationResponse` | одобрить (даёт ACTIVE_JUDGE) |
| POST | `/v1/active-judge-confirmations/{id}/reject` | @SecretaryAccess | `JudgeRequests.Reject` | `JudgeConfirmationResponse` | отклонить с причиной |

**Заседания и голосование** (`/v1/meeting`, `/v1/vote`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/meeting` | @CouncilAccess | `ScheduleMeetingRequest` | `MeetingResponse` (201) | назначить |
| PATCH | `/v1/meeting/{meetingId}` | @ChairmanAccess | `RescheduleMeetingRequest` | `MeetingResponse` | перенести |
| POST | `/v1/meeting/{meetingId}/join` | @CouncilAccess | — | `MeetingResponse` | присоединиться (кворум открывает) |
| PUT | `/v1/meeting/{meetingId}/force-close` | @BoardAccess | — | `MeetingResponse` | закрыть вручную (≥1 голос) |
| PATCH | `/v1/meeting/{meetingId}/candidates/{applicationId}/unlock` | @ChairmanAccess | — | (200, пусто) | открыть кандидата на собеседовании |
| GET | `/v1/meeting/{meetingId}` | @StaffAccess | — | `MeetingResponse` | карточка с участниками |
| GET | `/v1/meeting/by-contest/{contestId}` `[+pg]` | @StaffAccess | — | `PageResponse<MeetingResponse>` | заседания конкурса |
| GET | `/v1/meeting` `[status* Set, +pg]` | @StaffAccess | — | `PageResponse<MeetingResponse>` | по статусам |
| POST | `/v1/vote` | @BoardAccess | `CastVoteRequest` | `VoteResponse` (201) | голос (4109 нужно переголосование) |
| GET | `/v1/vote/{meetingId}` `[subjectId]` | @StaffAccess | — | `List<VoteResponse>` | голоса заседания |
| GET | `/v1/vote/{meetingId}/summary` `[subjectId*]` | @StaffAccess | — | `VoteSummaryResponse` | итог + статус участников |

**Уведомления и SSE** (`/v1/notifications`, `/v1/events`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/notifications` `[+pg]` | @AuthenticatedAccess (класс) | — | `PageResponse<NotificationResponse>` | мои, новые первыми |
| GET | `/v1/notifications/unread-count` | @AuthenticatedAccess (класс) | — | `UnreadCountResponse` | непрочитанных |
| PATCH | `/v1/notifications/{notificationId}/read` | @AuthenticatedAccess (класс) | — | `NotificationResponse` | прочитано |
| PATCH | `/v1/notifications/read-all` | @AuthenticatedAccess (класс) | — | `{updated: n}` | все прочитаны |
| POST | `/v1/notifications/interview-invitation` | @SecretaryAccess | `InterviewInvitationRequest` | `{invited: n}` | пригласить на собеседование |
| GET | `/v1/events` `[channels Set, access_token]` | @AuthenticatedAccess | — | `text/event-stream` | поток сигналов (§8) |

**Резерв, рейтинг** (`/v1/candidate/reserve`, `/v1/contest-results`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/candidate/reserve` `[contestId, status, +pg]` | @StaffAccess | — | `PageResponse<ReserveResponse>` | позиции резерва |
| GET | `/v1/candidate/reserve/my` | @CandidateAccess | — | `List<ReserveResponse>` | мои позиции |
| POST | `/v1/candidate/reserve/{reserveId}/exclude` | @StaffAccess | `ExcludeReserveRequest` | `ReserveResponse` | исключить с основаниями |
| POST | `/v1/candidate/reserve/{reserveId}/confirm` | @CandidateAccess | — | `ReserveResponse` | подтвердить готовность |
| POST | `/v1/candidate/reserve/{reserveId}/decline` | @CandidateAccess | — | `ReserveResponse` | отказаться, вернуться в резерв |
| GET | `/v1/contest-results/{contestId}/rating` `[activeOnly=false]` | @StaffAccess | — | `ContestRatingResponse` | рейтинг с разбивкой |
| GET | `/v1/contest-results/{contestId}/results` | @StaffAccess | — | `List<RatingEntryResponse>` | прошедшие |
| GET | `/v1/contest-results/{contestId}/passed-candidates` | @StaffAccess | — | `List<RatingEntryResponse>` | то же (алиас) |
| GET | `/v1/contest-results/{contestId}/reserve-candidates` | @StaffAccess | — | `List<RatingEntryResponse>` | прошедшие с действующим резервом |
| GET | `/v1/contest-results/my` | @CandidateAccess | — | `List<RatingEntryResponse>` | мои строки рейтинга |
| GET | `/v1/contest-results/completed/my` | @CandidateAccess | — | `List<PassedContestResponse>` | пройденные конкурсы |
| GET | `/v1/contest-results/{contestId}/readiness` | @ChairmanAccess | — | `CompletionReadinessResponse` | готов ли к закрывающему заседанию |
| POST | `/v1/contest-results/{contestId}/reserve-list` | @StaffAccess | — | `StoredFileRef` | документ списка резерва |

**Подпись ОЭП** (`/v1/oep`, класс @CouncilAccess)

| Метод | Путь | Тело | Ответ | Назначение |
|---|---|---|---|---|
| GET | `/v1/oep/methods` | — | `List<SignatureMethod>` | способы подписи |
| POST | `/v1/oep/send-pin` | `{method}` | (200, пусто) | отправить код |
| POST | `/v1/oep/authenticate` | `{code}` | `{active, validUntil}` | аутентификация в ОЭП |
| GET | `/v1/oep/session` | — | `{active, validUntil}` | текущая сессия подписи |
| POST | `/v1/oep/sign` | `{meetingId, applicationId, judgeApplicationId, voteId}` | `{id, meetingId, decisionId, voteId, certificateOwner, signedAt}` | подписать решение / свой голос |

**Тестирование** (`/v1/tests`, `/v1/questions`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/tests/codes/issue` | @SecretaryAccess | `IssueCodesRequest` | `List<{applicationId, code, expiresAt}>` | выдать коды этапа (показываются один раз) |
| GET | `/v1/tests/{testId}` | @CandidateAccess | — | `TestViewResponse` | вопросы без правильных, остаток времени |
| POST | `/v1/tests/{testId}/questions/{number}/answer` | @CandidateAccess | `AnswerRequest` | `TestViewResponse` | ответ (4116 повтор, 4133 время вышло) |
| POST | `/v1/tests/{testId}/finish` | @CandidateAccess | — | `TestResultResponse` | завершить |
| GET | `/v1/tests/{testId}/result` | @CandidateAccess | — | `TestResultResponse` | результат |
| GET | `/v1/tests` `[+pg]` | @AdminAccess | — | `PageResponse<TestSummaryResponse>` | все тесты |
| GET | `/v1/tests/{testId}/review` | @AdminAccess | — | `TestReviewResponse` | вопросы с ответами и ключами |
| POST | `/v1/questions` | @StaffAccess + runtime SUPER_ADMIN/ADMIN/SECRETARY | `QuestionRequest` | `QuestionResponse` (201) | создать вопрос |
| PUT | `/v1/questions/{id}` | @StaffAccess + runtime | `QuestionRequest` | `QuestionResponse` | обновить |
| PATCH | `/v1/questions/{id}/activate` | @StaffAccess + runtime | — | `QuestionResponse` | активировать |
| PATCH | `/v1/questions/{id}/deactivate` | @StaffAccess + runtime | — | `QuestionResponse` | деактивировать |
| DELETE | `/v1/questions/{id}` | @StaffAccess + runtime | — | (204) | логическое удаление |
| GET | `/v1/questions/{id}` | @StaffAccess | — | `QuestionResponse` | карточка с ключами |
| GET | `/v1/questions` `[categoryId*, +pg]` | @StaffAccess | — | `PageResponse<QuestionResponse>` | вопросы категории |
| GET | `/v1/questions/categories` | @StaffAccess | — | `List<QuestionCategoryResponse>` | категории |
| PUT | `/v1/questions/categories/{id}` | @AdminAccess | `QuestionCategoryRequest` | `QuestionCategoryResponse` | категория |
| GET | `/v1/questions/import/template` | @AdminAccess | — | xlsx | шаблон импорта |
| POST | `/v1/questions/import` | @AdminAccess | MP: `file` | `ImportReport` | импорт (4278 с ошибками строк) |

Stage-токен (otp-login) даёт роль CANDIDATE и `exerciseId`/`exerciseType`; для теста клиент использует `/v1/tests/{exerciseId}/…`, для эссе `/v1/essay/my`.

**Вакансии** (`/v1/vacancy`, `/v1/vacancy-application`)

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| POST | `/v1/vacancy` | @ChairmanAccess | `VacancyRequest` (`meetingStartDateTime` обязателен) | `VacancyResponse` (201) | черновик + заседание |
| PATCH | `/v1/vacancy/{vacancyId}` | @SecretaryAccess | `VacancyRequest` | `VacancyResponse` | править |
| POST | `/v1/vacancy/{vacancyId}/publish` | @SecretaryAccess | — | `VacancyResponse` | опубликовать |
| POST | `/v1/vacancy/{vacancyId}/cancel` | @ChairmanAccess | — | `VacancyResponse` | отменить |
| POST | `/v1/vacancy/{vacancyId}/meeting` | @ChairmanAccess | `ScheduleVacancyMeetingRequest` | `Long` (id заседания) | назначить голосование |
| POST | `/v1/vacancy/{vacancyId}/select-from-reserve` | @SecretaryAccess | — | `Selection` | добор из резерва (4103) |
| GET | `/v1/vacancy/{vacancyId}` | @StaffAccess | — | `VacancyResponse` | карточка |
| GET | `/v1/vacancy` `[status, +pg]` | @StaffAccess | — | `PageResponse<VacancyResponse>` | по статусу |
| GET | `/v1/vacancy/by-contest/{contestId}` `[+pg]` | @StaffAccess | — | `PageResponse<VacancyResponse>` | по конкурсу |
| GET | `/v1/vacancy/available` `[+pg]` | @CandidateAccess | — | `PageResponse<VacancyResponse>` | опубликованные для резервиста |
| POST | `/v1/vacancy-application` | @CandidateAccess | `ApplyToVacancyRequest` | `VacancyApplicationResponse` (201) | откликнуться из резерва |
| POST | `/v1/vacancy-application/{applicationId}/withdraw` | @CandidateAccess | — | `VacancyApplicationResponse` | отозвать |
| POST | `/v1/vacancy-application/{applicationId}/confirm` | @CandidateAccess | — | `VacancyApplicationResponse` | подтвердить предложение |
| POST | `/v1/vacancy-application/{applicationId}/sunush` | @StaffAccess | — | `VacancyApplicationResponse` | сформировать представление (4107 если есть) |
| POST | `/v1/vacancy-application/{applicationId}/sunush/confirm` | @StaffAccess | — | `VacancyApplicationResponse` | подтвердить подписанное |
| GET | `/v1/vacancy-application/my` | @CandidateAccess | — | `List<VacancyApplicationResponse>` | мои отклики |
| GET | `/v1/vacancy-application/by-vacancy/{vacancyId}` | @StaffAccess | — | `List<VacancyApplicationResponse>` | отклики с голосами |

**Внутренние** (снаружи 404): `POST /v1/internal/otp/validate`.

### 13.4 audit-service

| Метод | Путь | Доступ | Тело | Ответ | Назначение |
|---|---|---|---|---|---|
| GET | `/v1/audit` `[userId, username, entityType, actionType, eventType, from, to, success, +pg (size=50, sort=occurredAt,desc)]` | @AdminAccess | — | `PageResponse<AuditLogResponse>` | журнал с фильтрами (AND) |
| GET | `/v1/audit/users/{userId}` `[from, to, +pg]` | @AdminAccess | — | `PageResponse<AuditLogResponse>` | журнал пользователя |

- `username` — регистронезависимый «содержит». `from` включительно, `to` исключительно, ISO date-time.
- `entityType`: AUTH, USER, PROFILE, PROFILE_SECTION, ADDITIONAL_INFO, APPLICATION, CONTEST, QUESTION_BANK, TEST, ESSAY, MEETING, VOTE, INTERVIEW, DOCUMENT_ASSESSMENT, COMPLAINT, DECISION, DOCUMENT, FILE, SIGNATURE, JUDGE_CONFIRMATION, JUDGE_APPLICATION, VACANCY, VACANCY_APPLICATION, RESERVE, NOTIFICATION, DIRECTORY, HOLIDAY, SETTINGS, REFERENCE_DOCUMENT, AUDIT_LOG.
- `actionType`: LOGIN, LOGOUT, REGISTRATION, VIEW, SAVE, UPDATE, DELETE, EXPORT, IMPORT, PRINT, PROCESS, CONFIGURE.
- `AuditLogResponse`: `{id, eventType, entityType, actionType, serviceName, traceId, userId, username, roles, ipAddress, userAgent, httpMethod, uri, routePattern, success, durationMs, errorMessage, occurredAt, receivedAt}`.

**Внутренние** (снаружи 404): `POST /internal/audit/batch`.

---

## 14. Замечания по контракту (для фронта и бэкенда)

Неоднородности, на которые клиенту стоит закладываться, а бэкенду — исправить в рамках Р1 (необязательные поля / новые маршруты):

- `PUT /v1/judge-applications/{id}/document-score` возвращает JPA-сущность, не DTO.
- `DELETE /v1/contest/{contestId}` возвращает 200 с телом, не 204.
- `POST /v1/vacancy/{vacancyId}/meeting` возвращает голое число.
- `PATCH /v1/notifications/read-all`, `POST /v1/notifications/interview-invitation` возвращают `Map`.
- Пустые 200 вместо 204: `PUT /v1/directory/{code}/sort-order`, `POST /v1/oep/send-pin`, `PATCH /v1/meeting/{id}/candidates/{appId}/unlock`.
- Без `@Valid`: `ReadyRequest`, `JudgeRequests.Ready`, `SignRequest` — ошибки валидации по ним не придут как 4001 с `fields`.
- Префиксы путей смешаны: ед. число (`/contest`, `/meeting`, `/vote`, `/decision`, `/vacancy`, `/file`) и мн. (`/complaints`, `/interviews`, `/documents`, `/questions`, `/tests`, `/holidays`, `/notifications`).
