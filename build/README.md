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

## 3. Первый запуск: миграции БД

Сервис `migrations` запускается автоматически при каждом `docker compose up -d --build`,
применяет SQL-файлы из `backend/migrations` через `golang-migrate`
и завершается со статусом `0`. `backend` стартует только после успешного завершения миграций.

```powershell
docker compose -f build/docker-compose.yml up -d --build
docker compose -f build/docker-compose.yml logs migrations --tail=100
```

## 4. Проверка работоспособности

| Что проверить | Как |
|---------------|-----|
| Конфигурация compose | `docker compose -f build/docker-compose.yml config` — без ошибок |
| Контейнеры запущены | `docker compose -f build/docker-compose.yml ps` — postgres, backend, frontend в состоянии Up; `migrations` завершился как `Exited (0)` |
| Миграции БД | `docker compose -f build/docker-compose.yml logs migrations --tail=100` — в логах есть успешное применение миграций или `no change` |
| Backend health | В браузере или curl: `http://localhost:8080/readyz` — ответ `{"status":"ok"}` |
| Frontend | В браузере: `http://localhost:3000` — открывается приложение |
| Регистрация/логин | Через UI (например, регистрация и вход) — запросы идут на backend |

## 5. Остановка

```powershell
docker compose -f build/docker-compose.yml down
```

Данные PostgreSQL сохраняются в volume `build_postgres_data`. Чтобы удалить и их: `docker compose -f build/docker-compose.yml down -v`.
