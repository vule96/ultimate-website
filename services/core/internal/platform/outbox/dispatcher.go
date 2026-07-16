package outbox

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm"
)

// Handler xử lý một event outbox. Trả error → event được giữ lại, retry vòng poll sau.
type Handler interface {
	Handle(ctx context.Context, e Event) error
}

// LogHandler là handler mặc định khi chưa có consumer thật (Phase 2 thay bằng
// handler đẩy queue, hoặc AI worker poll thẳng bảng và tắt dispatcher).
type LogHandler struct{ Log *slog.Logger }

// Handle log event ra slog.
func (h LogHandler) Handle(_ context.Context, e Event) error {
	h.Log.Info("outbox event", "id", e.ID, "aggregate", e.Aggregate,
		"aggregate_id", e.AggregateID, "event_type", e.EventType)
	return nil
}

// Dispatcher poll bảng outbox định kỳ, giao event chưa xử lý cho Handler.
// Deployment hiện tại single-instance nên chưa cần FOR UPDATE SKIP LOCKED —
// thêm khi scale ngang (Phase 2+).
type Dispatcher struct {
	db       *gorm.DB
	handler  Handler
	log      *slog.Logger
	interval time.Duration
	batch    int
	obs      Observer // optional — metrics (nil = không đo)
}

// Observer nhận số liệu outbox (impl bởi platform/metrics) — interface tại chỗ
// dùng để dispatcher không phụ thuộc cứng package metrics.
type Observer interface {
	OutboxProcessed()
	SetOutboxPending(n float64)
}

// WithObserver gắn observer đo metrics (chainable).
func (d *Dispatcher) WithObserver(o Observer) *Dispatcher {
	d.obs = o
	return d
}

// NewDispatcher tạo Dispatcher với batch mặc định 50 event/vòng.
func NewDispatcher(db *gorm.DB, h Handler, log *slog.Logger, interval time.Duration) *Dispatcher {
	return &Dispatcher{db: db, handler: h, log: log, interval: interval, batch: 50}
}

// Run poll cho tới khi ctx bị huỷ (gắn vào ctx graceful-shutdown của server —
// event chưa xử lý nằm lại DB, không mất).
func (d *Dispatcher) Run(ctx context.Context) {
	t := time.NewTicker(d.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			d.dispatchPending(ctx)
		}
	}
}

// dispatchPending xử lý một batch event chưa processed, cũ trước.
func (d *Dispatcher) dispatchPending(ctx context.Context) {
	var events []Event
	err := d.db.WithContext(ctx).
		Where("processed_at IS NULL").
		Order("created_at ASC").
		Limit(d.batch).
		Find(&events).Error
	if err != nil {
		d.log.Error("outbox: fetch pending failed", "err", err)
		return
	}
	if d.obs != nil {
		d.obs.SetOutboxPending(float64(len(events)))
	}
	for _, e := range events {
		if err := d.handler.Handle(ctx, e); err != nil {
			d.log.Error("outbox: handle failed — giữ lại retry", "id", e.ID, "err", err)
			continue
		}
		now := time.Now()
		if err := d.db.WithContext(ctx).Model(&Event{}).
			Where("id = ?", e.ID).Update("processed_at", now).Error; err != nil {
			d.log.Error("outbox: mark processed failed", "id", e.ID, "err", err)
			continue
		}
		if d.obs != nil {
			d.obs.OutboxProcessed()
		}
	}
}
