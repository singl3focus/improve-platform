package dateutil

import (
	"fmt"
	"time"
)

const layout = "2006-01-02"

// Format converts *time.Time to *string in "YYYY-MM-DD" format. Returns nil if t is nil.
func Format(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(layout)
	return &s
}

// Parse converts *string in "YYYY-MM-DD" format to *time.Time. Returns nil if s is nil or empty.
func Parse(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse(layout, *s)
	if err != nil {
		return nil, fmt.Errorf("invalid date format, expected YYYY-MM-DD: %w", err)
	}
	return &t, nil
}

// Equal compares two *time.Time pointers for equality, treating two nils as equal.
func Equal(a, b *time.Time) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.Equal(*b)
}

// ToAny converts *time.Time to any ("YYYY-MM-DD" string or nil), useful for SQL parameters.
func ToAny(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.Format(layout)
}
