package notify

import (
	"context"
	"log/slog"
	"time"
)

type Scheduler struct {
	querier  TaskQuerier
	sender   Sender
	hour     int
	minute   int
	location *time.Location
	log      *slog.Logger
}

func NewScheduler(querier TaskQuerier, sender Sender, hour, minute int, loc *time.Location, log *slog.Logger) *Scheduler {
	return &Scheduler{
		querier:  querier,
		sender:   sender,
		hour:     hour,
		minute:   minute,
		location: loc,
		log:      log,
	}
}

func (s *Scheduler) Run(ctx context.Context) {
	s.log.Info("notification scheduler started",
		"hour", s.hour,
		"minute", s.minute,
		"timezone", s.location.String(),
	)
	for {
		next := s.nextRun(time.Now().In(s.location))
		s.log.Info("next notification scheduled", "at", next.Format(time.RFC3339))

		timer := time.NewTimer(time.Until(next))
		select {
		case <-ctx.Done():
			timer.Stop()
			s.log.Info("notification scheduler stopped")
			return
		case <-timer.C:
			s.execute(ctx)
		}
	}
}

// ExecuteNow triggers the daily check immediately (useful for testing or manual trigger).
func (s *Scheduler) ExecuteNow(ctx context.Context) {
	s.execute(ctx)
}

func (s *Scheduler) nextRun(now time.Time) time.Time {
	next := time.Date(now.Year(), now.Month(), now.Day(), s.hour, s.minute, 0, 0, s.location)
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
}

func (s *Scheduler) execute(ctx context.Context) {
	now := time.Now().In(s.location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	s.log.Info("executing daily deadline check", "date", today.Format("2006-01-02"))

	overdue, dueToday, err := s.querier.GetDeadlineTasks(ctx, today)
	if err != nil {
		s.log.Error("failed to query deadline tasks", "error", err)
		return
	}

	summary := DailySummary{
		Date:    today,
		Overdue: overdue,
		Today:   dueToday,
	}

	if len(summary.Overdue) == 0 && len(summary.Today) == 0 {
		s.log.Info("no deadline tasks found, skipping notification")
		return
	}

	s.log.Info("sending daily summary",
		"overdue_count", len(summary.Overdue),
		"today_count", len(summary.Today),
	)

	if err := s.sender.SendDailySummary(ctx, summary); err != nil {
		s.log.Error("failed to send daily summary", "error", err)
		return
	}

	s.log.Info("daily summary sent successfully")
}
