package posts

import "testing"

func TestPostStatusValid(t *testing.T) {
	valid := []PostStatus{StatusDraft, StatusPendingApproval, StatusPublished}
	for _, s := range valid {
		if !s.Valid() {
			t.Errorf("expected %q to be valid", s)
		}
	}
	invalid := []PostStatus{"", "draft", "ARCHIVED", "published"}
	for _, s := range invalid {
		if s.Valid() {
			t.Errorf("expected %q to be invalid", s)
		}
	}
}
