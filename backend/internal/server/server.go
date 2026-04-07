package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/singl3focus/improve-platform/internal/auth"
	"github.com/singl3focus/improve-platform/internal/config"
	"github.com/singl3focus/improve-platform/internal/dashboard"
	"github.com/singl3focus/improve-platform/internal/history"
	"github.com/singl3focus/improve-platform/internal/material"
	"github.com/singl3focus/improve-platform/internal/roadmap"
	"github.com/singl3focus/improve-platform/internal/server/handler"
	"github.com/singl3focus/improve-platform/internal/task"
	"github.com/singl3focus/improve-platform/internal/today"
)

type Server struct {
	cfg    *config.Config
	router *chi.Mux
	pool   *pgxpool.Pool
	log    *slog.Logger
}

func New(cfg *config.Config, pool *pgxpool.Pool, log *slog.Logger) *Server {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	s := &Server{
		cfg:    cfg,
		router: r,
		pool:   pool,
		log:    log,
	}

	s.routes()
	return s
}

func (s *Server) routes() {
	s.router.Get("/healthz", handler.Healthz())
	s.router.Get("/readyz", handler.Readyz(s.pool))

	authRepo := auth.NewUserRepo(s.pool)
	authUC := auth.NewUseCase(authRepo, s.cfg.JWTSecret)
	authH := auth.NewHandler(authUC)

	s.router.Post("/api/v1/auth/register", authH.Register())
	s.router.Post("/api/v1/auth/login", authH.Login())
	s.router.Post("/api/v1/auth/refresh", authH.Refresh())
	s.router.Post("/api/v1/auth/logout", authH.Logout())

	histRepo := history.NewRepo(s.pool)
	histUC := history.NewUseCase(histRepo)
	histH := history.NewHandler(histUC)

	rmRepo := roadmap.NewRepo(s.pool)
	rmUC := roadmap.NewUseCase(rmRepo)
	rmUC.WithRecorder(histUC)
	rmH := roadmap.NewHandler(rmUC)

	taskRepo := task.NewRepo(s.pool)
	topicAdapter := &topicStatusAdapter{repo: rmRepo}
	taskUC := task.NewUseCase(taskRepo, topicAdapter)
	taskUC.WithRecorder(histUC)
	taskH := task.NewHandler(taskUC)

	matRepo := material.NewRepo(s.pool)
	matUC := material.NewUseCase(matRepo)
	matUC.WithRecorder(histUC)
	matH := material.NewHandler(matUC)

	dashRepo := dashboard.NewRepo(s.pool)
	dashUC := dashboard.NewUseCase(dashRepo)
	dashUC.WithRecorder(histUC)
	dashH := dashboard.NewHandler(dashUC)

	todayRepo := today.NewRepo(s.pool)
	todayUC := today.NewUseCase(todayRepo)
	todayUC.WithRecorder(histUC)
	todayH := today.NewHandler(todayUC)

	s.router.Group(func(r chi.Router) {
		r.Use(auth.Middleware([]byte(s.cfg.JWTSecret)))
		r.Get("/api/v1/me", authH.Me())
		r.Patch("/api/v1/auth/profile", authH.UpdateProfile())

		// Multiple roadmaps
		r.Get("/api/v1/roadmaps", rmH.ListRoadmaps())
		r.Post("/api/v1/roadmaps", rmH.CreateRoadmap())
		r.Get("/api/v1/roadmaps/{roadmapID}", rmH.GetRoadmap())
		r.Put("/api/v1/roadmaps/{roadmapID}", rmH.UpdateRoadmap())
		r.Delete("/api/v1/roadmaps/{roadmapID}", rmH.DeleteRoadmap())

		// Topics scoped to roadmap
		r.Post("/api/v1/roadmaps/{roadmapID}/topics", rmH.CreateTopic())
		r.Get("/api/v1/roadmaps/{roadmapID}/topics/{topicID}", rmH.GetTopic())
		r.Put("/api/v1/roadmaps/{roadmapID}/topics/{topicID}", rmH.UpdateTopic())
		r.Delete("/api/v1/roadmaps/{roadmapID}/topics/{topicID}", rmH.DeleteTopic())
		r.Patch("/api/v1/roadmaps/{roadmapID}/topics/{topicID}/status", rmH.UpdateTopicStatus())
		r.Patch("/api/v1/roadmaps/{roadmapID}/topics/{topicID}/confidence", rmH.SetTopicConfidence())

		r.Post("/api/v1/roadmaps/{roadmapID}/topics/{topicID}/dependencies", rmH.AddDependency())
		r.Delete("/api/v1/roadmaps/{roadmapID}/topics/{topicID}/dependencies/{depTopicID}", rmH.RemoveDependency())

		r.Get("/api/v1/roadmaps/{roadmapID}/topics/{topicID}/tasks", taskH.GetTopicTasks())
		r.Get("/api/v1/roadmaps/{roadmapID}/topics/{topicID}/materials", matH.ListTopicMaterials())

		r.Post("/api/v1/tasks", taskH.CreateTask())
		r.Get("/api/v1/tasks", taskH.ListTasks())
		r.Get("/api/v1/tasks/{taskID}", taskH.GetTask())
		r.Put("/api/v1/tasks/{taskID}", taskH.UpdateTask())
		r.Patch("/api/v1/tasks/{taskID}/status", taskH.UpdateTaskStatus())
		r.Delete("/api/v1/tasks/{taskID}", taskH.DeleteTask())

		r.Post("/api/v1/materials", matH.CreateMaterial())
		r.Get("/api/v1/materials/{materialID}", matH.GetMaterial())
		r.Put("/api/v1/materials/{materialID}", matH.UpdateMaterial())
		r.Delete("/api/v1/materials/{materialID}", matH.DeleteMaterial())

		r.Get("/api/v1/history", histH.GetHistory())

		r.Get("/api/v1/dashboard/focus", dashH.GetFocus())
		r.Get("/api/v1/dashboard/activity-heatmap", dashH.GetActivityHeatmap())
		r.Get("/api/v1/dashboard/weekly-review", dashH.GetWeeklyReview())
		r.Post("/api/v1/dashboard/weekly-review", dashH.SaveWeeklyReview())

		r.Get("/api/v1/today", todayH.GetToday())
		r.Put("/api/v1/today/tasks", todayH.SetTasks())
		r.Patch("/api/v1/today/tasks/{taskID}/toggle", todayH.ToggleTask())
		r.Patch("/api/v1/today/reflection", todayH.SaveReflection())

		// Legacy topic routes (no roadmapID prefix) — used by topic workspace, weekly review
		r.Get("/api/v1/roadmap/topics/{topicID}", rmH.GetTopic())
		r.Put("/api/v1/roadmap/topics/{topicID}", rmH.UpdateTopic())
		r.Delete("/api/v1/roadmap/topics/{topicID}", rmH.DeleteTopic())
		r.Patch("/api/v1/roadmap/topics/{topicID}/status", rmH.UpdateTopicStatus())
		r.Patch("/api/v1/roadmap/topics/{topicID}/confidence", rmH.SetTopicConfidence())
		r.Post("/api/v1/roadmap/topics/{topicID}/dependencies", rmH.AddDependency())
		r.Delete("/api/v1/roadmap/topics/{topicID}/dependencies/{depTopicID}", rmH.RemoveDependency())
		r.Get("/api/v1/roadmap/topics/{topicID}/tasks", taskH.GetTopicTasks())
		r.Get("/api/v1/roadmap/topics/{topicID}/materials", matH.ListTopicMaterials())
	})
}

