-- GoIndica — Link de partilha + visitas distintas (1º desempate do ranking)
-- Idempotente. Uso: npm run db:migrate  /  node scripts/migrate-share-links.mjs
-- Contagem vitalícia na conta (users.share_visit_count); snapshot em finalize.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- users.share_code
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'share_code'
);
SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN share_code VARCHAR(16) NULL AFTER selected_and_evaluated_count',
  'SELECT 1'
);
PREPARE col_stmt FROM @col_sql;
EXECUTE col_stmt;
DEALLOCATE PREPARE col_stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'uq_users_share_code'
);
SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE users ADD UNIQUE KEY uq_users_share_code (share_code)',
  'SELECT 1'
);
PREPARE idx_stmt FROM @idx_sql;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;

-- users.share_visit_count (denormalizado; pessoas distintas)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'share_visit_count'
);
SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN share_visit_count INT NOT NULL DEFAULT 0 AFTER share_code',
  'SELECT 1'
);
PREPARE col_stmt FROM @col_sql;
EXECUTE col_stmt;
DEALLOCATE PREPARE col_stmt;

-- Snapshot no fecho do ranking (apuração → final)
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ranking_participations'
    AND COLUMN_NAME = 'frozen_share_visit_count'
);
SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE ranking_participations ADD COLUMN frozen_share_visit_count INT NULL AFTER frozen_reputation',
  'SELECT 1'
);
PREPARE col_stmt FROM @col_sql;
EXECUTE col_stmt;
DEALLOCATE PREPARE col_stmt;

CREATE TABLE IF NOT EXISTS share_visits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  visitor_user_id BIGINT UNSIGNED NULL,
  visitor_key VARCHAR(64) NOT NULL,
  first_seen_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_share_owner_visitor (owner_user_id, visitor_key),
  KEY idx_share_visits_owner (owner_user_id),
  KEY idx_share_visits_visitor_user (visitor_user_id),
  CONSTRAINT fk_share_visits_owner FOREIGN KEY (owner_user_id) REFERENCES users (id),
  CONSTRAINT fk_share_visits_visitor FOREIGN KEY (visitor_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
