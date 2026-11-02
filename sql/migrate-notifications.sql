-- GoIndica Fase 4 — Central de notificações (§5.6 / R.5 / AC-14)
-- Idempotente. Uso: npm run db:migrate
-- Categorias: indications | rankings | scoring
-- Sem exclusão pelo usuário.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

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