func (s *Server) Run(ctx context.Context) error {
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", s.cfg.Port),
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		s.log.Info("starting server", "port", s.cfg.Port)
		errCh <- srv.ListenAndServe()
	}()

	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		s.log.Info("shutting down server")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// Router exposes the chi.Mux for testing.
func (s *Server) Router() http.Handler {
	return s.router
}

// topicStatusAdapter adapts roadmap.Repository for use by task.TopicStatusUpdater.
type topicStatusAdapter struct {
	repo roadmap.Repository
}

func (a *topicStatusAdapter) GetTopicStatus(ctx context.Context, topicID, userID string) (string, error) {
	t, err := a.repo.GetTopicByID(ctx, topicID, userID)
	if err != nil {
		return "", err
	}
	return t.Status, nil
}

func (a *topicStatusAdapter) SetTopicInProgress(ctx context.Context, topicID, userID string) error {
	now := time.Now().Truncate(24 * time.Hour)
	return a.repo.UpdateTopicStatus(ctx, topicID, userID, "in_progress", &now, nil)
}

func (a *topicStatusAdapter) SetTopicCompleted(ctx context.Context, topicID, userID string) error {
	now := time.Now().Truncate(24 * time.Hour)
	return a.repo.UpdateTopicStatus(ctx, topicID, userID, "completed", nil, &now)
}
