# Tech Debt Review — Improve Platform

Дата: 2026-03-28

---

## CRITICAL — Исправить в первую очередь

| # | Проблема | Где |
|---|----------|-----|
| 1 | **Игнорируемые ошибки БД** — `_ = r.pool.QueryRow(...)` возвращает 0 при сбое запроса, давая некорректные данные | `backend/internal/dashboard/repo.go:299-303` |
| 2 | **Ошибки auth без error wrapping** — `fmt.Errorf()` вместо `apperr.E(op, ...)`, ломает трейсинг ошибок | `backend/internal/auth/usecase.go:196-221` |
| 3 | **Утечка ресурсов** — ручной `rows.Close()` вместо `defer rows.Close()` в 6 запросах | `backend/internal/dashboard/repo.go:127-283` |

---

## HIGH — Сделать скоро

### Backend

| # | Проблема | Где |
|---|----------|-----|
| 4 | **Дублирование UUID-валидации** — `uuidPathParamPattern` скопирован в 3 handler-файла | `task/handler.go:20`, `material/handler.go:20`, `roadmap/handler.go:20` |
| 5 | **Дублирование date-утилит** — `parseDate`, `formatDate` дублируются | `task/usecase.go:351-388`, `roadmap/usecase.go:457-477` |
| 6 | **Dashboard handler без error discrimination** — все ошибки отдают 500, хотя другие handlers различают 400/404/500 | `backend/internal/dashboard/handler.go:20-80` |
| 7 | **Нет тестов для 6 пакетов** — dashboard (repo + usecase), history, notify, material/repo, auth/repo | Отсутствуют файлы `_test.go` |
| 8 | **Рассогласование миграций и кода** — миграции 000003 и 000004 уже в репо, но фичи не реализованы в коде | `backend/migrations/000003_*`, `000004_*` |

### Frontend

| # | Проблема | Где |
|---|----------|-----|
| 9 | **Дублированный error handling в 42 API routes** — одинаковый try-catch boilerplate | Все файлы `app/api/*/route.ts` |
| 10 | **3 разных реализации парсинга ошибок** — auth, backend-client, и api-error каждый по-своему парсят | `app/api/auth/_shared.ts`, `src/shared/api/backend-client.ts`, `src/features/auth/lib/api-error.ts` |
| 11 | **Unsafe type casting без type guards** — `as` касты на ответы бэкенда без проверки | `app/api/roadmaps/[roadmapId]/route.ts:146-157`, `app/api/roadmap/route.ts:164` |
| 12 | **Дублированный `parseErrorMessage`** — идентичная функция в двух view-model хуках | `tasks/hooks/use-tasks-board-view-model.ts:73-83`, `materials/hooks/use-materials-library-view-model.ts:78-88` |

### Инфраструктура

| # | Проблема | Где |
|---|----------|-----|
| 13 | **Нет CI/CD** — нет автоматических тестов, линтинга, сборки на push | Отсутствует `.github/workflows/` |
| 14 | **Деструктивный сброс БД при каждом старте** — `DROP SCHEMA public CASCADE` в docker-compose | `build/docker-compose.yml` |

---

## MEDIUM — Улучшить при случае

| # | Проблема | Где |
|---|----------|-----|
| 15 | **Несогласованная работа с Secure cookies** — auth использует `x-forwarded-proto`, dashboard — `NODE_ENV === "production"` | `app/api/auth/_shared.ts:214-221` vs `backend-client.ts:108-129` |
| 16 | **Несогласованное логирование ошибок** — dashboard handler не использует `apperr.OpsTrace()` | `dashboard/handler.go:28-32` |
| 17 | **Разная валидация в POST handlers** — где-то `payload-parsers`, где-то inline проверки | `app/api/materials/route.ts` vs `app/api/roadmap/topics/route.ts` |
| 18 | **Минимальный ESLint** — только `next/core-web-vitals`, нет `@typescript-eslint`, `react-hooks` правил | `frontend/.eslintrc.json` |
| 19 | **Захардкоженный список test-файлов** — новые тесты нужно руками добавлять в `includes` | `frontend/tsconfig.test.json` |
| 20 | **Lint violations подавлены** — `max-issues-per-linter: 50` в конфиге Go-линтера | `backend/.golangci.yml` |
| 21 | **Непоследовательная обработка FK constraints** — в material/repo есть, в task/repo и history/repo нет | `backend/internal/material/repo.go` vs остальные |
| 22 | **Низкое покрытие тестами фронтенда** — ~8% по файлам, нет тестов API routes и view model hooks | `frontend/src/` |

---

## LOW — Nice to have

| # | Проблема |
|---|----------|
| 23 | Нет `.dockerignore` файлов — избыточный размер образов |
| 24 | Нет root-level Makefile для оркестрации монорепо |
| 25 | Нет конфигурации connection pool через env vars |
| 26 | `skipLibCheck: true` в tsconfig скрывает проблемы в типах |
| 27 | Silent error swallowing в catch-блоках фронтенда — нет логирования |
| 28 | Минимальный `next.config.mjs` — нет оптимизации изображений, сжатия |

---

## Рекомендуемый план действий

### Фаза 1 — Стабильность (пункты 1-3, 6, 16)

Починить игнорируемые ошибки, утечки ресурсов, error wrapping в auth — всё, что может давать некорректное поведение прямо сейчас.

### Фаза 2 — Устранение дублирования (пункты 4, 5, 9, 10, 12)

Выделить общие утилиты: UUID-валидация, date-утилиты, error parsing, error handling wrapper для API routes.

### Фаза 3 — Типобезопасность и валидация (пункты 11, 15, 17, 21)

Type guards для ответов бэкенда, единый подход к валидации, согласованная работа с cookies и FK constraints.

### Фаза 4 — Тестирование (пункты 7, 13, 22)

Добавить тесты для непокрытых пакетов бэкенда, критичных API routes фронтенда, настроить CI/CD pipeline.

### Фаза 5 — Инфраструктура (пункты 14, 18-20, 23-28)

Исправить деструктивный reset БД, ужесточить линтинг, добавить Makefile для монорепо.
