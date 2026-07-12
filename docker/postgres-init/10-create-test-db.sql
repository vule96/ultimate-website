-- Tạo DB test cách li khỏi dev DB (L12). Script trong docker-entrypoint-initdb.d
-- chỉ chạy khi volume Postgres MỚI; volume cũ dùng lệnh createdb trong README core.
CREATE DATABASE blog_test OWNER blog;
