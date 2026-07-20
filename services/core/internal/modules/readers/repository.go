package readers

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrReaderNotFound     = errors.New("reader not found")
	ErrSubscriberNotFound = errors.New("subscriber not found")
)

type Repository interface {
	UpsertReader(ctx context.Context, googleSub, email, name string) (Reader, error)
	GetReader(ctx context.Context, id uuid.UUID) (Reader, error)
	AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	ListBookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error)
	UpsertSubscriber(ctx context.Context, email string) error
	UnsubscribeByToken(ctx context.Context, token uuid.UUID) error
	DeleteReader(ctx context.Context, id uuid.UUID) error
	// Admin — rows và count tách riêng để service cache count (COUNT(*) đắt).
	ListSubscribers(ctx context.Context, status string, offset, limit int) ([]Subscriber, error)
	CountSubscribers(ctx context.Context, status string) (int64, error)
	DeleteSubscriber(ctx context.Context, id uuid.UUID) error
	ListReaders(ctx context.Context, offset, limit int) ([]ReaderWithCount, error)
	CountReaders(ctx context.Context) (int64, error)
}

type GormRepository struct{ db *gorm.DB }

func NewGormRepository(db *gorm.DB) *GormRepository { return &GormRepository{db: db} }

func toReader(r readerRow) Reader {
	return Reader{ID: r.ID, GoogleSub: r.GoogleSub, Email: r.Email, Name: r.Name}
}

// UpsertReader tạo mới hoặc cập nhật email/name theo google_sub (định danh ổn định).
func (r *GormRepository) UpsertReader(ctx context.Context, googleSub, email, name string) (Reader, error) {
	row := readerRow{GoogleSub: googleSub, Email: email, Name: name}
	err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "google_sub"}},
			DoUpdates: clause.Assignments(map[string]any{"email": email, "name": name, "updated_at": gorm.Expr("now()")}),
		}).
		Create(&row).Error
	if err != nil {
		return Reader{}, err
	}
	// Sau upsert, row.ID có thể chưa được nạp khi conflict → đọc lại theo google_sub.
	var out readerRow
	if err := r.db.WithContext(ctx).Where("google_sub = ?", googleSub).First(&out).Error; err != nil {
		return Reader{}, err
	}
	return toReader(out), nil
}

func (r *GormRepository) GetReader(ctx context.Context, id uuid.UUID) (Reader, error) {
	var row readerRow
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Reader{}, ErrReaderNotFound
	}
	if err != nil {
		return Reader{}, err
	}
	return toReader(row), nil
}

func (r *GormRepository) AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&bookmarkRow{ReaderID: readerID, PostID: postID}).Error
}

func (r *GormRepository) RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("reader_id = ? AND post_id = ?", readerID, postID).
		Delete(&bookmarkRow{}).Error
}

func (r *GormRepository) ListBookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).Model(&bookmarkRow{}).
		Where("reader_id = ?", readerID).
		Order("created_at DESC").
		Pluck("post_id", &ids).Error
	return ids, err
}

// UpsertSubscriber tạo mới, hoặc HỒI SINH row cũ khi trùng email (đã unsubscribe/soft-delete)
// → set lại active + gỡ deleted_at. Giữ nguyên unsubscribe_token cũ (không đổi).
func (r *GormRepository) UpsertSubscriber(ctx context.Context, email string) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "email"}},
			DoUpdates: clause.Assignments(map[string]any{"status": "active", "deleted_at": nil}),
		}).
		Create(&subscriberRow{Email: email}).Error
}

// UnsubscribeByToken set status='unsubscribed' theo token (chỉ row còn sống). 0 row → NotFound.
func (r *GormRepository) UnsubscribeByToken(ctx context.Context, token uuid.UUID) error {
	res := r.db.WithContext(ctx).Model(&subscriberRow{}).
		Where("unsubscribe_token = ? AND deleted_at IS NULL", token).
		Update("status", "unsubscribed")
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriberNotFound
	}
	return nil
}

// filterSubscribers áp filter chung (chưa soft-delete + status tùy chọn).
func filterSubscribers(db *gorm.DB, status string) *gorm.DB {
	db = db.Where("deleted_at IS NULL")
	if status != "" {
		db = db.Where("status = ?", status)
	}
	return db
}

// ListSubscribers trả trang subscriber còn sống (mới nhất trước), lọc theo status nếu có.
func (r *GormRepository) ListSubscribers(ctx context.Context, status string, offset, limit int) ([]Subscriber, error) {
	var rows []subscriberRow
	q := filterSubscribers(r.db.WithContext(ctx).Model(&subscriberRow{}), status)
	if err := q.Order("created_at DESC").Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]Subscriber, len(rows))
	for i, s := range rows {
		out[i] = Subscriber{ID: s.ID, Email: s.Email, Status: s.Status, CreatedAt: s.CreatedAt}
	}
	return out, nil
}

// CountSubscribers đếm subscriber còn sống theo filter status.
func (r *GormRepository) CountSubscribers(ctx context.Context, status string) (int64, error) {
	var total int64
	err := filterSubscribers(r.db.WithContext(ctx).Model(&subscriberRow{}), status).Count(&total).Error
	return total, err
}

// DeleteSubscriber soft-delete (set deleted_at) — giữ row để audit. 0 row còn sống → NotFound.
func (r *GormRepository) DeleteSubscriber(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Model(&subscriberRow{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", gorm.Expr("now()"))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriberNotFound
	}
	return nil
}

// DeleteReader xoá reader + bookmark của reader (cùng transaction). FK cascade cũng gỡ bookmark
// ở prod (migration có ON DELETE CASCADE), nhưng xoá tường minh để đúng cả khi test AutoMigrate
// (không tạo FK). 0 row → ErrReaderNotFound.
func (r *GormRepository) DeleteReader(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("reader_id = ?", id).Delete(&bookmarkRow{}).Error; err != nil {
			return err
		}
		res := tx.Where("id = ?", id).Delete(&readerRow{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrReaderNotFound
		}
		return nil
	})
}

// ListReaders trả trang reader kèm số bookmark (LEFT JOIN).
func (r *GormRepository) ListReaders(ctx context.Context, offset, limit int) ([]ReaderWithCount, error) {
	var out []ReaderWithCount
	err := r.db.WithContext(ctx).
		Model(&readerRow{}).
		Select("readers.id, readers.email, readers.name, readers.created_at, COUNT(bookmarks.post_id) AS bookmark_count").
		Joins("LEFT JOIN bookmarks ON bookmarks.reader_id = readers.id").
		Group("readers.id").
		Order("readers.created_at DESC").Offset(offset).Limit(limit).
		Scan(&out).Error
	return out, err
}

// CountReaders đếm tổng reader.
func (r *GormRepository) CountReaders(ctx context.Context) (int64, error) {
	var total int64
	err := r.db.WithContext(ctx).Model(&readerRow{}).Count(&total).Error
	return total, err
}
