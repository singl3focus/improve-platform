package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	apperr "improve-platform/pkg/errors"
)

const (
	accessTokenTTL   = 15 * time.Minute
	refreshTokenTTL  = 14 * 24 * time.Hour
	accessTokenType  = "access"
	refreshTokenType = "refresh"
)

type UseCase struct {
	repo      Repository
	jwtSecret []byte
}

func NewUseCase(repo Repository, jwtSecret string) *UseCase {
	return &UseCase{
		repo:      repo,
		jwtSecret: []byte(jwtSecret),
	}
}

func (uc *UseCase) Register(ctx context.Context, fullName, email, password string) (TokenResponse, error) {
	const op apperr.Op = "UseCase.Register"
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return TokenResponse{}, apperr.E(op, apperr.Fmt("hash password: %w", err))
	}

	user, err := uc.repo.Create(ctx, fullName, email, string(hash))
	if err != nil {
		return TokenResponse{}, apperr.E(op, err)
	}

	session, err := uc.issueSession(user.ID)
	if err != nil {
		return TokenResponse{}, apperr.E(op, apperr.Fmt("issue session: %w", err))
	}

	return session, nil
}

func (uc *UseCase) Login(ctx context.Context, email, password string) (TokenResponse, error) {
	const op apperr.Op = "UseCase.Login"
	user, err := uc.repo.FindByEmail(ctx, email)
	if err != nil {
		return TokenResponse{}, apperr.E(op, err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return TokenResponse{}, apperr.E(op, ErrInvalidCredentials)
	}

	session, err := uc.issueSession(user.ID)
	if err != nil {
		return TokenResponse{}, apperr.E(op, apperr.Fmt("issue session: %w", err))
	}

	return session, nil
}

func (uc *UseCase) Refresh(ctx context.Context, refreshToken string) (TokenResponse, error) {
	const op apperr.Op = "UseCase.Refresh"

	userID, err := uc.parseRefreshToken(refreshToken)
	if err != nil {
		return TokenResponse{}, apperr.E(op, ErrInvalidRefreshToken)
	}

	session, err := uc.issueSession(userID)
	if err != nil {
		return TokenResponse{}, apperr.E(op, apperr.Fmt("issue session: %w", err))
	}

	return session, nil
}

func (uc *UseCase) Logout(_ context.Context, refreshToken string) error {
	const op apperr.Op = "UseCase.Logout"

	if _, err := uc.parseRefreshToken(refreshToken); err != nil {
		return apperr.E(op, ErrInvalidRefreshToken)
	}

	return nil
}

func (uc *UseCase) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (UserResponse, error) {
	const op apperr.Op = "UseCase.UpdateProfile"

	user, err := uc.repo.FindByID(ctx, userID)
	if err != nil {
		return UserResponse{}, apperr.E(op, err)
	}

	if req.Email != nil || req.NewPassword != nil {
		if req.CurrentPassword == nil || *req.CurrentPassword == "" {
			return UserResponse{}, apperr.E(op, ErrWrongPassword)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(*req.CurrentPassword)); err != nil {
			return UserResponse{}, apperr.E(op, ErrWrongPassword)
		}
	}

	newFullName := user.FullName
	if req.FullName != nil && *req.FullName != "" {
		newFullName = *req.FullName
	}

	newEmail := user.Email
	if req.Email != nil && *req.Email != "" {
		newEmail = *req.Email
	}

	newPasswordHash := user.PasswordHash
	if req.NewPassword != nil && *req.NewPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(*req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return UserResponse{}, apperr.E(op, apperr.Fmt("hash password: %w", err))
		}
		newPasswordHash = string(hash)
	}

	updated, err := uc.repo.UpdateUser(ctx, userID, newFullName, newEmail, newPasswordHash)
	if err != nil {
		return UserResponse{}, apperr.E(op, err)
	}

	return UserResponse{
		ID:        updated.ID,
		FullName:  updated.FullName,
		Email:     updated.Email,
		CreatedAt: updated.CreatedAt,
	}, nil
}

func (uc *UseCase) GetCurrentUser(ctx context.Context, userID string) (UserResponse, error) {
	const op apperr.Op = "UseCase.GetCurrentUser"
	user, err := uc.repo.FindByID(ctx, userID)
	if err != nil {
		return UserResponse{}, apperr.E(op, err)
	}

	return UserResponse{
		ID:        user.ID,
		FullName:  user.FullName,
		Email:     user.Email,
		CreatedAt: user.CreatedAt,
	}, nil
}

func (uc *UseCase) issueSession(userID string) (TokenResponse, error) {
	accessToken, err := uc.generateToken(userID, accessTokenType, accessTokenTTL)
	if err != nil {
		return TokenResponse{}, err
	}

	refreshToken, err := uc.generateToken(userID, refreshTokenType, refreshTokenTTL)
	if err != nil {
		return TokenResponse{}, err
	}

	return TokenResponse{
		AccessToken:      accessToken,
		RefreshToken:     refreshToken,
		AccessExpiresIn:  int64(accessTokenTTL / time.Second),
		RefreshExpiresIn: int64(refreshTokenTTL / time.Second),
	}, nil
}

func (uc *UseCase) generateToken(userID, tokenType string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": userID,
		"typ": tokenType,
		"iat": now.Unix(),
		"exp": now.Add(ttl).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(uc.jwtSecret)
}

func (uc *UseCase) parseRefreshToken(refreshToken string) (string, error) {
	if refreshToken == "" {
		return "", fmt.Errorf("empty refresh token")
	}

	token, err := jwt.Parse(refreshToken, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return uc.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid token claims")
	}

	tokenType, ok := claims["typ"].(string)
	if !ok || tokenType != refreshTokenType {
		return "", fmt.Errorf("token is not refresh")
	}

	userID, ok := claims["sub"].(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("missing subject in token")
	}

	return userID, nil
}
