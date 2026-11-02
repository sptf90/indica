-- GoIndica — tutorial_completed_at (onboarding product tour)
-- Idempotente. Uso: npm run db:migrate-tutorial  /  node scripts/migrate-tutorial.mjs

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'tutorial_completed_at'
);
SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN tutorial_completed_at DATETIME NULL DEFAULT NULL AFTER share_visit_count',
  'SELECT 1'
);
PREPARE col_stmt FROM @col_sql;
EXECUTE col_stmt;
DEALLOCATE PREPARE col_stmt;
