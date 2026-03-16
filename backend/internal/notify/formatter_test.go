package notify

import (
	"strings"
	"testing"
	"time"
)

func TestFormatDailySummary_Empty(t *testing.T) {
	s := DailySummary{Date: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)}
	result := FormatDailySummary(s)
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestFormatDailySummary_OverdueOnly(t *testing.T) {
	s := DailySummary{
		Date: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC),
		Overdue: []DeadlineTask{
			{Title: "Old task", Deadline: time.Date(2026, 3, 12, 0, 0, 0, 0, time.UTC)},
		},
	}
	result := FormatDailySummary(s)
	if !strings.Contains(result, "Overdue (1)") {
		t.Errorf("expected overdue section, got %q", result)
	}
	if !strings.Contains(result, "Old task") {
		t.Errorf("expected task title, got %q", result)
	}
	if !strings.Contains(result, "2d overdue") {
		t.Errorf("expected '2d overdue', got %q", result)
	}
	if strings.Contains(result, "Due Today") {
		t.Errorf("unexpected today section, got %q", result)
	}
}

func TestFormatDailySummary_TodayOnly(t *testing.T) {
	s := DailySummary{
		Date: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC),
		Today: []DeadlineTask{
			{Title: "Today task", Deadline: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)},
		},
	}
	result := FormatDailySummary(s)
	if !strings.Contains(result, "Due Today (1)") {
		t.Errorf("expected today section, got %q", result)
	}
	if !strings.Contains(result, "Today task") {
		t.Errorf("expected task title, got %q", result)
	}
	if strings.Contains(result, "Overdue") {
		t.Errorf("unexpected overdue section, got %q", result)
	}
}

func TestFormatDailySummary_Both(t *testing.T) {
	s := DailySummary{
		Date: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC),
		Overdue: []DeadlineTask{
			{Title: "Overdue 1", Deadline: time.Date(2026, 3, 13, 0, 0, 0, 0, time.UTC)},
		},
		Today: []DeadlineTask{
			{Title: "Today 1", Deadline: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)},
			{Title: "Today 2", Deadline: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)},
		},
	}
	result := FormatDailySummary(s)
	if !strings.Contains(result, "Overdue (1)") {
		t.Errorf("expected overdue section, got %q", result)
	}
	if !strings.Contains(result, "Due Today (2)") {
		t.Errorf("expected today section, got %q", result)
	}
	if !strings.Contains(result, "2026-03-14") {
		t.Errorf("expected date in header, got %q", result)
	}
}

func TestFormatDailySummary_HTMLEscape(t *testing.T) {
	s := DailySummary{
		Date: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC),
		Today: []DeadlineTask{
			{Title: "Task <script>&alert", Deadline: time.Date(2026, 3, 14, 0, 0, 0, 0, time.UTC)},
		},
	}
	result := FormatDailySummary(s)
	if strings.Contains(result, "<script>") {
		t.Errorf("expected HTML to be escaped, got %q", result)
	}
	if !strings.Contains(result, "&lt;script&gt;") {
		t.Errorf("expected escaped HTML, got %q", result)
	}
	if !strings.Contains(result, "&amp;alert") {
		t.Errorf("expected escaped ampersand, got %q", result)
	}
}
