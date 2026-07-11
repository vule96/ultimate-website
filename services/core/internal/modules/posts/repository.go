package posts

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// sortColumns whitelist cột được phép ORDER BY (chống SQL injection).
var sortColumns = map[string]string{
	"title":      "posts.title",
	"status":     "posts.status",
	"updated_at": "posts.updated_at",
	"created_at": "posts.created_at",
}

// orderClause dựng mệnh đề ORDER BY an toàn từ field/order do client gửi.
func orderClause(sort, order string) string {
	col, ok := sortColumns[sort]
	if !ok {
		col = "posts.created_at"
	}
	if strings.ToLower(order) == "asc" {
		return col + " ASC"
	}
	return col + " DESC"
}

// --- GORM models (tầng ngoài; chỉ file này biết về GORM) ---

type gormPost struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Title       string         `gorm:"not null"`
	Slug        string         `gorm:"uniqueIndex;not null"`
	ContentJSON datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'"`
	ContentHTML string         `gorm:"not null;default:''"`
	Excerpt     *string
	CoverImage  *string
	Status      string `gorm:"not null;default:'DRAFT';index;check:posts_status_check,status IN ('DRAFT','PENDING_APPROVAL','PUBLISHED')"`
	MetaTitle   *string
	MetaDesc    *string
	PublishedAt *time.Time `gorm:"index"`
	Tags        []gormTag  `gorm:"many2many:post_tags;joinForeignKey:PostID;joinReferences:TagID;constraint:OnDelete:CASCADE;"`
	CreatedAt   time.Time  `gorm:"not null;default:now()"`
	UpdatedAt   time.Time  `gorm:"not null;default:now()"`
}

func (gormPost) TableName() string { return "posts" }

type gormTag struct {
	ID   uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name string    `gorm:"uniqueIndex;not null"`
	Slug string    `gorm:"uniqueIndex;not null"`
}

func (gormTag) TableName() string { return "tags" }

// --- Repository ---

// GormRepository cài đặt Repository bằng GORM/Postgres.
type GormRepository struct {
	db *gorm.DB
}

// NewGormRepository tạo repository từ *gorm.DB.
func NewGormRepository(db *gorm.DB) *GormRepository { return &GormRepository{db: db} }

// Models trả về các GORM model của module để công cụ migration (Atlas) nạp schema.
// Giữ model unexported nhưng vẫn cho phép loader bên ngoài tham chiếu.
func Models() []any { return []any{&gormPost{}, &gormTag{}} }

var _ Repository = (*GormRepository)(nil)

// Create lưu bài viết + upsert tags + gắn quan hệ trong 1 transaction.
func (r *GormRepository) Create(ctx context.Context, p *Post) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		gp := toGormModel(p)
		gp.Tags = nil
		if err := tx.Omit("Tags").Create(&gp).Error; err != nil {
			return translateErr(err)
		}
		tags, err := upsertTags(tx, p.Tags)
		if err != nil {
			return err
		}
		if err := tx.Model(&gp).Association("Tags").Replace(tags); err != nil {
			return err
		}
		applyGenerated(p, gp, tags)
		return nil
	})
}

// Update ghi đè bài viết theo ID + thay toàn bộ tags.
func (r *GormRepository) Update(ctx context.Context, p *Post) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		gp := toGormModel(p)
		gp.Tags = nil
		if err := tx.Omit("Tags").Save(&gp).Error; err != nil {
			return translateErr(err)
		}
		tags, err := upsertTags(tx, p.Tags)
		if err != nil {
			return err
		}
		if err := tx.Model(&gp).Association("Tags").Replace(tags); err != nil {
			return err
		}
		applyGenerated(p, gp, tags)
		return nil
	})
}

// GetByID trả về bài viết theo id (kèm tags).
func (r *GormRepository) GetByID(ctx context.Context, id uuid.UUID) (*Post, error) {
	var gp gormPost
	err := r.db.WithContext(ctx).Preload("Tags").First(&gp, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, err
	}
	return toDomain(gp), nil
}

