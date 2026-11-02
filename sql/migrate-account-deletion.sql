-- GoIndica Fase 4 — Exclusão definitiva de conta (§5.7 / AC-15…AC-17)
-- Idempotente. Uso: npm run db:migrate
-- Soft-delete + anonimização; auditoria em account_deletions.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- users.deleted_at
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'deleted_at'
);
SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE col_stmt FROM @col_sql;
EXECUTE col_stmt;
DEALLOCATE PREPARE col_stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_deleted_at'
);
SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE users ADD KEY idx_users_deleted_at (deleted_at)',
  'SELECT 1'
);
PREPARE idx_stmt FROM @idx_sql;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;

CREATE TABLE IF NOT EXISTS account_deletions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  previous_username VARCHAR(40) NOT NULL,
  previous_email VARCHAR(255) NOT NULL,
  reauth_method ENUM('password', 'google') NOT NULL,
  closed_requests_count INT NOT NULL DEFAULT 0,
  frozen_rankings_count INT NOT NULL DEFAULT 0,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_account_deletions_user (user_id),
  KEY idx_account_deletions_created (created_at),
  CONSTRAINT fk_account_deletions_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
