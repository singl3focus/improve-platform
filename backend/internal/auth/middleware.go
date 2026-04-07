package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"github.com/singl3focus/improve-platform/pkg/httpresp"
)

type ctxKey string

const userIDCtxKey ctxKey = "user_id"
const middlewareAccessTokenType = "access"

func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDCtxKey).(string)
	return id, ok
}

// WithUserID sets user_id in context; intended for testing.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDCtxKey, userID)
}

func Middleware(jwtSecret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "missing authorization header")
				return
			}

			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "invalid authorization header format")
				return
			}

			token, err := jwt.Parse(parts[1], func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return jwtSecret, nil
			})
			if err != nil || !token.Valid {
				httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "invalid token claims")
				return
			}

			sub, ok := claims["sub"].(string)
			if !ok || sub == "" {
				httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "missing subject in token")
				return
			}

			tokenType, ok := claims["typ"].(string)
			if !ok || tokenType != middlewareAccessTokenType {
				httpresp.Error(w, http.StatusUnauthorized, "unauthorized", "invalid token type")
				return
			}

			ctx := context.WithValue(r.Context(), userIDCtxKey, sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
