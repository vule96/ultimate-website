package readers

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrReaderNotFound = errors.New("reader not found")

type Repository interface {
	UpsertReader(ctx context.Context, googleSub, email, name string) (Reader, error)
	GetReader(ctx context.Context, id uuid.UUID) (Reader, error)
	AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	ListBookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error)
	UpsertSubscriber(ctx context.Context, email string) error
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
