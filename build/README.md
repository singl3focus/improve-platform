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

## 3. Поведение БД при старте

Compose-стек **не сбрасывает данные** при старте. Существующий volume PostgreSQL сохраняется,
а сервис `migrations` автоматически выполняет `migrate up` и доводит схему до актуальной версии.

- На пустой БД миграции разворачивают схему с нуля.
- На уже инициализированной БД применяются только недостающие миграции.
- Если схема уже актуальна, состояние `no change` считается успешным и не блокирует запуск `backend`.

## 4. Первый запуск: миграции БД

Сервис `migrations` запускается автоматически при каждом `docker compose up -d --build`,
применяет SQL-файлы из `backend/migrations` через `golang-migrate`
и завершается со статусом `0`. `backend` стартует только после успешного завершения миграций.

```powershell
docker compose -f build/docker-compose.yml up -d --build
docker compose -f build/docker-compose.yml logs migrations --tail=100
```

## 5. Rollback миграций

`docker compose down` **не откатывает** миграции. Остановка стека и откат схемы БД — это разные операции.

- Проверить текущую версию миграций:

```powershell
docker compose -f build/docker-compose.yml run --rm migrations version
```

- Откатить последнюю миграцию:

```powershell
docker compose -f build/docker-compose.yml run --rm -e MIGRATIONS_ALLOW_DESTRUCTIVE=true migrations down 1
```

- Откатиться к конкретной версии:

```powershell
docker compose -f build/docker-compose.yml run --rm -e MIGRATIONS_ALLOW_DESTRUCTIVE=true migrations goto 5
```

- Повторно применить миграции после rollback:

```powershell
docker compose -f build/docker-compose.yml up -d --build
```

Ограничения rollback:

- `down`-миграции обратимы по схеме, но не всегда восстанавливают данные.
- Миграции, которые удаляют столбцы или таблицы, не могут вернуть содержимое автоматически. Для production это означает: перед релизом с destructive-миграциями нужен backup или snapshot БД.
- Откат `000004_multiple_roadmaps` назад к одной roadmap на пользователя допускается только если в данных всё ещё не появилось больше одной roadmap на пользователя. Иначе миграция завершится ошибкой и это корректное защитное поведение.

## 6. Проверка работоспособности

| Что проверить | Как |
|---------------|-----|
| Конфигурация compose | `docker compose -f build/docker-compose.yml config` — без ошибок |
| Контейнеры запущены | `docker compose -f build/docker-compose.yml ps` — postgres, backend, frontend в состоянии Up; `migrations` завершился как `Exited (0)` |
| Миграции БД | `docker compose -f build/docker-compose.yml logs migrations --tail=100` — в логах есть успешное применение миграций или `no change` |
| Backend health | В браузере или curl: `http://localhost:8080/readyz` — ответ `{"status":"ok"}` |
| Frontend | В браузере: `http://localhost:3000` — открывается приложение |
| Регистрация/логин | Через UI (например, регистрация и вход) — запросы идут на backend |

## 7. Остановка

```powershell
docker compose -f build/docker-compose.yml down
```

Данные PostgreSQL сохраняются в volume `build_postgres_data`. Чтобы удалить и их: `docker compose -f build/docker-compose.yml down -v`.
