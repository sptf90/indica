ALTER TABLE pedidos
  ADD COLUMN indicacao_prazo_em DATETIME NULL,
  ADD KEY idx_pedidos_status_prazo_indicacao (status, excluido_em, indicacao_prazo_em, id);

UPDATE pedidos
SET indicacao_prazo_em = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 48 HOUR)
WHERE status = 'open' AND excluido_em IS NULL AND indicacao_prazo_em IS NULL;
