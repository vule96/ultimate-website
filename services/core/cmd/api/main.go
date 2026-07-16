// Command api là entrypoint của core service (blog backend).
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
	"github.com/vule96/ultimate-website/services/core/internal/modules/media"
	"github.com/vule96/ultimate-website/services/core/internal/modules/posts"
	"github.com/vule96/ultimate-website/services/core/internal/platform/config"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"github.com/vule96/ultimate-website/services/core/internal/platform/logger"
	"github.com/vule96/ultimate-website/services/core/internal/platform/outbox"
	"github.com/vule96/ultimate-website/services/core/internal/platform/session"
	"github.com/vule96/ultimate-website/services/core/internal/shared/bodylimit"
	"github.com/vule96/ultimate-website/services/core/internal/shared/corsmw"
	"github.com/vule96/ultimate-website/services/core/internal/shared/jsonmw"
	"github.com/vule96/ultimate-website/services/core/internal/shared/reqlog"
)

func main() {
	// Nạp .env nếu có (dev). Bỏ qua lỗi khi file không tồn tại (prod dùng env thật).
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log := logger.New(cfg.IsProduction(), cfg.LogLevel)

	db, err := database.Open(cfg.DatabaseURL, cfg.IsProduction())
	if err != nil {
		log.Error("failed to connect database", "err", err)
		os.Exit(1)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Error("failed to get sql.DB", "err", err)
		os.Exit(1)
	}
	// Pool DB: giới hạn kết nối để tránh cạn kết nối dưới tải (mọi request có cookie
	// session đều chạm bảng sessions qua scs LoadAndSave).
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	// Session manager (scs + Postgres).
	sm := session.New(sqlDB, session.Config{
		Lifetime: 7 * 24 * time.Hour,
		SameSite: session.ParseSameSite(cfg.SessionSameSite),
		Secure:   cfg.SessionSecure,
	})

	// Wiring module auth.
	allowlist := auth.NewAllowlist(cfg.AdminAllowlist)
	provider := auth.NewGoogleProvider(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL)
	authSvc := auth.NewService(provider, allowlist)
	authHandler := auth.NewHandler(authSvc, sm, cfg.AppBaseURL)

	// Wiring module posts. auth.IsAuthenticated cho handler biết request đã đăng nhập
	// chưa (anonymous chỉ thấy bài PUBLISHED).
	postsHandler := posts.NewHandler(posts.NewService(posts.NewGormRepository(db)), auth.IsAuthenticated(sm))

	// Wiring module media (presigned upload S3-compatible).
	mediaStorage := media.NewS3Storage(media.S3Config{
		Endpoint:       cfg.StorageEndpoint,
		Region:         cfg.StorageRegion,
		AccessKey:      cfg.StorageAccessKey,
		SecretKey:      cfg.StorageSecretKey,
		Bucket:         cfg.StorageBucket,
		PublicURL:      cfg.StoragePublicURL,
		UsePathStyle:   cfg.StorageUsePathStyle,
		PresignExpires: cfg.StoragePresignExpires,
	})
	mediaHandler := media.NewHandler(media.NewService(mediaStorage))

	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(reqlog.Middleware(log))
	r.Use(corsmw.New(strings.Split(cfg.CORSAllowedOrigins, ",")))
	r.Use(bodylimit.Middleware(cfg.MaxBodyBytes))

	r.GET("/healthz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	authHandler.RegisterRoutes(r)

	api := r.Group("/api/v1")
	// Endpoint ghi: ép Content-Type JSON (chống CSRF simple-request) rồi mới check auth.
	writeMW := []gin.HandlerFunc{jsonmw.RequireJSON(), auth.RequireAuth(sm, allowlist)}
	postsHandler.RegisterRoutes(api, writeMW...)
	mediaHandler.RegisterRoutes(api, writeMW...)

	if cfg.GoogleClientID == "" || cfg.AdminAllowlist == "" {
		log.Warn("auth not fully configured — set GOOGLE_CLIENT_ID/SECRET and ADMIN_ALLOWLIST to enable login")
	}

	// Bọc toàn bộ engine bằng scs LoadAndSave để nạp/lưu session mỗi request.
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           sm.LoadAndSave(r),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Graceful shutdown: nhận SIGINT/SIGTERM → drain request đang chạy rồi đóng DB.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Outbox dispatcher (chuẩn bị Phase 2): poll event chưa xử lý, handler hiện
	// tại chỉ log. Dừng theo ctx shutdown — event còn lại nằm trong DB, không mất.
	dispatcher := outbox.NewDispatcher(db, outbox.LogHandler{Log: log}, log, 10*time.Second)
	go dispatcher.Run(ctx)

	go func() {
		log.Info("core service listening", "port", cfg.Port, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("graceful shutdown failed", "err", err)
	}
	_ = sqlDB.Close()
}
