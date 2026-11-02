-- GoIndica Fase 3B — superfície patrocinada (RF-SPON-05/08/09 + posições premiadas)
-- Idempotente. Sem fluxo de resgate/confirmação empresarial (3C).
-- Uso: npm run db:migrate   ou   npm run db:migrate-rankings

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- rankings.sponsor_display_name (campanha aprovada; fallback: companies.legal_name)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'sponsor_display_name'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN sponsor_display_name VARCHAR(255) NULL AFTER sponsor_company_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.sponsor_logo_url (campanha aprovada; fallback: companies.logo_url)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'sponsor_logo_url'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN sponsor_logo_url VARCHAR(500) NULL AFTER sponsor_display_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.prize_positions_json — ex.: [1,2,3]
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'prize_positions_json'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN prize_positions_json JSON NULL AFTER sponsor_logo_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.prize_benefit_mode — equal | per_position
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'prize_benefit_mode'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN prize_benefit_mode ENUM(''equal'',''per_position'') NULL AFTER prize_positions_json',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.prize_benefits_json — { "default": "..." } ou { "1": "...", "2": "..." }
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'prize_benefits_json'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN prize_benefits_json JSON NULL AFTER prize_benefit_mode',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- rankings.prize_redemption_instructions — consulta pós-final (somente leitura; sem confirmar resgate)
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'prize_redemption_instructions'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN prize_redemption_instructions TEXT NULL AFTER prize_benefits_json',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
