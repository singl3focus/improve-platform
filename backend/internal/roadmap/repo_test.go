package roadmap

import "testing"

func TestResolveDirectionalInsertPlan(t *testing.T) {
	tests := []struct {
		name            string
		direction       TopicCreateDirection
		currentPosition int
		maxPosition     int
		wantPosition    int
		wantShift       bool
	}{
		{
			name:            "left inserts at current position",
			direction:       TopicCreateDirectionLeft,
			currentPosition: 5,
			maxPosition:     9,
			wantPosition:    5,
			wantShift:       true,
		},
		{
			name:            "right inserts right after current",
			direction:       TopicCreateDirectionRight,
			currentPosition: 5,
			maxPosition:     9,
			wantPosition:    6,
			wantShift:       true,
		},
		{
			name:            "below keeps current position to preserve below layout contract",
			direction:       TopicCreateDirectionBelow,
			currentPosition: 5,
			maxPosition:     9,
			wantPosition:    5,
			wantShift:       false,
		},
		{
			name:            "invalid direction falls back to append",
			direction:       TopicCreateDirection("diagonal"),
			currentPosition: 5,
			maxPosition:     9,
			wantPosition:    10,
			wantShift:       false,
		},
		{
			name:            "below ignores greater maximum position",
			direction:       TopicCreateDirectionBelow,
			currentPosition: 2,
			maxPosition:     20,
			wantPosition:    2,
			wantShift:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveDirectionalInsertPlan(tt.direction, tt.currentPosition, tt.maxPosition)
			if got.insertPosition != tt.wantPosition {
				t.Fatalf("expected position %d, got %d", tt.wantPosition, got.insertPosition)
			}
			if got.shiftExisting != tt.wantShift {
				t.Fatalf("expected shift=%t, got %t", tt.wantShift, got.shiftExisting)
			}
		})
	}
}

func TestTopicCreateDirectionIsValid(t *testing.T) {
	if !TopicCreateDirectionLeft.IsValid() {
		t.Fatal("left must be valid")
	}
	if !TopicCreateDirectionRight.IsValid() {
		t.Fatal("right must be valid")
	}
	if !TopicCreateDirectionBelow.IsValid() {
		t.Fatal("below must be valid")
	}
	if TopicCreateDirection("diagonal").IsValid() {
		t.Fatal("diagonal must be invalid")
	}
}
