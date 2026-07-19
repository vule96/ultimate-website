// Command api là entrypoint của core service (blog backend).
package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
	"github.com/vule96/ultimate-website/services/core/internal/modules/media"
	"github.com/vule96/ultimate-website/services/core/internal/modules/posts"
	"github.com/vule96/ultimate-website/services/core/internal/modules/readers"
	"github.com/vule96/ultimate-website/services/core/internal/platform/blurhash"
	"github.com/vule96/ultimate-website/services/core/internal/platform/cache"
	"github.com/vule96/ultimate-website/services/core/internal/platform/config"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"github.com/vule96/ultimate-website/services/core/internal/platform/logger"
	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
	"github.com/vule96/ultimate-website/services/core/internal/platform/outbox"
	"github.com/vule96/ultimate-website/services/core/internal/platform/session"
	"github.com/vule96/ultimate-website/services/core/internal/shared/bodylimit"
	"github.com/vule96/ultimate-website/services/core/internal/shared/corsmw"
	"github.com/vule96/ultimate-website/services/core/internal/shared/jsonmw"
	"github.com/vule96/ultimate-website/services/core/internal/shared/ratelimit"
	"github.com/vule96/ultimate-website/services/core/internal/shared/reqlog"
)

// version được inject lúc build: -ldflags "-X main.version=<git sha>".
var version = "dev"

// contentMetaStore adapter blurhash.Meta → posts.ImageMeta (blurhash không
// import posts để tránh cycle).
type contentMetaStore struct{ repo *posts.GormRepository }

func (s contentMetaStore) SetContentImageMeta(ctx context.Context, id uuid.UUID, meta map[string]blurhash.Meta) error {
	out := make(map[string]posts.ImageMeta, len(meta))
	for src, v := range meta {
		out[src] = posts.ImageMeta{W: v.W, H: v.H, Ph: v.PlaceholderPNG}
	}
	return s.repo.SetContentImageMeta(ctx, id, out)
}

