package auth

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	apperr "improve-platform/pkg/errors"
)

const uniqueViolation = "23505"

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (r *UserRepo) Create(ctx context.Context, fullName, email, passwordHash string) (User, error) {
	const op apperr.Op = "UserRepo.Create"
	var u User
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (full_name, email, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id, full_name, email, password_hash, created_at, updated_at`,
		fullName, email, passwordHash,
	).Scan(&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if apperr.As(err, &pgErr) && pgErr.Code == uniqueViolation {
			return User{}, apperr.E(op, ErrEmailExists)
		}
		return User{}, apperr.E(op, err)
	}
	return u, nil
}

func (r *UserRepo) FindByEmail(ctx context.Context, email string) (User, error) {
	const op apperr.Op = "UserRepo.FindByEmail"
	var u User
	err := r.pool.QueryRow(ctx,
		`SELECT id, full_name, email, password_hash, created_at, updated_at
		 FROM users WHERE email = $1`,
		email,
	).Scan(&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return User{}, apperr.E(op, ErrUserNotFound)
	}
	return u, apperr.E(op, err)
}

func (r *UserRepo) FindByID(ctx context.Context, id string) (User, error) {
	const op apperr.Op = "UserRepo.FindByID"
	var u User
	err := r.pool.QueryRow(ctx,
		`SELECT id, full_name, email, password_hash, created_at, updated_at
		 FROM users WHERE id = $1`,
		id,
	).Scan(&u.ID, &u.FullName, &u.Email, &u.PasswordHash, &u.CreatedAt, &u.UpdatedAt)
	if apperr.Is(err, pgx.ErrNoRows) {
		return User{}, apperr.E(op, ErrUserNotFound)
	}
	return u, apperr.E(op, err)
}
