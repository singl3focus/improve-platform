package auth_test

import (
	"context"
	"errors"
	"testing"

	"improve-platform/internal/auth"
)

type mockRepo struct {
	createFn      func(ctx context.Context, fullName, email, hash string) (auth.User, error)
	findByEmailFn func(ctx context.Context, email string) (auth.User, error)
	findByIDFn    func(ctx context.Context, id string) (auth.User, error)
}

func (m *mockRepo) Create(ctx context.Context, fullName, email, hash string) (auth.User, error) {
	return m.createFn(ctx, fullName, email, hash)
}

func (m *mockRepo) FindByEmail(ctx context.Context, email string) (auth.User, error) {
	return m.findByEmailFn(ctx, email)
}

func (m *mockRepo) FindByID(ctx context.Context, id string) (auth.User, error) {
	return m.findByIDFn(ctx, id)
}

func TestUseCase_Register_Success(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, fullName, email, hash string) (auth.User, error) {
			return auth.User{ID: "uuid-1", FullName: fullName, Email: email, PasswordHash: hash}, nil
		},
	}

	uc := auth.NewUseCase(repo, "test-secret")
	resp, err := uc.Register(context.Background(), "Ada Lovelace", "user@example.com", "password123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if resp.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
	if resp.AccessExpiresIn <= 0 || resp.RefreshExpiresIn <= 0 {
		t.Errorf("expected positive token ttl values, got access=%d refresh=%d", resp.AccessExpiresIn, resp.RefreshExpiresIn)
	}
}

func TestUseCase_Register_EmailExists(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, _, _, _ string) (auth.User, error) {
			return auth.User{}, auth.ErrEmailExists
		},
	}

	uc := auth.NewUseCase(repo, "test-secret")
	_, err := uc.Register(context.Background(), "Ada Lovelace", "dup@example.com", "password123")
	if !errors.Is(err, auth.ErrEmailExists) {
		t.Fatalf("expected ErrEmailExists, got %v", err)
	}
}

func TestUseCase_Login_Success(t *testing.T) {
	repo := &mockRepo{}
	uc := auth.NewUseCase(repo, "test-secret")

	var storedHash string
	repo.createFn = func(_ context.Context, fullName, email, hash string) (auth.User, error) {
		storedHash = hash
		return auth.User{ID: "uuid-1", FullName: fullName, Email: email, PasswordHash: hash}, nil
	}

	_, err := uc.Register(context.Background(), "Ada Lovelace", "user@example.com", "password123")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	repo.findByEmailFn = func(_ context.Context, email string) (auth.User, error) {
		return auth.User{ID: "uuid-1", Email: email, PasswordHash: storedHash}, nil
	}

	resp, err := uc.Login(context.Background(), "user@example.com", "password123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if resp.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
}

func TestUseCase_Login_WrongPassword(t *testing.T) {
	repo := &mockRepo{}
	uc := auth.NewUseCase(repo, "test-secret")

	var storedHash string
	repo.createFn = func(_ context.Context, fullName, email, hash string) (auth.User, error) {
		storedHash = hash
		return auth.User{ID: "uuid-1", FullName: fullName, Email: email, PasswordHash: hash}, nil
	}
	_, _ = uc.Register(context.Background(), "Ada Lovelace", "user@example.com", "password123")

	repo.findByEmailFn = func(_ context.Context, email string) (auth.User, error) {
		return auth.User{ID: "uuid-1", Email: email, PasswordHash: storedHash}, nil
	}

	_, err := uc.Login(context.Background(), "user@example.com", "wrongpassword")
	if !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestUseCase_Login_UserNotFound(t *testing.T) {
	repo := &mockRepo{
		findByEmailFn: func(_ context.Context, _ string) (auth.User, error) {
			return auth.User{}, auth.ErrUserNotFound
		},
	}

	uc := auth.NewUseCase(repo, "test-secret")
	_, err := uc.Login(context.Background(), "noone@example.com", "password123")
	if !errors.Is(err, auth.ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestUseCase_GetCurrentUser_Success(t *testing.T) {
	repo := &mockRepo{
		findByIDFn: func(_ context.Context, id string) (auth.User, error) {
			return auth.User{ID: id, FullName: "Ada Lovelace", Email: "user@example.com"}, nil
		},
	}

	uc := auth.NewUseCase(repo, "test-secret")
	resp, err := uc.GetCurrentUser(context.Background(), "uuid-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.ID != "uuid-1" {
		t.Errorf("expected ID uuid-1, got %s", resp.ID)
	}
	if resp.Email != "user@example.com" {
		t.Errorf("expected email user@example.com, got %s", resp.Email)
	}
	if resp.FullName != "Ada Lovelace" {
		t.Errorf("expected full name Ada Lovelace, got %s", resp.FullName)
	}
}

func TestUseCase_GetCurrentUser_NotFound(t *testing.T) {
	repo := &mockRepo{
		findByIDFn: func(_ context.Context, _ string) (auth.User, error) {
			return auth.User{}, auth.ErrUserNotFound
		},
	}

	uc := auth.NewUseCase(repo, "test-secret")
	_, err := uc.GetCurrentUser(context.Background(), "nonexistent")
	if !errors.Is(err, auth.ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestUseCase_Refresh_Success(t *testing.T) {
	repo := &mockRepo{
		createFn: func(_ context.Context, fullName, email, hash string) (auth.User, error) {
			return auth.User{ID: "uuid-1", FullName: fullName, Email: email, PasswordHash: hash}, nil
		},
	}
	uc := auth.NewUseCase(repo, "test-secret")

	registerResp, err := uc.Register(context.Background(), "Ada Lovelace", "user@example.com", "password123")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	refreshResp, err := uc.Refresh(context.Background(), registerResp.RefreshToken)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if refreshResp.AccessToken == "" || refreshResp.RefreshToken == "" {
		t.Fatalf("expected non-empty token pair, got %+v", refreshResp)
	}
}

func TestUseCase_Refresh_InvalidToken(t *testing.T) {
	repo := &mockRepo{}
	uc := auth.NewUseCase(repo, "test-secret")

	_, err := uc.Refresh(context.Background(), "bad-token")
	if !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
}

func TestUseCase_Logout_InvalidToken(t *testing.T) {
	repo := &mockRepo{}
	uc := auth.NewUseCase(repo, "test-secret")

	err := uc.Logout(context.Background(), "bad-token")
	if !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
}
