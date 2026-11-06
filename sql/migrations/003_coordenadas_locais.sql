-- Preserva os locais antigos sem inventar coordenadas a partir de texto livre.
ALTER TABLE indicacao_locais
  ADD COLUMN latitude DECIMAL(10,7) NULL,
  ADD COLUMN longitude DECIMAL(11,7) NULL,
  ADD COLUMN tipo_localizacao ENUM('place', 'map_pin') NOT NULL DEFAULT 'place',
  ADD CONSTRAINT chk_local_coordenadas CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );
