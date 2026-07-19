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
	// Admin
	ListSubscribers(ctx context.Context, offset, limit int) ([]Subscriber, int64, error)
	DeleteSubscriber(ctx context.Context, id uuid.UUID) error
	ListReaders(ctx context.Context, offset, limit int) ([]ReaderWithCount, int64, error)
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

func (r *GormRepository) UpsertSubscriber(ctx context.Context, email string) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&subscriberRow{Email: email}).Error
}

// ListSubscribers trả trang subscriber (mới nhất trước) + tổng số.
func (r *GormRepository) ListSubscribers(ctx context.Context, offset, limit int) ([]Subscriber, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&subscriberRow{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []subscriberRow
	if err := r.db.WithContext(ctx).
		Order("created_at DESC").Offset(offset).Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	out := make([]Subscriber, len(rows))
	for i, s := range rows {
		out[i] = Subscriber{ID: s.ID, Email: s.Email, Status: s.Status, CreatedAt: s.CreatedAt}
	}
	return out, total, nil
}

// DeleteSubscriber xoá theo id; 0 row → ErrSubscriberNotFound.
func (r *GormRepository) DeleteSubscriber(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Where("id = ?", id).Delete(&subscriberRow{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriberNotFound
	}
	return nil
}

// ListReaders trả trang reader kèm số bookmark (LEFT JOIN) + tổng số.
func (r *GormRepository) ListReaders(ctx context.Context, offset, limit int) ([]ReaderWithCount, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&readerRow{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var out []ReaderWithCount
	if err := r.db.WithContext(ctx).
		Model(&readerRow{}).
		Select("readers.id, readers.email, readers.name, readers.created_at, COUNT(bookmarks.post_id) AS bookmark_count").
		Joins("LEFT JOIN bookmarks ON bookmarks.reader_id = readers.id").
		Group("readers.id").
		Order("readers.created_at DESC").Offset(offset).Limit(limit).
		Scan(&out).Error; err != nil {
		return nil, 0, err
	}
	return out, total, nil
}
