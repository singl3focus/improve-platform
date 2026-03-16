package auth

import (
	"context"
	"errors"
	"time"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrEmailExists         = errors.New("email already exists")
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
)

type User struct {
	ID           string
	FullName     string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	AccessExpiresIn  int64  `json:"access_expires_in"`
	RefreshExpiresIn int64  `json:"refresh_expires_in"`
}

type UserResponse struct {
	ID        string    `json:"id"`
	FullName  string    `json:"full_name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

type Repository interface {
	Create(ctx context.Context, fullName, email, passwordHash string) (User, error)
	FindByEmail(ctx context.Context, email string) (User, error)
	FindByID(ctx context.Context, id string) (User, error)
}

type Service interface {
	Register(ctx context.Context, fullName, email, password string) (TokenResponse, error)
	Login(ctx context.Context, email, password string) (TokenResponse, error)
	Refresh(ctx context.Context, refreshToken string) (TokenResponse, error)
	Logout(ctx context.Context, refreshToken string) error
	GetCurrentUser(ctx context.Context, userID string) (UserResponse, error)
}
