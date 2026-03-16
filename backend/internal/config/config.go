package config

import (
	"fmt"

	"github.com/spf13/viper"
)

type Config struct {
	Port        int    `mapstructure:"APP_PORT"`
	DatabaseURL string `mapstructure:"DATABASE_URL"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`
	JWTSecret   string `mapstructure:"JWT_SECRET"`

	TelegramBotToken string `mapstructure:"TELEGRAM_BOT_TOKEN"`
	TelegramChatID   int64  `mapstructure:"TELEGRAM_CHAT_ID"`
	NotifyHour       int    `mapstructure:"NOTIFY_HOUR"`
	NotifyMinute     int    `mapstructure:"NOTIFY_MINUTE"`
	NotifyTimezone   string `mapstructure:"NOTIFY_TIMEZONE"`
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetDefault("APP_PORT", 8080)
	v.SetDefault("LOG_LEVEL", "info")
	v.SetDefault("NOTIFY_HOUR", 9)
	v.SetDefault("NOTIFY_MINUTE", 0)
	v.SetDefault("NOTIFY_TIMEZONE", "UTC")

	v.AutomaticEnv()

	_ = v.BindEnv("APP_PORT")
	_ = v.BindEnv("DATABASE_URL")
	_ = v.BindEnv("LOG_LEVEL")
	_ = v.BindEnv("JWT_SECRET")
	_ = v.BindEnv("TELEGRAM_BOT_TOKEN")
	_ = v.BindEnv("TELEGRAM_CHAT_ID")
	_ = v.BindEnv("NOTIFY_HOUR")
	_ = v.BindEnv("NOTIFY_MINUTE")
	_ = v.BindEnv("NOTIFY_TIMEZONE")

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	if cfg.TelegramBotToken != "" && cfg.TelegramChatID == 0 {
		return nil, fmt.Errorf("TELEGRAM_CHAT_ID is required when TELEGRAM_BOT_TOKEN is set")
	}

	return &cfg, nil
}
