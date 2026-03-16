package handler

import (
	"context"
	"net/http"
	"time"

	"improve-platform/pkg/httpresp"
)

type DBPinger interface {
	Ping(ctx context.Context) error
}

func Healthz() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		httpresp.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func Readyz(db DBPinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		if err := db.Ping(ctx); err != nil {
			httpresp.Error(w, http.StatusServiceUnavailable, "database_unavailable", "database is not reachable")
			return
		}

		httpresp.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
