package config_test

import (
	"testing"

	"improve-platform/internal/config"
)

func TestLoad_Defaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	t.Setenv("JWT_SECRET", "test-secret-key")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != 8080 {
		t.Errorf("expected default port 8080, got %d", cfg.Port)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("expected default log level 'info', got %s", cfg.LogLevel)
	}
	if cfg.DatabaseURL != "postgres://test:test@localhost:5432/test" {
		t.Errorf("unexpected DatabaseURL: %s", cfg.DatabaseURL)
	}
	if cfg.JWTSecret != "test-secret-key" {
		t.Errorf("unexpected JWTSecret: %s", cfg.JWTSecret)
	}
	if cfg.NotifyHour != 9 {
		t.Errorf("expected default notify hour 9, got %d", cfg.NotifyHour)
	}
	if cfg.NotifyMinute != 0 {
		t.Errorf("expected default notify minute 0, got %d", cfg.NotifyMinute)
	}
	if cfg.NotifyTimezone != "UTC" {
		t.Errorf("expected default notify timezone UTC, got %s", cfg.NotifyTimezone)
	}
}

func TestLoad_CustomPort(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	t.Setenv("JWT_SECRET", "test-secret-key")
	t.Setenv("APP_PORT", "3000")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Port != 3000 {
		t.Errorf("expected port 3000, got %d", cfg.Port)
	}
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("JWT_SECRET", "test-secret-key")

	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error for missing DATABASE_URL")
	}
}

func TestLoad_MissingJWTSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	t.Setenv("JWT_SECRET", "")

	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error for missing JWT_SECRET")
	}
}

func TestLoad_TelegramTokenWithoutChatID(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	t.Setenv("JWT_SECRET", "test-secret-key")
	t.Setenv("TELEGRAM_BOT_TOKEN", "123:ABC")
	t.Setenv("TELEGRAM_CHAT_ID", "0")

	_, err := config.Load()
	if err == nil {
		t.Fatal("expected error when TELEGRAM_BOT_TOKEN set without TELEGRAM_CHAT_ID")
	}
}

func TestLoad_TelegramConfigComplete(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://test:test@localhost:5432/test")
	t.Setenv("JWT_SECRET", "test-secret-key")
	t.Setenv("TELEGRAM_BOT_TOKEN", "123:ABC")
	t.Setenv("TELEGRAM_CHAT_ID", "987654321")
	t.Setenv("NOTIFY_HOUR", "10")
	t.Setenv("NOTIFY_MINUTE", "30")
	t.Setenv("NOTIFY_TIMEZONE", "Europe/Moscow")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.TelegramBotToken != "123:ABC" {
		t.Errorf("unexpected TelegramBotToken: %s", cfg.TelegramBotToken)
	}
	if cfg.TelegramChatID != 987654321 {
		t.Errorf("unexpected TelegramChatID: %d", cfg.TelegramChatID)
	}
	if cfg.NotifyHour != 10 {
		t.Errorf("expected notify hour 10, got %d", cfg.NotifyHour)
	}
	if cfg.NotifyMinute != 30 {
		t.Errorf("expected notify minute 30, got %d", cfg.NotifyMinute)
	}
	if cfg.NotifyTimezone != "Europe/Moscow" {
		t.Errorf("expected timezone Europe/Moscow, got %s", cfg.NotifyTimezone)
	}
}
