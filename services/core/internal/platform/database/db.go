// Package database mở kết nối GORM tới Postgres.
package database

import (
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open mở kết nối GORM tới Postgres theo DSN cho trước.
func Open(dsn string, production bool) (*gorm.DB, error) {
	logLevel := logger.Info
	if production {
		logLevel = logger.Warn
	}
	return gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		// Dịch lỗi driver sang lỗi GORM (vd ErrDuplicatedKey) để tầng repo map được.
		TranslateError: true,
	})
}
