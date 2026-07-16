package posts

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// flushThreshold: gom đủ chừng này id khác nhau thì flush ngay, không chờ ticker.
const flushThreshold = 256

// ViewSink nhận batch view — *GormRepository.IncrementViews thoả interface này.
type ViewSink interface {
	IncrementViews(ctx context.Context, counts map[uuid.UUID]int64) error
}

// ViewCounter đếm view kiểu batch (bài học goroutine Slice 9):
//   - request path CHỈ đẩy id vào buffered channel (Add, non-blocking) → 0 query DB;
//   - 1 goroutine (Run) gom map[id]count, flush theo ticker hoặc khi chạm ngưỡng;
//   - shutdown: flush nốt phần còn lại — view đã nhận không mất.
//
// Drop khi buffer đầy là chấp nhận được: đây là số liệu hiển thị, không phải tiền.
type ViewCounter struct {
	ch       chan uuid.UUID
	sink     ViewSink
	m        *metrics.Metrics
	log      *slog.Logger
	interval time.Duration
}

// NewViewCounter tạo counter (chưa chạy — gọi go Run(ctx)).
func NewViewCounter(sink ViewSink, m *metrics.Metrics, log *slog.Logger, buffer int, interval time.Duration) *ViewCounter {
	return &ViewCounter{
		ch:       make(chan uuid.UUID, buffer),
		sink:     sink,
		m:        m,
		log:      log,
		interval: interval,
	}
}

// Add ghi nhận 1 view — non-blocking; buffer đầy → drop + metric.
func (v *ViewCounter) Add(id uuid.UUID) bool {
	select {
	case v.ch <- id:
		return true
	default:
		v.m.ViewsDropped()
		return false
	}
}

// Buffered trả số view đang nằm trong channel (phục vụ test/metrics).
func (v *ViewCounter) Buffered() int { return len(v.ch) }

// Run là goroutine chính: gom + flush. Return khi ctx huỷ (sau khi flush nốt).
func (v *ViewCounter) Run(ctx context.Context) {
	t := time.NewTicker(v.interval)
	defer t.Stop()

	pending := make(map[uuid.UUID]int64)
	for {
		select {
		case <-ctx.Done():
			// Vét nốt channel rồi flush lần cuối — view đã nhận không mất.
			for {
				select {
				case id := <-v.ch:
					pending[id]++
				default:
					v.flush(pending)
					return
				}
			}
		case <-t.C:
			v.flush(pending)
			pending = make(map[uuid.UUID]int64)
		case id := <-v.ch:
			pending[id]++
			v.m.ViewsBuffered(float64(len(pending)))
			if len(pending) >= flushThreshold {
				v.flush(pending)
				pending = make(map[uuid.UUID]int64)
			}
		}
	}
}

// flush ghi batch xuống sink với timeout riêng (dùng Background — lúc shutdown
// ctx chính đã huỷ nhưng vẫn phải ghi nốt).
func (v *ViewCounter) flush(pending map[uuid.UUID]int64) {
	if len(pending) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	total := 0
	for _, n := range pending {
		total += int(n)
	}
	if err := v.sink.IncrementViews(ctx, pending); err != nil {
		v.log.Error("viewcounter: flush failed — mất batch này", "posts", len(pending), "views", total, "err", err)
		return
	}
	v.m.ViewsFlushed(total)
	v.m.ViewsBuffered(0)
	v.log.Debug("viewcounter: flushed", "posts", len(pending), "views", total)
}
