package metrics

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/pprof"
	"time"
)

// Serve chạy metrics server RIÊNG (tách khỏi API: không session middleware,
// không expose ra internet — chỉ Prometheus scrape trong network nội bộ).
// pprofEnabled bật /debug/pprof (profiling CPU/heap) — mặc định tắt ở production.
// Dừng theo ctx (gắn graceful shutdown của main).
func Serve(ctx context.Context, port string, m *Metrics, pprofEnabled bool, log *slog.Logger) {
	mux := http.NewServeMux()
	mux.Handle("/metrics", m.Handler())
	if pprofEnabled {
		mux.HandleFunc("/debug/pprof/", pprof.Index)
		mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
		mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
		mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
		mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
	}

	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()

	log.Info("metrics server listening", "port", port, "pprof", pprofEnabled)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("metrics server error", "err", err)
	}
}
