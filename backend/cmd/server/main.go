package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"improve-platform/internal/config"
	"improve-platform/internal/notify"
	"improve-platform/internal/server"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: parseLogLevel(cfg.LogLevel),
	}))
	slog.SetDefault(log)

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	schedCtx, schedCancel := context.WithCancel(ctx)
	defer schedCancel()
	if cfg.TelegramBotToken != "" {
		startNotifyScheduler(schedCtx, cfg, pool, log)
	} else {
		log.Info("telegram notifications disabled: TELEGRAM_BOT_TOKEN not set")
	}

	srv := server.New(cfg, pool, log)
	if err := srv.Run(ctx); err != nil {
		log.Error("server error", "error", err)
		os.Exit(1)
	}
}

func startNotifyScheduler(ctx context.Context, cfg *config.Config, pool *pgxpool.Pool, log *slog.Logger) {
	loc, err := time.LoadLocation(cfg.NotifyTimezone)
	if err != nil {
		log.Error("invalid NOTIFY_TIMEZONE, falling back to UTC", "timezone", cfg.NotifyTimezone, "error", err)
		loc = time.UTC
	}

	sender, err := notify.NewTelegramSender(cfg.TelegramBotToken, cfg.TelegramChatID, log)
	if err != nil {
		log.Error("failed to create telegram sender, notifications disabled", "error", err)
		return
	}

	repo := notify.NewRepo(pool)
	sched := notify.NewScheduler(repo, sender, cfg.NotifyHour, cfg.NotifyMinute, loc, log)
	go sched.Run(ctx)
}

func parseLogLevel(s string) slog.Level {
	switch strings.ToLower(s) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
