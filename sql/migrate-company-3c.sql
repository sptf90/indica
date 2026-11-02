-- GoIndica Fase 3C — conta empresarial + solicitação de patrocínio + resgates
-- Idempotente. RF-EMP-01…05 / RF-SPON-01…13 (sem cobrança/admin completo).
-- Uso: npm run db:migrate

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- users.account_type — user | company (empresa não pede/indica)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'account_type'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE users ADD COLUMN account_type ENUM(''user'',''company'') NOT NULL DEFAULT ''user'' AFTER password_hash',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- companies.user_id — login 1:1 com conta empresarial
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND COLUMN_NAME = 'user_id'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE companies ADD COLUMN user_id BIGINT UNSIGNED NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND INDEX_NAME = 'uq_companies_user'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE companies ADD UNIQUE KEY uq_companies_user (user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND CONSTRAINT_NAME = 'fk_companies_user'
);
SET @sql := IF(
  @fk = 0,
  'ALTER TABLE companies ADD CONSTRAINT fk_companies_user FOREIGN KEY (user_id) REFERENCES users (id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.prize_redemption_deadline_days — prazo de resgate após resultado final
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'prize_redemption_deadline_days'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN prize_redemption_deadline_days INT UNSIGNED NULL AFTER prize_redemption_instructions',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.regulation_text — regulamento aprovado da campanha
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'regulation_text'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN regulation_text TEXT NULL AFTER prize_redemption_deadline_days',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS sponsorship_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  city_id BIGINT UNSIGNED NULL,
  modality ENUM('weekly', 'monthly') NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500) NULL,
  regulation_text TEXT NOT NULL,
  prize_positions_json JSON NOT NULL,
  prize_benefit_mode ENUM('equal', 'per_position') NOT NULL DEFAULT 'equal',
  prize_benefits_json JSON NOT NULL,
  prize_redemption_instructions TEXT NOT NULL,
  redemption_deadline_days INT UNSIGNED NOT NULL DEFAULT 30,
  status ENUM(
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'awaiting_correction'
  ) NOT NULL DEFAULT 'submitted',
  ranking_id BIGINT UNSIGNED NULL,
  review_note VARCHAR(500) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_spon_req_company (company_id, created_at),
  KEY idx_spon_req_slot (city_id, modality, period_start, status),
  KEY idx_spon_req_ranking (ranking_id),
  CONSTRAINT fk_spon_req_company FOREIGN KEY (company_id) REFERENCES companies (id),
  CONSTRAINT fk_spon_req_city FOREIGN KEY (city_id) REFERENCES cities (id),
  CONSTRAINT fk_spon_req_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_rewards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ranking_id BIGINT UNSIGNED NOT NULL,
  company_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  participation_id BIGINT UNSIGNED NOT NULL,
  final_position INT NOT NULL,
  benefit_text VARCHAR(500) NOT NULL,
  status ENUM('pending', 'redeemed', 'expired') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  redeemed_at DATETIME NULL,
  reminders_stopped_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reward_ranking_user (ranking_id, user_id),
  KEY idx_rewards_company_status (company_id, status),
  KEY idx_rewards_user (user_id),
  KEY idx_rewards_expires (status, expires_at),
  CONSTRAINT fk_rewards_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_rewards_company FOREIGN KEY (company_id) REFERENCES companies (id),
  CONSTRAINT fk_rewards_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_rewards_participation FOREIGN KEY (participation_id) REFERENCES ranking_participations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
