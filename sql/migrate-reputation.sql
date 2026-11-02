-- GoIndica Fase 2 — reputação (§R)
-- Idempotente: seguro reaplicar em DB existente.
-- Uso: npm run db:migrate   ou   npm run db:schema (também aplica)

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- users.selected_and_evaluated_count
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'selected_and_evaluated_count'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE users ADD COLUMN selected_and_evaluated_count INT NOT NULL DEFAULT 0 AFTER valid_indication_count',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- users.reputation → SMALLINT NOT NULL DEFAULT 0 (cache 0..100)
UPDATE users SET reputation = 0 WHERE reputation IS NULL;
SET @rep_type := (
  SELECT DATA_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'reputation'
  LIMIT 1
);
SET @sql := IF(
  @rep_type IS NOT NULL AND @rep_type <> 'smallint',
  'ALTER TABLE users MODIFY COLUMN reputation SMALLINT NOT NULL DEFAULT 0',
  IF(
    @rep_type = 'smallint',
    'ALTER TABLE users MODIFY COLUMN reputation SMALLINT NOT NULL DEFAULT 0',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- indications freeze columns
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'indications'
    AND COLUMN_NAME = 'frozen_reputation'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE indications ADD COLUMN frozen_reputation SMALLINT NULL AFTER locked_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'indications'
    AND COLUMN_NAME = 'frozen_valid_count'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE indications ADD COLUMN frozen_valid_count INT NULL AFTER frozen_reputation',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'indications'
    AND COLUMN_NAME = 'comparison_sort_key'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE indications ADD COLUMN comparison_sort_key INT NULL AFTER frozen_valid_count',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS reputation_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  evaluation_id BIGINT UNSIGNED NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  request_title_snapshot VARCHAR(200) NOT NULL,
  outcome ENUM('valid', 'invalid') NOT NULL,
  reputation_before SMALLINT NOT NULL,
  delta SMALLINT NOT NULL,
  reputation_after SMALLINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reputation_history_user_created (user_id, created_at),
  KEY idx_reputation_history_evaluation (evaluation_id),
  CONSTRAINT fk_reputation_history_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_reputation_history_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations (id),
  CONSTRAINT fk_reputation_history_request FOREIGN KEY (request_id) REFERENCES requests (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
