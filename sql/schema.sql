-- GoIndica / Indica — schema MVP (Fase 0–2 + rankings 3A/3B + empresa/resgate 3C + exclusão §5.7)
-- Aplicar: node scripts/apply-schema.mjs  (também roda migrate-*.sql + seed)
--   ou: mysql … < sql/schema.sql && npm run db:migrate
-- Timestamps em UTC. Privacidade e regras de negócio no app, não só no SQL.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS cities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  state CHAR(2) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cities_slug (slug),
  KEY idx_cities_state_name (state, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_type ENUM('user', 'company') NOT NULL DEFAULT 'user',
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  photo_url VARCHAR(500) NULL,
  city_id BIGINT UNSIGNED NULL,
  reputation SMALLINT NOT NULL DEFAULT 0,
  valid_indication_count INT NOT NULL DEFAULT 0,
  selected_and_evaluated_count INT NOT NULL DEFAULT 0,
  share_code VARCHAR(16) NULL,
  share_visit_count INT NOT NULL DEFAULT 0,
  tutorial_completed_at DATETIME NULL DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL DEFAULT NULL,
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_share_code (share_code),
  KEY idx_users_city (city_id),
  KEY idx_users_deleted_at (deleted_at),
  CONSTRAINT fk_users_city FOREIGN KEY (city_id) REFERENCES cities (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  cnpj CHAR(14) NOT NULL,
  legal_name VARCHAR(255) NULL,
  logo_url VARCHAR(500) NULL,
  city_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_companies_cnpj (cnpj),
  UNIQUE KEY uq_companies_user (user_id),
  KEY idx_companies_city (city_id),
  CONSTRAINT fk_companies_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_companies_city FOREIGN KEY (city_id) REFERENCES cities (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  requester_id BIGINT UNSIGNED NOT NULL,
  city_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  details TEXT NULL,
  photo_url VARCHAR(500) NULL,
  status ENUM(
    'open',
    'in_evaluation',
    'completed',
    'closed_voluntary',
    'closed_no_valid',
    'closed_timeout'
  ) NOT NULL DEFAULT 'open',
  reopen_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  cycle_number INT NOT NULL DEFAULT 0,
  selection_count_in_cycle TINYINT UNSIGNED NOT NULL DEFAULT 0,
  comparison_opened_at DATETIME NULL,
  selected_indication_id BIGINT UNSIGNED NULL,
  evaluation_started_at DATETIME NULL,
  evaluation_deadline_at DATETIME NULL,
  closed_at DATETIME NULL,
  close_reason VARCHAR(64) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_requests_city_status_created (city_id, status, created_at),
  KEY idx_requests_requester_created (requester_id, created_at),
  KEY idx_requests_status_deadline (status, evaluation_deadline_at),
  CONSTRAINT fk_requests_requester FOREIGN KEY (requester_id) REFERENCES users (id),
  CONSTRAINT fk_requests_city FOREIGN KEY (city_id) REFERENCES cities (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  recommender_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(500) NOT NULL,
  status ENUM(
    'sent',
    'in_evaluation',
    'selected',
    'valid',
    'invalid',
    'not_selected',
    'closed_timeout',
    'closed_no_valid'
  ) NOT NULL DEFAULT 'sent',
  result ENUM('valid', 'invalid', 'not_selected') NULL,
  selected_at DATETIME NULL,
  evaluated_at DATETIME NULL,
  invalid_reason_code ENUM(
    'incorrect_insufficient',
    'unavailable',
    'closed_nonexistent',
    'no_contact',
    'other'
  ) NULL,
  invalid_reason_text TEXT NULL,
  cycle_number INT NOT NULL DEFAULT 0,
  locked_at DATETIME NULL,
  frozen_reputation SMALLINT NULL,
  frozen_valid_count INT NULL,
  comparison_sort_key INT NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_indications_request_recommender (request_id, recommender_id),
  KEY idx_indications_recommender_created (recommender_id, created_at),
  KEY idx_indications_request_cycle (request_id, cycle_number),
  CONSTRAINT fk_indications_request FOREIGN KEY (request_id) REFERENCES requests (id),
  CONSTRAINT fk_indications_recommender FOREIGN KEY (recommender_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FK circular requests.selected_indication_id → indications (ignorar se já existir)
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'requests'
    AND CONSTRAINT_NAME = 'fk_requests_selected_indication'
);
SET @fk_sql := IF(
  @fk_exists = 0,
  'ALTER TABLE requests ADD CONSTRAINT fk_requests_selected_indication FOREIGN KEY (selected_indication_id) REFERENCES indications (id)',
  'SELECT 1'
);
PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;

CREATE TABLE IF NOT EXISTS indication_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  indication_id BIGINT UNSIGNED NOT NULL,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  KEY idx_indication_links_indication (indication_id),
  CONSTRAINT fk_indication_links_indication FOREIGN KEY (indication_id) REFERENCES indications (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indication_places (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  indication_id BIGINT UNSIGNED NOT NULL,
  source ENUM('google_maps', 'manual') NOT NULL DEFAULT 'manual',
  place_id VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  maps_url TEXT NULL,
  UNIQUE KEY uq_indication_places_indication (indication_id),
  CONSTRAINT fk_indication_places_indication FOREIGN KEY (indication_id) REFERENCES indications (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS request_participations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  first_indicated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_participations_request_user (request_id, user_id),
  CONSTRAINT fk_participations_request FOREIGN KEY (request_id) REFERENCES requests (id),
  CONSTRAINT fk_participations_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requester_cooldowns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  recommender_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  last_indication_at DATETIME NOT NULL,
  UNIQUE KEY uq_cooldowns_pair (recommender_id, requester_id),
  KEY idx_cooldowns_lookup (recommender_id, requester_id, last_indication_at),
  CONSTRAINT fk_cooldowns_recommender FOREIGN KEY (recommender_id) REFERENCES users (id),
  CONSTRAINT fk_cooldowns_requester FOREIGN KEY (requester_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evaluations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  indication_id BIGINT UNSIGNED NOT NULL,
  evaluator_id BIGINT UNSIGNED NOT NULL,
  outcome ENUM('valid', 'invalid') NOT NULL,
  reason_code ENUM(
    'incorrect_insufficient',
    'unavailable',
    'closed_nonexistent',
    'no_contact',
    'other'
  ) NULL,
  reason_text TEXT NULL,
  evaluated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_evaluations_request (request_id),
  KEY idx_evaluations_indication (indication_id),
  CONSTRAINT fk_evaluations_request FOREIGN KEY (request_id) REFERENCES requests (id),
  CONSTRAINT fk_evaluations_indication FOREIGN KEY (indication_id) REFERENCES indications (id),
  CONSTRAINT fk_evaluations_evaluator FOREIGN KEY (evaluator_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(64) NULL,
  to_status VARCHAR(64) NULL,
  actor_type ENUM('user', 'system') NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity_type, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS score_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  request_id BIGINT UNSIGNED NULL,
  indication_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(64) NOT NULL,
  value INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_score_events_user (user_id, created_at),
  CONSTRAINT fk_score_events_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  sponsor_banner_url VARCHAR(500) NULL,
  prize_positions_json JSON NULL,
  prize_benefit_mode ENUM('equal', 'per_position') NULL,
  prize_benefits_json JSON NULL,
  prize_redemption_instructions TEXT NULL,
  prize_redemption_deadline_days INT UNSIGNED NULL,
  regulation_text TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rankings_city_modality_period (city_id, modality, period_start),
  KEY idx_rankings_status_window (status, period_start, period_end),
  KEY idx_rankings_modality_status (modality, status),
  CONSTRAINT fk_rankings_city FOREIGN KEY (city_id) REFERENCES cities (id),
  CONSTRAINT fk_rankings_sponsor FOREIGN KEY (sponsor_company_id) REFERENCES companies (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sponsorship_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  company_id BIGINT UNSIGNED NOT NULL,
  city_id BIGINT UNSIGNED NULL,
  modality ENUM('weekly', 'monthly') NOT NULL,
  period_start DATETIME NOT NULL,
  period_end DATETIME NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500) NULL,
  banner_url VARCHAR(500) NULL,
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

CREATE TABLE IF NOT EXISTS ranking_participations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ranking_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  enrolled_at DATETIME NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  valid_count_in_period INT NOT NULL DEFAULT 0,
  frozen_reputation SMALLINT NULL,
  frozen_share_visit_count INT NULL,
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

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  category ENUM('indications', 'rankings', 'scoring') NOT NULL,
  event VARCHAR(64) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  deeplink VARCHAR(500) NOT NULL,
  request_id BIGINT UNSIGNED NULL,
  indication_id BIGINT UNSIGNED NULL,
  ranking_id BIGINT UNSIGNED NULL,
  evaluation_id BIGINT UNSIGNED NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  idempotency_key VARCHAR(160) NULL,
  UNIQUE KEY uq_notifications_idempotency (idempotency_key),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_unread (user_id, read_at, created_at),
  KEY idx_notifications_user_category (user_id, category, read_at),
  KEY idx_notifications_request_event (request_id, event, read_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_notifications_request FOREIGN KEY (request_id) REFERENCES requests (id),
  CONSTRAINT fk_notifications_indication FOREIGN KEY (indication_id) REFERENCES indications (id),
  CONSTRAINT fk_notifications_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_notifications_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

INSERT INTO cities (name, state, slug) VALUES
  ('São Paulo', 'SP', 'sao-paulo-sp'),
  ('Rio de Janeiro', 'RJ', 'rio-de-janeiro-rj'),
  ('Belo Horizonte', 'MG', 'belo-horizonte-mg'),
  ('Curitiba', 'PR', 'curitiba-pr'),
  ('Porto Alegre', 'RS', 'porto-alegre-rs'),
  ('Salvador', 'BA', 'salvador-ba'),
  ('Brasília', 'DF', 'brasilia-df'),
  ('Fortaleza', 'CE', 'fortaleza-ce'),
  ('Recife', 'PE', 'recife-pe'),
  ('Campinas', 'SP', 'campinas-sp')
ON DUPLICATE KEY UPDATE name = VALUES(name), state = VALUES(state);
