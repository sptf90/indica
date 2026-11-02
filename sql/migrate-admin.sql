-- GoIndica Fase 4 (MVP) — papel admin para análise de patrocínio
-- Idempotente. Uso: npm run db:migrate-admin / db:migrate
-- Empresa continua sem poderes admin (is_admin só em conta user).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_admin'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER account_type',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_is_admin'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE users ADD KEY idx_users_is_admin (is_admin)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
