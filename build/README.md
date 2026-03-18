# Запуск MVP локально (Docker Compose)

## 1. Подготовка

- **Docker** и **Docker Compose** должны быть установлены.
- Файл с переменными окружения:
  - Если запускаешь из **корня репозитория**: скопируй `build/.env.example` в **корень** как `.env` и при необходимости отредактируй (обязательно задай `JWT_SECRET`).
  - Если запускаешь из каталога `build/`: достаточно иметь `build/.env` (можно скопировать из `build/.env.example`).

## 2. Запуск из корня репозитория

```powershell
cd C:\Users\Дом\Documents\1GitProjects\improve-platform

# .env должен быть в корне (скопируй из build/.env.example при первом запуске)
docker compose -f build/docker-compose.yml up -d --build
```

## 3. Важно: обязательный reset БД перед миграциями

Текущий compose-стек специально выполняет **destructive reset** БД при старте,
чтобы корректно применялась обновлённая `000001_initial_schema.up.sql` даже на уже существующем volume.

- Сервис `migrations_reset` выполняет `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;` через `psql`.
- Затем сервис `migrations` выполняет `migrate up`.
- Это удаляет все существующие данные в локальной БД.

Используйте этот режим только для локального MVP-окружения.

## 4. Первый запуск: миграции БД

Сервис `migrations` запускается автоматически при каждом `docker compose up -d --build`,
применяет SQL-файлы из `backend/migrations` через `golang-migrate`
и завершается со статусом `0`. `backend` стартует только после успешного завершения миграций.

```powershell
docker compose -f build/docker-compose.yml up -d --build
docker compose -f build/docker-compose.yml logs migrations_reset --tail=100
docker compose -f build/docker-compose.yml logs migrations --tail=100
```

## 5. Проверка работоспособности

| Что проверить | Как |
|---------------|-----|
| Конфигурация compose | `docker compose -f build/docker-compose.yml config` — без ошибок |
| Контейнеры запущены | `docker compose -f build/docker-compose.yml ps` — postgres, backend, frontend в состоянии Up; `migrations_reset` и `migrations` завершились как `Exited (0)` |
| Reset БД | `docker compose -f build/docker-compose.yml logs migrations_reset --tail=100` — в логах есть `Dropped`/`drop` без ошибок |
| Миграции БД | `docker compose -f build/docker-compose.yml logs migrations --tail=100` — в логах есть успешное применение миграций или `no change` |
| Backend health | В браузере или curl: `http://localhost:8080/readyz` — ответ `{"status":"ok"}` |
| Frontend | В браузере: `http://localhost:3000` — открывается приложение |
| Регистрация/логин | Через UI (например, регистрация и вход) — запросы идут на backend |

## 6. Остановка

```powershell
docker compose -f build/docker-compose.yml down
```

Данные PostgreSQL сохраняются в volume `build_postgres_data`. Чтобы удалить и их: `docker compose -f build/docker-compose.yml down -v`.
