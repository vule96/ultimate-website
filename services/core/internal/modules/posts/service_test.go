package posts

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// mockRepo là mock thủ công của Repository cho unit test service.
type mockRepo struct {
	created     *Post
	updated     *Post
	createErr   error
	monthCounts map[string]int64
}

func (m *mockRepo) Create(_ context.Context, p *Post) error {
	m.created = p
	return m.createErr
}
func (m *mockRepo) Update(_ context.Context, p *Post) error { m.updated = p; return nil }
func (m *mockRepo) GetByID(_ context.Context, _ uuid.UUID) (*Post, error) {
	return nil, ErrPostNotFound
}
func (m *mockRepo) GetBySlug(_ context.Context, _ string) (*Post, error) {
	return nil, ErrPostNotFound
}
func (m *mockRepo) List(_ context.Context, _ ListFilter) ([]Post, int64, error) {
	return nil, 0, nil
}
func (m *mockRepo) Delete(_ context.Context, _ uuid.UUID) error  { return nil }
func (m *mockRepo) ListTags(_ context.Context) ([]Tag, error)    { return nil, nil }
func (m *mockRepo) Stats(_ context.Context) (StatsResult, error) { return StatsResult{}, nil }
func (m *mockRepo) CountByMonth(_ context.Context, _ time.Time) (map[string]int64, error) {
	return m.monthCounts, nil
}

var fixedNow = time.Date(2026, 7, 5, 9, 0, 0, 0, time.UTC)

func newTestService(repo Repository) *Service {
	s := NewService(repo)
	s.now = func() time.Time { return fixedNow }
	return s
}

func TestServiceTimeSeries_ZeroFillsMonths(t *testing.T) {
	// fixedNow = 2026-07 → 3 tháng gần nhất: 2026-05, 2026-06, 2026-07.
	repo := &mockRepo{monthCounts: map[string]int64{"2026-05": 2, "2026-07": 5}}
	svc := newTestService(repo)

	series, err := svc.TimeSeries(context.Background(), 3)
	if err != nil {
		t.Fatalf("timeseries: %v", err)
	}
	want := []MonthCount{{"2026-05", 2}, {"2026-06", 0}, {"2026-07", 5}}
	if len(series) != len(want) {
		t.Fatalf("len = %d, want %d", len(series), len(want))
	}
	for i, w := range want {
		if series[i] != w {
			t.Errorf("series[%d] = %+v, want %+v", i, series[i], w)
		}
	}
}

func TestServiceTimeSeries_ClampsMonths(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)
	if s, _ := svc.TimeSeries(context.Background(), 0); len(s) != 8 {
		t.Errorf("months=0 → len %d, want default 8", len(s))
	}
	if s, _ := svc.TimeSeries(context.Background(), 100); len(s) != 24 {
		t.Errorf("months=100 → len %d, want clamp 24", len(s))
	}
}

func TestServiceCreate_EmptyTitleIsValidationError(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{Title: "  "})

	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
	if repo.created != nil {
		t.Errorf("repo.Create should not be called on invalid input")
	}
}

func TestServiceCreate_DerivesSlugFromTitle(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{Title: "Lập trình Go"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.created.Slug != "lap-trinh-go" {
		t.Errorf("slug = %q, want %q", repo.created.Slug, "lap-trinh-go")
	}
}

func TestServiceCreate_SlugifiesExplicitSlug(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{Title: "x", Slug: "My Custom Slug!"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.created.Slug != "my-custom-slug" {
		t.Errorf("slug = %q, want %q", repo.created.Slug, "my-custom-slug")
	}
}

func TestServiceCreate_DefaultsStatusToDraft(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{Title: "x"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.created.Status != StatusDraft {
		t.Errorf("status = %q, want DRAFT", repo.created.Status)
	}
	if repo.created.PublishedAt != nil {
		t.Errorf("PublishedAt should be nil for DRAFT")
	}
}

func TestServiceCreate_InvalidStatusIsValidationError(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{Title: "x", Status: "NOPE"})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("expected ErrValidation, got %v", err)
	}
}

func TestServiceCreate_PublishedSetsPublishedAt(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{Title: "x", Status: StatusPublished})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.created.PublishedAt == nil || !repo.created.PublishedAt.Equal(fixedNow) {
		t.Errorf("PublishedAt = %v, want %v", repo.created.PublishedAt, fixedNow)
	}
}

func TestServiceCreate_NormalizesAndDedupsTags(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	_, err := svc.Create(context.Background(), CreateInput{
		Title:    "x",
		TagNames: []string{"Go", "go", " Backend ", ""},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := repo.created.Tags
	if len(got) != 2 {
		t.Fatalf("expected 2 tags after dedup, got %d (%+v)", len(got), got)
	}
	if got[0].Name != "Go" || got[0].Slug != "go" {
		t.Errorf("tag[0] = %+v, want {Name:Go Slug:go}", got[0])
	}
	if got[1].Slug != "backend" {
		t.Errorf("tag[1].Slug = %q, want backend", got[1].Slug)
	}
}
