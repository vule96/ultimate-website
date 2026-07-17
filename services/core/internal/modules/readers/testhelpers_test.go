package readers

import (
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"github.com/vule96/ultimate-website/services/core/internal/modules/posts"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var testGormDB *gorm.DB

func TestMain(m *testing.M) {
	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		db, err := database.Open(dsn, false)
		if err != nil {
			fmt.Println("cannot connect TEST_DATABASE_URL:", err)
			os.Exit(1)
		}
		// readers cần bảng posts thật (FK bookmarks.post_id) → AutoMigrate cả posts.Models().
		models := append(posts.Models(), Models()...)
		if err := db.AutoMigrate(models...); err != nil {
			fmt.Println("automigrate failed:", err)
			os.Exit(1)
		}
		db.Logger = gormlogger.Default.LogMode(gormlogger.Silent)
		testGormDB = db
	}
	os.Exit(m.Run())
}

// newTestDB trả về *gorm.DB chạy trong 1 transaction sẽ được rollback sau test (cô lập giữa các test).
func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	if testGormDB == nil {
		t.Skip("set TEST_DATABASE_URL to run repository integration tests")
	}
	tx := testGormDB.Begin()
	t.Cleanup(func() { tx.Rollback() })
	return tx
}

// seedPost tạo 1 post tối thiểu (chỉ cột NOT NULL không có default) để thoả FK bookmarks.post_id.
func seedPost(t *testing.T, db *gorm.DB) uuid.UUID {
	t.Helper()
	id := uuid.New()
	err := db.Exec(
		`INSERT INTO posts (id, title, slug) VALUES (?, ?, ?)`,
		id, "Seed "+id.String(), "seed-"+id.String(),
	).Error
	require.NoError(t, err)
	return id
}
