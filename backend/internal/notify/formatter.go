package notify

import (
	"fmt"
	"math"
	"strings"
	"time"
)

func FormatDailySummary(summary DailySummary) string {
	if len(summary.Overdue) == 0 && len(summary.Today) == 0 {
		return ""
	}

	var b strings.Builder
	dateStr := summary.Date.Format("2006-01-02")
	b.WriteString(fmt.Sprintf("<b>📋 Daily Deadline Summary — %s</b>\n", dateStr))

	if len(summary.Overdue) > 0 {
		b.WriteString(fmt.Sprintf("\n<b>⚠️ Overdue (%d):</b>\n", len(summary.Overdue)))
		for _, t := range summary.Overdue {
			days := int(math.Ceil(summary.Date.Sub(t.Deadline.Truncate(24*time.Hour)).Hours() / 24))
			b.WriteString(fmt.Sprintf("• %s <i>(due %s, %dd overdue)</i>\n",
				escapeHTML(t.Title), t.Deadline.Format("2006-01-02"), days))
		}
	}

	if len(summary.Today) > 0 {
		b.WriteString(fmt.Sprintf("\n<b>📅 Due Today (%d):</b>\n", len(summary.Today)))
		for _, t := range summary.Today {
			b.WriteString(fmt.Sprintf("• %s\n", escapeHTML(t.Title)))
		}
	}

	return b.String()
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}
