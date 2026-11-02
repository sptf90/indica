-- GoIndica Fase 3A — rankings orgânicos + ledger de pontos (§R / §5.5)
-- Idempotente. Uso: npm run db:migrate   ou   npm run db:schema
-- Fuso oficial dos períodos ainda TBD (consolidada) — janelas gravadas em UTC.
-- Campos de patrocínio 3B: ver migrate-rankings-sponsor.sql (aplicado pelo script).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS rankings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  city_id BIGINT UNSIGNED NULL,
  modality ENUM('weekly', 'monthly') NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  status ENUM('open', 'tallying', 'final') NOT NULL DEFAULT 'open',
  title VARCHAR(200) NOT NULL,
  sponsor_company_id BIGINT UNSIGNED NULL,
  sponsor_display_name VARCHAR(255) NULL,
  sponsor_logo_url VARCHAR(500) NULL,
  prize_positions_json JSON NULL,
  prize_benefit_mode ENUM('equal', 'per_position') NULL,
  prize_benefits_json JSON NULL,
  prize_redemption_instructions TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rankings_city_modality_period (city_id, modality, period_start),
  KEY idx_rankings_status_window (status, period_start, period_end),
  KEY idx_rankings_modality_status (modality, status),
  CONSTRAINT fk_rankings_city FOREIGN KEY (city_id) REFERENCES cities (id),
  CONSTRAINT fk_rankings_sponsor FOREIGN KEY (sponsor_company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_participations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ranking_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  enrolled_at DATETIME NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  valid_count_in_period INT NOT NULL DEFAULT 0,
  frozen_reputation SMALLINT NULL,
  final_position INT NULL,
  status ENUM('active', 'frozen', 'final') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ranking_user (ranking_id, user_id),
  KEY idx_participations_user (user_id, ranking_id),
  CONSTRAINT fk_ranking_participations_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_ranking_participations_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_ranking_participations_balance_nonneg CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS score_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ranking_id BIGINT UNSIGNED NOT NULL,
  participation_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  reason_code VARCHAR(64) NULL,
  rule_key VARCHAR(64) NOT NULL,
  delta INT NOT NULL,
  balance_after INT NOT NULL,
  evaluation_id BIGINT UNSIGNED NULL,
  request_id BIGINT UNSIGNED NULL,
  indication_id BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_score_ledger_idempotency (idempotency_key),
  KEY idx_score_ledger_user_ranking (user_id, ranking_id, created_at),
  KEY idx_score_ledger_ranking (ranking_id, created_at),
  KEY idx_score_ledger_evaluation (evaluation_id),
  CONSTRAINT fk_score_ledger_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_score_ledger_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_score_ledger_participation FOREIGN KEY (participation_id) REFERENCES ranking_participations (id),
  CONSTRAINT fk_score_ledger_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations (id),
  CONSTRAINT chk_score_ledger_balance_nonneg CHECK (balance_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