// GetBySlug trả về bài viết theo slug (kèm tags).
func (r *GormRepository) GetBySlug(ctx context.Context, slug string) (*Post, error) {
	var gp gormPost
	err := r.db.WithContext(ctx).Preload("Tags").First(&gp, "slug = ?", slug).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPostNotFound
	}
	if err != nil {
		return nil, err
	}
	return toDomain(gp), nil
}

// List trả về danh sách bài viết theo filter + tổng số bản ghi khớp.
func (r *GormRepository) List(ctx context.Context, f ListFilter) ([]Post, int64, error) {
	// applyFilters dựng điều kiện lọc trên một query mới, tránh rò rỉ clause
	// (vd DISTINCT) giữa truy vấn Count và Find.
	applyFilters := func(db *gorm.DB) *gorm.DB {
		db = db.Model(&gormPost{})
		if f.Status != "" {
			db = db.Where("posts.status = ?", f.Status)
		}
		if f.Tag != "" {
			db = db.
				Joins("JOIN post_tags pt ON pt.post_id = posts.id").
				Joins("JOIN tags t ON t.id = pt.tag_id").
				Where("t.slug = ?", f.Tag)
		}
		if f.Search != "" {
			db = db.Where("posts.title ILIKE ?", "%"+f.Search+"%")
		}
		return db
	}

	var total int64
	if err := applyFilters(r.db.WithContext(ctx)).Distinct("posts.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []gormPost
	err := applyFilters(r.db.WithContext(ctx)).
		Preload("Tags").
		Order(orderClause(f.Sort, f.Order)).
		Limit(f.Limit).
		Offset(f.Offset).
		Find(&rows).Error
	if err != nil {
		return nil, 0, err
	}

	posts := make([]Post, len(rows))
	for i, gp := range rows {
		posts[i] = *toDomain(gp)
	}
	return posts, total, nil
}

// Delete xoá bài viết + quan hệ tags; trả ErrPostNotFound nếu không có.
func (r *GormRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Select(clause.Associations).Delete(&gormPost{ID: id})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrPostNotFound
	}
	return nil
}

// ListTags trả về tag, sắp theo tên. Khi publishedOnly, chỉ trả tag gắn với ít
// nhất một bài PUBLISHED (join post_tags/posts) — dùng cho khách chưa đăng nhập.
func (r *GormRepository) ListTags(ctx context.Context, publishedOnly bool) ([]Tag, error) {
	var rows []gormTag
	q := r.db.WithContext(ctx).Order("name ASC")
	if publishedOnly {
		q = q.Distinct("tags.*").
			Joins("JOIN post_tags ON post_tags.tag_id = tags.id").
			Joins("JOIN posts ON posts.id = post_tags.post_id").
			Where("posts.status = ?", string(StatusPublished))
	}
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}
	tags := make([]Tag, len(rows))
	for i, gt := range rows {
		tags[i] = Tag{ID: gt.ID, Name: gt.Name, Slug: gt.Slug}
	}
	return tags, nil
}

// Stats đếm tổng số bài, số bài theo trạng thái PUBLISHED/DRAFT và số tag phân biệt.
func (r *GormRepository) Stats(ctx context.Context) (StatsResult, error) {
	db := r.db.WithContext(ctx)
	var res StatsResult

	if err := db.Model(&gormPost{}).Count(&res.Total).Error; err != nil {
		return StatsResult{}, err
	}
	if err := db.Model(&gormPost{}).Where("status = ?", string(StatusPublished)).Count(&res.Published).Error; err != nil {
		return StatsResult{}, err
	}
	if err := db.Model(&gormPost{}).Where("status = ?", string(StatusDraft)).Count(&res.Draft).Error; err != nil {
		return StatsResult{}, err
	}
	if err := db.Model(&gormTag{}).Count(&res.Tags).Error; err != nil {
		return StatsResult{}, err
	}
	return res, nil
}

