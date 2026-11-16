-- Valores configuráveis sem alterar a regra de identificação.
CREATE TABLE IF NOT EXISTS configuracao_reputacao (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  pontos_principal INT NOT NULL DEFAULT 10,
  pontos_equivalencia INT NOT NULL DEFAULT 5,
  CONSTRAINT chk_pontos_equivalencia CHECK (pontos_equivalencia > 0 AND pontos_principal > pontos_equivalencia)
) ENGINE=InnoDB;
INSERT INTO configuracao_reputacao (id, pontos_principal, pontos_equivalencia) VALUES (1, 10, 5);

ALTER TABLE indicacoes
  ADD COLUMN nome_contato VARCHAR(255) NULL,
  ADD COLUMN tipo_validacao ENUM('chosen', 'equivalent') NULL,
  ADD COLUMN indicacao_origem_id BIGINT UNSIGNED NULL;

ALTER TABLE historico_reputacao
  ADD COLUMN tipo_validacao ENUM('chosen', 'equivalent') NULL,
  ADD COLUMN indicacao_id BIGINT UNSIGNED NULL,
  ADD COLUMN indicacao_origem_id BIGINT UNSIGNED NULL,
  ADD COLUMN pontos_atribuidos INT NULL;

ALTER TABLE usuarios
  ADD COLUMN contagem_validas_equivalentes INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN contagem_validas_escolhidas INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN pontuacao_acumulada INT NOT NULL DEFAULT 0;

-- Classifica o legado e preserva os pontos efetivamente atribuídos (sem reprocessar rankings).
UPDATE indicacoes SET tipo_validacao = IF(selecionada_em IS NULL, 'equivalent', 'chosen')
WHERE resultado = 'valid';
UPDATE indicacoes i JOIN pedidos p ON p.id = i.pedido_id
SET i.indicacao_origem_id = p.indicacao_selecionada_id
WHERE i.tipo_validacao = 'equivalent';
UPDATE historico_reputacao h JOIN avaliacoes a ON a.id = h.avaliacao_id
JOIN indicacoes i ON i.id = a.indicacao_id
SET h.indicacao_id = i.id, h.tipo_validacao = i.tipo_validacao,
    h.indicacao_origem_id = i.indicacao_origem_id;
UPDATE historico_reputacao h JOIN (
  SELECT avaliacao_id, MAX(delta) AS pontos FROM ledger_pontuacao GROUP BY avaliacao_id
) l ON l.avaliacao_id = h.avaliacao_id SET h.pontos_atribuidos = l.pontos;
UPDATE usuarios u LEFT JOIN (
  SELECT indicador_id, SUM(tipo_validacao = 'equivalent') AS equivalentes,
         SUM(tipo_validacao = 'chosen') AS escolhidas
  FROM indicacoes GROUP BY indicador_id
) i ON i.indicador_id = u.id
LEFT JOIN (SELECT usuario_id, SUM(COALESCE(pontos_atribuidos, 0)) AS pontos FROM historico_reputacao GROUP BY usuario_id) h ON h.usuario_id = u.id
SET u.contagem_validas_equivalentes = COALESCE(i.equivalentes, 0),
    u.contagem_validas_escolhidas = COALESCE(i.escolhidas, 0),
    u.contagem_selecionadas_avaliadas = GREATEST(0, u.contagem_selecionadas_avaliadas - COALESCE(i.equivalentes, 0)),
    u.pontuacao_acumulada = COALESCE(h.pontos, 0);

-- Uma contribuição só pode ser reconhecida uma vez por usuário/pedido.
ALTER TABLE historico_reputacao ADD COLUMN chave_reconhecimento VARCHAR(100) NULL,
  ADD UNIQUE KEY uq_reconhecimento_pedido_usuario (chave_reconhecimento);
