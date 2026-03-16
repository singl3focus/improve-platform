package notify

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"testing"
	"time"
)

type mockQuerier struct {
	overdue  []DeadlineTask
	dueToday []DeadlineTask
	err      error
}

func (m *mockQuerier) GetDeadlineTasks(_ context.Context, _ time.Time) ([]DeadlineTask, []DeadlineTask, error) {
	return m.overdue, m.dueToday, m.err
}

type mockSender struct {
	called  bool
	summary DailySummary
	err     error
}

func (m *mockSender) SendDailySummary(_ context.Context, s DailySummary) error {
	m.called = true
	m.summary = s
	return m.err
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
}

func TestNextRun_FutureToday(t *testing.T) {
	s := NewScheduler(nil, nil, 14, 30, time.UTC, testLogger())
	now := time.Date(2026, 3, 14, 10, 0, 0, 0, time.UTC)
	next := s.nextRun(now)

	expected := time.Date(2026, 3, 14, 14, 30, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestNextRun_PastToday(t *testing.T) {
	s := NewScheduler(nil, nil, 9, 0, time.UTC, testLogger())
	now := time.Date(2026, 3, 14, 10, 0, 0, 0, time.UTC)
	next := s.nextRun(now)

	expected := time.Date(2026, 3, 15, 9, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestNextRun_ExactTime(t *testing.T) {
	s := NewScheduler(nil, nil, 9, 0, time.UTC, testLogger())
	now := time.Date(2026, 3, 14, 9, 0, 0, 0, time.UTC)
	next := s.nextRun(now)

	expected := time.Date(2026, 3, 15, 9, 0, 0, 0, time.UTC)
	if !next.Equal(expected) {
		t.Errorf("expected %v, got %v", expected, next)
	}
}

func TestExecuteNow_SendsSummary(t *testing.T) {
	overdue := []DeadlineTask{
		{ID: "1", Title: "Old task", Deadline: time.Date(2026, 3, 12, 0, 0, 0, 0, time.UTC)},
	}
	today := []DeadlineTask{
		{ID: "2", Title: "Today task", Deadline: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)},
	}
	querier := &mockQuerier{overdue: overdue, dueToday: today}
	sender := &mockSender{}
	s := NewScheduler(querier, sender, 9, 0, time.UTC, testLogger())

	s.ExecuteNow(context.Background())

	if !sender.called {
		t.Fatal("expected sender to be called")
	}
	if len(sender.summary.Overdue) != 1 {
		t.Errorf("expected 1 overdue, got %d", len(sender.summary.Overdue))
	}
	if len(sender.summary.Today) != 1 {
		t.Errorf("expected 1 today, got %d", len(sender.summary.Today))
	}
}

func TestExecuteNow_NoTasks(t *testing.T) {
	querier := &mockQuerier{}
	sender := &mockSender{}
	s := NewScheduler(querier, sender, 9, 0, time.UTC, testLogger())

	s.ExecuteNow(context.Background())

	if sender.called {
		t.Fatal("expected sender not to be called when no tasks")
	}
}

func TestExecuteNow_QueryError(t *testing.T) {
	querier := &mockQuerier{err: errors.New("db error")}
	sender := &mockSender{}
	s := NewScheduler(querier, sender, 9, 0, time.UTC, testLogger())

	s.ExecuteNow(context.Background())

	if sender.called {
		t.Fatal("expected sender not to be called on query error")
	}
}

func TestExecuteNow_SendError(t *testing.T) {
	today := []DeadlineTask{
		{ID: "1", Title: "Task", Deadline: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)},
	}
	querier := &mockQuerier{dueToday: today}
	sender := &mockSender{err: errors.New("telegram error")}
	s := NewScheduler(querier, sender, 9, 0, time.UTC, testLogger())

	s.ExecuteNow(context.Background())

	if !sender.called {
		t.Fatal("expected sender to be called")
	}
}

func TestRun_StopsOnCancel(t *testing.T) {
	querier := &mockQuerier{}
	sender := &mockSender{}
	s := NewScheduler(querier, sender, 23, 59, time.UTC, testLogger())

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		s.Run(ctx)
		close(done)
	}()

	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("scheduler did not stop after context cancel")
	}
}
