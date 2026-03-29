package note

import (
	"context"
	"errors"
	"time"
)

var ErrNoteNotFound = errors.New("note not found")

// Domain model

type Note struct {
	ID        string
	UserID    string
	TopicID   string
	Title     string
	Content   string
	Position  int
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Request types

type CreateNoteRequest struct {
	TopicID string `json:"topic_id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type UpdateNoteRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// Response types

type NoteResponse struct {
	ID        string    `json:"id"`
	TopicID   string    `json:"topic_id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Interfaces

type Repository interface {
	Create(ctx context.Context, n Note) (Note, error)
	GetByID(ctx context.Context, userID, noteID string) (Note, error)
	ListByTopic(ctx context.Context, userID, topicID string) ([]Note, error)
	Update(ctx context.Context, userID, noteID, title, content string) (Note, error)
	Delete(ctx context.Context, userID, noteID string) error
}

type Service interface {
	Create(ctx context.Context, userID string, req CreateNoteRequest) (NoteResponse, error)
	GetByID(ctx context.Context, userID, noteID string) (NoteResponse, error)
	ListByTopic(ctx context.Context, userID, topicID string) ([]NoteResponse, error)
	Update(ctx context.Context, userID, noteID string, req UpdateNoteRequest) (NoteResponse, error)
	Delete(ctx context.Context, userID, noteID string) error
}
