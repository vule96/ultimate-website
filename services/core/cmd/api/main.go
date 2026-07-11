// Command api là entrypoint của core service (blog backend).
package main

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
	"github.com/vule96/ultimate-website/services/core/internal/modules/media"
	"github.com/vule96/ultimate-website/services/core/internal/modules/posts"
	"github.com/vule96/ultimate-website/services/core/internal/platform/config"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"github.com/vule96/ultimate-website/services/core/internal/platform/logger"
	"github.com/vule96/ultimate-website/services/core/internal/platform/session"
	"github.com/vule96/ultimate-website/services/core/internal/shared/corsmw"
	"github.com/vule96/ultimate-website/services/core/internal/shared/jsonmw"
)

func main() {
	// Nạp .env nếu có (dev). Bỏ qua lỗi khi file không tồn tại (prod dùng env thật).
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log := logger.New(cfg.IsProduction())

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

	// Session manager (scs + Postgres).
	sm := session.New(sqlDB, session.Config{
		Lifetime: 7 * 24 * time.Hour,
		SameSite: session.ParseSameSite(cfg.SessionSameSite),
		Secure:   cfg.SessionSecure,
	})

	// Wiring module auth.
	provider := auth.NewGoogleProvider(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL)
	authSvc := auth.NewService(provider, auth.NewAllowlist(cfg.AdminAllowlist))
	authHandler := auth.NewHandler(authSvc, sm, cfg.AppBaseURL)

	// Wiring module posts.
	postsHandler := posts.NewHandler(posts.NewService(posts.NewGormRepository(db)))

	// Wiring module media (presigned upload S3-compatible).
	mediaStorage := media.NewS3Storage(media.S3Config{
		Endpoint:     cfg.StorageEndpoint,
		Region:       cfg.StorageRegion,
		AccessKey:    cfg.StorageAccessKey,
		SecretKey:    cfg.StorageSecretKey,
		Bucket:       cfg.StorageBucket,
		PublicURL:    cfg.StoragePublicURL,
		UsePathStyle: cfg.StorageUsePathStyle,
	})
	mediaHandler := media.NewHandler(media.NewService(mediaStorage))

	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(corsmw.New(strings.Split(cfg.CORSAllowedOrigins, ",")))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	authHandler.RegisterRoutes(r)

	api := r.Group("/api/v1")
	// Endpoint ghi: ép Content-Type JSON (chống CSRF simple-request) rồi mới check auth.
	writeMW := []gin.HandlerFunc{jsonmw.RequireJSON(), auth.RequireAuth(sm)}
	postsHandler.RegisterRoutes(api, writeMW...)
	mediaHandler.RegisterRoutes(api, writeMW...)

	if cfg.GoogleClientID == "" || cfg.AdminAllowlist == "" {
		log.Warn("auth not fully configured — set GOOGLE_CLIENT_ID/SECRET and ADMIN_ALLOWLIST to enable login")
	}

	log.Info("core service listening", "port", cfg.Port, "env", cfg.AppEnv)
	// Bọc toàn bộ engine bằng scs LoadAndSave để nạp/lưu session mỗi request.
	if err := http.ListenAndServe(":"+cfg.Port, sm.LoadAndSave(r)); err != nil {
		log.Error("server exited", "err", err)
		os.Exit(1)
	}
}
