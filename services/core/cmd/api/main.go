// Command api là entrypoint của core service (blog backend).
package main

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/vule96/ultimate-website/services/core/internal/modules/posts"
	"github.com/vule96/ultimate-website/services/core/internal/platform/config"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"github.com/vule96/ultimate-website/services/core/internal/platform/logger"
)

func main() {
	// Nạp .env nếu có (dev). Bỏ qua lỗi khi file không tồn tại (prod dùng env thật).
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		// Chưa có logger nên in ra stderr rồi thoát.
		panic(err)
	}

	log := logger.New(cfg.IsProduction())

	db, err := database.Open(cfg.DatabaseURL, cfg.IsProduction())
	if err != nil {
		log.Error("failed to connect database", "err", err)
		os.Exit(1)
	}

	// Wiring module posts: repository → service → handler.
	postsRepo := posts.NewGormRepository(db)
	postsSvc := posts.NewService(postsRepo)
	postsHandler := posts.NewHandler(postsSvc)

	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")
	postsHandler.RegisterRoutes(api)

	log.Info("core service listening", "port", cfg.Port, "env", cfg.AppEnv)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Error("server exited", "err", err)
		os.Exit(1)
	}
}
