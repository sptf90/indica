-- Site/URL do patrocinador (botão «Conhecer …» no ranking)
-- Idempotente.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sponsorship_requests'
    AND COLUMN_NAME = 'site_url'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE sponsorship_requests ADD COLUMN site_url VARCHAR(500) NULL AFTER banner_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rankings'
    AND COLUMN_NAME = 'sponsor_site_url'
);
SET @sql := IF(
  @col = 0,
  'ALTER TABLE rankings ADD COLUMN sponsor_site_url VARCHAR(500) NULL AFTER sponsor_banner_url',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
