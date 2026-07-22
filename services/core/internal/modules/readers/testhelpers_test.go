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
		// subscribers.email dùng citext → cần extension (DB test sạch, vd CI, chưa có).
		if err := db.Exec("CREATE EXTENSION IF NOT EXISTS citext").Error; err != nil {
			fmt.Println("cannot create citext extension:", err)
			os.Exit(1)
		}
		// readers cần bảng posts thật (FK bookmarks.post_id). Chỉ AutoMigrate posts.Models()
		// khi chưa có — nếu package posts đã migrate vào blog_test dùng chung thì re-migrate
		// many2many post_tags làm GORM báo "duplicated key not allowed" (DB test sạch, CI).
		models := Models()
		if !db.Migrator().HasTable("posts") {
			models = append(posts.Models(), models...)
		}
		if err := db.AutoMigrate(models...); err != nil {
			fmt.Println("automigrate failed:", err)
			os.Exit(1)
		}
		// AutoMigrate KHÔNG tạo FK — thêm ON DELETE CASCADE thủ công (khớp migration
		// add_readers) để test harness phản ánh đúng hành vi cascade của prod. Idempotent.
		if err := ensureBookmarkFKs(db); err != nil {
			fmt.Println("add bookmark FKs failed:", err)
			os.Exit(1)
		}
		db.Logger = gormlogger.Default.LogMode(gormlogger.Silent)
		testGormDB = db
	}
	os.Exit(m.Run())
}

// ensureBookmarkFKs thêm FK ON DELETE CASCADE cho bookmarks (reader_id, post_id) nếu chưa
// có — AutoMigrate không tạo FK. Idempotent qua IF NOT EXISTS pattern (DO block).
func ensureBookmarkFKs(db *gorm.DB) error {
	stmts := []string{
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_bookmarks_reader') THEN
				ALTER TABLE bookmarks ADD CONSTRAINT fk_bookmarks_reader
					FOREIGN KEY (reader_id) REFERENCES readers(id) ON DELETE CASCADE;
			END IF;
		END $$;`,
		`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='fk_bookmarks_post') THEN
				ALTER TABLE bookmarks ADD CONSTRAINT fk_bookmarks_post
					FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
			END IF;
		END $$;`,
	}
	for _, s := range stmts {
		if err := db.Exec(s).Error; err != nil {
			return err
		}
	}
	return nil
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
