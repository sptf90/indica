-- GoIndica — cidade obrigatória na conta empresarial (patrocínio só local)
-- Idempotente. Uso: node scripts/migrate-company-city.mjs

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- companies.city_id — cidade onde a empresa está instalada
SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND COLUMN_NAME = 'city_id'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE companies ADD COLUMN city_id BIGINT UNSIGNED NULL AFTER logo_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND INDEX_NAME = 'idx_companies_city'
);
SET @sql := IF(
  @idx = 0,
  'ALTER TABLE companies ADD KEY idx_companies_city (city_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'companies'
    AND CONSTRAINT_NAME = 'fk_companies_city'
);
SET @sql := IF(
  @fk = 0,
  'ALTER TABLE companies ADD CONSTRAINT fk_companies_city FOREIGN KEY (city_id) REFERENCES cities (id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
