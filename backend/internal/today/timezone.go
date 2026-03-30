package today

import (
	"context"
	"time"
)

type timezoneContextKey struct{}

const timezoneHeader = "X-Timezone"

func withTimezone(ctx context.Context, timezone string) context.Context {
	if timezone == "" {
		return ctx
	}

	loc, err := time.LoadLocation(timezone)
	if err != nil {
		return ctx
	}

	return context.WithValue(ctx, timezoneContextKey{}, loc)
}

func currentDate(ctx context.Context) time.Time {
	now := time.Now()

	loc, ok := ctx.Value(timezoneContextKey{}).(*time.Location)
	if ok && loc != nil {
		now = now.In(loc)
	}

	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}