// CountByMonth đếm số bài viết theo tháng ("YYYY-MM") cho các bài created_at >= since.
func (r *GormRepository) CountByMonth(ctx context.Context, since time.Time) (map[string]int64, error) {
	type row struct {
		M string
		C int64
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Model(&gormPost{}).
		Select("to_char(date_trunc('month', created_at), 'YYYY-MM') as m, count(*) as c").
		Where("created_at >= ?", since).
		Group("date_trunc('month', created_at)").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[string]int64, len(rows))
	for _, r := range rows {
		out[r.M] = r.C
	}
	return out, nil
}

// --- helpers ---

// upsertTags đảm bảo mỗi tag tồn tại (theo slug) và trả về bản ghi có ID.
// Batch INSERT ... ON CONFLICT (slug) DO UPDATE — atomic (M1): concurrent save
// không còn dính unique-violation race, và chỉ 1 round-trip cho mọi tag.
// DO UPDATE (thay vì DO NOTHING) để RETURNING trả id cả với dòng đã tồn tại.
func upsertTags(tx *gorm.DB, tags []Tag) ([]gormTag, error) {
	if len(tags) == 0 {
		return nil, nil
	}
	gts := make([]gormTag, len(tags))
	for i, t := range tags {
		gts[i] = gormTag{Name: t.Name, Slug: t.Slug}
	}
	err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "slug"}},
		DoUpdates: clause.AssignmentColumns([]string{"name"}),
	}).Create(&gts).Error
	if err != nil {
		// Không translateErr ở đây: unique-violation của TAG không phải SLUG_TAKEN
		// của post (đó là bug M1 cũ). Lỗi hiếm còn lại (vd trùng name khác slug)
		// trả nguyên trạng → 500 có log, không đánh lừa client bằng 409.
		return nil, err
	}
	return gts, nil
}

func toGormModel(p *Post) gormPost {
	return gormPost{
		ID:          p.ID,
		Title:       p.Title,
		Slug:        p.Slug,
		ContentJSON: datatypes.JSON(defaultJSON(p.ContentJSON)),
		ContentHTML: p.ContentHTML,
		Excerpt:     p.Excerpt,
		CoverImage:  p.CoverImage,
		Status:      string(p.Status),
		MetaTitle:   p.MetaTitle,
		MetaDesc:    p.MetaDesc,
		PublishedAt: p.PublishedAt,
		// Giữ lại timestamps để Save (update) không ghi đè created_at về zero.
		// Khi tạo mới, giá trị zero sẽ được GORM autoCreateTime điền.
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
}

func toDomain(gp gormPost) *Post {
	p := &Post{
		ID:          gp.ID,
		Title:       gp.Title,
		Slug:        gp.Slug,
		ContentJSON: []byte(gp.ContentJSON),
		ContentHTML: gp.ContentHTML,
		Excerpt:     gp.Excerpt,
		CoverImage:  gp.CoverImage,
		Status:      PostStatus(gp.Status),
		MetaTitle:   gp.MetaTitle,
		MetaDesc:    gp.MetaDesc,
		PublishedAt: gp.PublishedAt,
		CreatedAt:   gp.CreatedAt,
		UpdatedAt:   gp.UpdatedAt,
	}
	for _, gt := range gp.Tags {
		p.Tags = append(p.Tags, Tag{ID: gt.ID, Name: gt.Name, Slug: gt.Slug})
	}
	return p
}

// applyGenerated copy các giá trị DB sinh ra (ID, timestamps, tag IDs) về domain.
func applyGenerated(p *Post, gp gormPost, tags []gormTag) {
	p.ID = gp.ID
	p.CreatedAt = gp.CreatedAt
	p.UpdatedAt = gp.UpdatedAt
	p.Tags = make([]Tag, len(tags))
	for i, gt := range tags {
		p.Tags[i] = Tag{ID: gt.ID, Name: gt.Name, Slug: gt.Slug}
	}
}

// translateErr chuyển lỗi GORM sang lỗi domain khi phù hợp.
func translateErr(err error) error {
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return ErrSlugTaken
	}
	return err
}
