package posts

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// fakeSink ghi lại các đợt flush.
type fakeSink struct {
	mu      sync.Mutex
	counts  map[uuid.UUID]int64
	flushed chan struct{}
}

func newFakeSink() *fakeSink {
	return &fakeSink{counts: map[uuid.UUID]int64{}, flushed: make(chan struct{}, 8)}
}

func (s *fakeSink) IncrementViews(_ context.Context, counts map[uuid.UUID]int64) error {
	s.mu.Lock()
	for id, n := range counts {
		s.counts[id] += n
	}
	s.mu.Unlock()
	s.flushed <- struct{}{}
	return nil
}

func (s *fakeSink) count(id uuid.UUID) int64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.counts[id]
}

func TestViewCounter_FlushesOnShutdown(t *testing.T) {
	sink := newFakeSink()
	// interval 1h → chỉ flush khi shutdown.
	v := NewViewCounter(sink, metrics.New(), slog.Default(), 16, time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { v.Run(ctx); close(done) }()

	idA, idB := uuid.New(), uuid.New()
	v.Add(idA)
	v.Add(idA)
	v.Add(idB)
	// Chờ counter tiêu thụ hết channel trước khi cancel (poll ngắn).
	deadline := time.Now().Add(time.Second)
	for v.Buffered() > 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	<-done

	if got := sink.count(idA); got != 2 {
		t.Errorf("views A = %d, want 2", got)
	}
	if got := sink.count(idB); got != 1 {
		t.Errorf("views B = %d, want 1", got)
	}
}

func TestViewCounter_FlushesAtThreshold(t *testing.T) {
	sink := newFakeSink()
	v := NewViewCounter(sink, metrics.New(), slog.Default(), 1024, time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go v.Run(ctx)

	// 256 id khác nhau → chạm ngưỡng flush không cần ticker/shutdown.
	for i := 0; i < 256; i++ {
		v.Add(uuid.New())
	}
	select {
	case <-sink.flushed:
	case <-time.After(2 * time.Second):
		t.Fatal("đủ ngưỡng 256 phải flush ngay, không chờ ticker")
	}
}

func TestViewCounter_AddFullDrops(t *testing.T) {
	// Không chạy Run → channel buffer 1 đầy ngay.
	v := NewViewCounter(newFakeSink(), metrics.New(), slog.Default(), 1, time.Hour)
	if !v.Add(uuid.New()) {
		t.Fatal("view 1 phải vào buffer")
	}
	done := make(chan bool, 1)
	go func() { done <- v.Add(uuid.New()) }()
	select {
	case ok := <-done:
		if ok {
			t.Error("view 2 phải bị drop (buffer đầy)")
		}
	case <-time.After(time.Second):
		t.Fatal("Add bị block — phải non-blocking")
	}
}
