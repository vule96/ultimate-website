package cache

import "testing"

func TestKeyDeterministic(t *testing.T) {
	a := Key("posts_list", 3, "PUBLISHED", "", "go")
	b := Key("posts_list", 3, "PUBLISHED", "", "go")
	if a != b {
		t.Errorf("cùng input phải cùng key: %s != %s", a, b)
	}
}

func TestKeyChangesWithParts(t *testing.T) {
	a := Key("posts_list", 3, "PUBLISHED", "", "go")
	b := Key("posts_list", 3, "PUBLISHED", "go", "")
	if a == b {
		t.Error("đổi vị trí parts phải ra key khác (unit separator)")
	}
}

func TestKeyChangesWithVersion(t *testing.T) {
	a := Key("posts_list", 3, "x")
	b := Key("posts_list", 4, "x")
	if a == b {
		t.Error("bump version phải ra key khác")
	}
}