func main() {
	// Nạp .env nếu có (dev). Bỏ qua lỗi khi file không tồn tại (prod dùng env thật).
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}

	log := logger.New(cfg.IsProduction(), cfg.LogLevel)
	log.Info("core service starting", "service", "core", "version", version, "config", cfg)

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

	// Prometheus metrics (registry riêng) + theo dõi pool DB.
	m := metrics.New()
	m.RegisterDBStats(sqlDB)

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

	// Cache Redis (cache-aside, key-versioning). REDIS_URL rỗng → no-op (cache tắt).
	var cch cache.Cache = cache.NewNoop()
	if cfg.RedisURL != "" {
		rc, err := cache.NewRedis(cfg.RedisURL, log)
		if err != nil {
			log.Warn("cache: REDIS_URL không hợp lệ — chạy không cache", "err", err)
		} else {
			cch = rc
			log.Info("cache: redis enabled")
		}
	}
	// Raw redis client dùng chung cho rate limit + view dedupe (nil nếu Redis tắt —
	// cả ratelimit.PerIP và posts.NewViewDeduper tự no-op/fail-open khi rdb nil).
	var rdb redis.Cmdable
	if rc, ok := cch.(*cache.Redis); ok {
		rdb = rc.Client()
	}

	// Wiring module posts. auth.IsAuthenticated cho handler biết request đã đăng nhập
	// chưa (anonymous chỉ thấy bài PUBLISHED). Repo bọc cache decorator.
	gormRepo := posts.NewGormRepository(db)
	postsRepo := posts.NewCachedRepository(gormRepo, cch, m)

	// Blurhash worker pool (Slice 9 — goroutine): request chỉ enqueue non-blocking,
	// N worker nền tải ảnh + tính hash + lưu DB.
	bhWorker := blurhash.NewWorker(
		gormRepo,
		blurhash.NewHTTPFetcher(cfg.BlurhashFetchTimeout, cfg.BlurhashMaxBytes, cfg.BlurhashFetchAllowlist()),
		m, log, cfg.BlurhashWorkers, 256,
	).WithContentStore(
		contentMetaStore{repo: gormRepo},
		// Meta ghi nền xong → bump version để detail cache (TTL 5m) thấy sớm.
		func(ctx context.Context) { cch.BumpVersion(ctx, "posts") },
	)
	postsSvc := posts.NewService(postsRepo).
		WithBlurhashEnqueuer(func(id uuid.UUID, coverURL string) {
			bhWorker.Enqueue(blurhash.Job{PostID: id, URL: coverURL})
		}).
		WithContentMetaEnqueuer(func(id uuid.UUID, contentHTML string) {
			bhWorker.Enqueue(blurhash.Job{PostID: id, ContentHTML: contentHTML})
		})
	// View counter batch (Slice 9 — goroutine): gom view trong channel,
	// flush xuống DB theo chu kỳ/ngưỡng; shutdown flush nốt.
	viewCounter := posts.NewViewCounter(gormRepo, m, log, cfg.ViewBufferSize, cfg.ViewFlushInterval)
	// Dedupe view (Slice 13): 1 người/1 view/bài/ngày, state sống trong Redis (rdb nil → tắt).
	viewDeduper := posts.NewViewDeduper(rdb, cfg.ViewDedupSalt)
	postsHandler := posts.NewHandler(postsSvc, auth.IsAuthenticated(sm)).
		WithViewCounter(viewCounter).
		WithDeduper(viewDeduper, cfg.ViewDedupSalt).
		WithReaderIdentity(func(ctx context.Context) string { return sm.GetString(ctx, readers.SessionKeyReaderID) }).
		WithViewRateLimit(ratelimit.PerIP(rdb, log, "view", 60, time.Minute))

	// Wiring module readers (auth người đọc — OAuth riêng, KHÔNG allowlist admin).
	readerProvider := auth.NewGoogleProvider(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.ReaderRedirectURL)
	readersRepo := readers.NewGormRepository(db)
	readersSvc := readers.NewService(readersRepo, readerProvider)
	readerAuthHandler := readers.NewAuthHandler(readersSvc, sm, cfg.WebBaseURL)
	bookmarkHandler := readers.NewBookmarkHandler(readersSvc)
	subscriberHandler := readers.NewSubscriberHandler(readersSvc)

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
	// c.ClientIP() (dùng bởi ratelimit + view dedupe + reqlog) chỉ tin
	// X-Forwarded-For từ proxy liệt kê trong TRUSTED_PROXIES (CSV IP/CIDR).
	// Rỗng (mặc định dev/local) → SetTrustedProxies(nil) = không tin proxy
	// nào, ClientIP() dùng thẳng RemoteAddr (an toàn, hết bị giả mạo XFF).
	// PROD: set TRUSTED_PROXIES = IP/CIDR của Nginx/Cloudflare trước core.
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Warn("SetTrustedProxies failed, ClientIP() sẽ không tin proxy nào", "err", err)
	}
	// Panic → log structured qua slog (kèm stack) + trả JSON envelope thay vì
	// writer mặc định của Gin (in thẳng stdout không cấu trúc).
	r.Use(gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, err any) {
		reqlog.From(c.Request.Context()).Error("panic recovered",
			"panic", err, "stack", string(debug.Stack()))
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			gin.H{"error": gin.H{"code": "INTERNAL", "message": "internal error"}})
	}))
	r.Use(reqlog.Middleware(log))
	r.Use(m.GinMiddleware())
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

	// Reader auth (Slice 13) — top-level như authHandler, login rate-limit theo IP.
	readerAuthHandler.RegisterRoutes(r, ratelimit.PerIP(rdb, log, "auth", 10, time.Minute))

	api := r.Group("/api/v1")
	// Endpoint ghi: ép Content-Type JSON (chống CSRF simple-request) rồi mới check auth.
	writeMW := []gin.HandlerFunc{jsonmw.RequireJSON(), auth.RequireAuth(sm, allowlist)}
	postsHandler.RegisterRoutes(api, writeMW...)
	mediaHandler.RegisterRoutes(api, writeMW...)

	// Bookmark (Slice 13): cần reader session cho GET/PUT/DELETE. RequireJSON không bọc
	// GET/DELETE (không cần body) — FE luôn gửi Content-Type: application/json cho PUT/DELETE
	// vẫn giữ được CSRF guard hiệu lực vì đây là simple-request guard tổng quát ở writeMW cho
	// admin; bookmark là reader-only nên guard chính là RequireReader (session cookie SameSite).
	bookmarkHandler.RegisterRoutes(api, readers.RequireReader(sm))

	// Newsletter (Slice 13): public, rate limit theo IP + ép JSON.
	subscriberHandler.RegisterRoutes(api,
		ratelimit.PerIP(rdb, log, "subscribe", 5, time.Minute),
		jsonmw.RequireJSON())

	// Admin: list/quản lý subscribers + readers (sau RequireAuth allowlist).
	readers.NewAdminHandler(readersSvc).RegisterRoutes(api, auth.RequireAuth(sm, allowlist))

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
	dispatcher := outbox.NewDispatcher(db, outbox.LogHandler{Log: log}, log, 10*time.Second).WithObserver(m)
	go dispatcher.Run(ctx)

	// Metrics server riêng (:METRICS_PORT) — Prometheus scrape nội bộ, kèm pprof khi bật.
	go metrics.Serve(ctx, cfg.MetricsPort, m, cfg.PprofEnabled, log)

	// Blurhash worker pool + view counter chạy nền theo ctx.
	bhWorker.Start(ctx)
	go viewCounter.Run(ctx)

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
	// Drain job blurhash còn trong queue (tối đa 5s) rồi mới đóng DB.
	bhWorker.Close(5 * time.Second)
	_ = sqlDB.Close()
}
