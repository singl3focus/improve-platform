package notify

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
)

type TelegramSender struct {
	bot    *bot.Bot
	chatID int64
	log    *slog.Logger
}

func NewTelegramSender(token string, chatID int64, log *slog.Logger) (*TelegramSender, error) {
	b, err := bot.New(token)
	if err != nil {
		return nil, fmt.Errorf("create telegram bot: %w", err)
	}
	return &TelegramSender{bot: b, chatID: chatID, log: log}, nil
}

func (s *TelegramSender) SendDailySummary(ctx context.Context, summary DailySummary) error {
	text := FormatDailySummary(summary)
	if text == "" {
		return nil
	}

	_, err := s.bot.SendMessage(ctx, &bot.SendMessageParams{
		ChatID:    s.chatID,
		Text:      text,
		ParseMode: models.ParseModeHTML,
	})
	if err != nil {
		return fmt.Errorf("send telegram message: %w", err)
	}
	return nil
}
