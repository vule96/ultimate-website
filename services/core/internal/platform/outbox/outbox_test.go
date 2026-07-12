package outbox

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
)

var testDB *gorm.DB

func TestMain(m *testing.M) {
	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		db, err := database.Open(dsn, false)
		if err != nil {
			fmt.Println("cannot connect TEST_DATABASE_URL:", err)
			os.Exit(1)
		}
		if err := db.AutoMigrate(&Event{}); err != nil {
			fmt.Println("automigrate failed:", err)
			os.Exit(1)
		}
		db.Logger = gormlogger.Default.LogMode(gormlogger.Silent)
		testDB = db
	}
	os.Exit(m.Run())
}

// newTx trả *gorm.DB trong transaction rollback sau test (không bẩn DB).
func newTx(t *testing.T) *gorm.DB {
	t.Helper()
	if testDB == nil {
		t.Skip("set TEST_DATABASE_URL to run outbox integration tests")
	}
	tx := testDB.Begin()
	t.Cleanup(func() { tx.Rollback() })
	return tx
}

// fakeHandler ghi lại event nhận được; failN lần đầu trả lỗi.
type fakeHandler struct {
	got   []Event
	failN int
}

func (f *fakeHandler) Handle(_ context.Context, e Event) error {
	if f.failN > 0 {
		f.failN--
		return fmt.Errorf("boom")
	}
	f.got = append(f.got, e)
	return nil
}

func TestWrite_InsertsEvent(t *testing.T) {
	tx := newTx(t)
	id := uuid.New()
	if err := Write(tx, "post", id, "post.created", map[string]any{"slug": "x"}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	var e Event
	if err := tx.First(&e, "aggregate_id = ?", id).Error; err != nil {
		t.Fatalf("find event: %v", err)
	}
	if e.EventType != "post.created" || e.ProcessedAt != nil {
		t.Errorf("event = %+v", e)
	}
}

func TestDispatcher_ProcessesAndMarks(t *testing.T) {
	tx := newTx(t)
	id := uuid.New()
	_ = Write(tx, "post", id, "post.updated", map[string]any{"slug": "y"})

	h := &fakeHandler{}
	d := NewDispatcher(tx, h, slog.New(slog.NewTextHandler(os.Stderr, nil)), time.Second)
	d.dispatchPending(context.Background())

	if len(h.got) != 1 || h.got[0].AggregateID != id {
		t.Fatalf("handler got %+v", h.got)
	}
	var e Event
	_ = tx.First(&e, "aggregate_id = ?", id).Error
	if e.ProcessedAt == nil {
		t.Error("expected processed_at set")
	}
}

func TestDispatcher_HandlerErrorKeepsEvent(t *testing.T) {
	tx := newTx(t)
	id := uuid.New()
	_ = Write(tx, "post", id, "post.updated", map[string]any{"slug": "z"})

	h := &fakeHandler{failN: 1}
	d := NewDispatcher(tx, h, slog.New(slog.NewTextHandler(os.Stderr, nil)), time.Second)
	d.dispatchPending(context.Background())

	var e Event
	_ = tx.First(&e, "aggregate_id = ?", id).Error
	if e.ProcessedAt != nil {
		t.Error("event lỗi phải được giữ lại (processed_at NULL) để retry")
	}
	// Vòng poll sau: handler hết lỗi → xử lý được.
	d.dispatchPending(context.Background())
	_ = tx.First(&e, "aggregate_id = ?", id).Error
	if e.ProcessedAt == nil {
		t.Error("expected processed_at set sau retry")
	}
}
