// Atlas config — sinh migration từ GORM model (xem cmd/atlas-loader).
// Dùng: atlas migrate diff <tên> --env gorm
//       atlas migrate apply --env gorm --url "$DATABASE_URL"
data "external_schema" "gorm" {
  program = [
    "go", "run", "./cmd/atlas-loader",
  ]
}

env "gorm" {
  src = data.external_schema.gorm.url

  // DB tạm để Atlas tính diff (dùng Docker). Slice 1 chưa có cột vector nên
  // dùng image postgres chuẩn là đủ (gen_random_uuid có sẵn từ PG13).
  dev = "docker://postgres/16/dev?search_path=public"

  migration {
    dir = "file://migrations"
  }

  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
