-- Indica — esquema inicial (português)
-- Aplicar: npm run db:migrar
-- Timestamps em UTC. Valores ENUM de domínio permanecem em inglês (códigos do app).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS cidades (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  estado CHAR(2) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cidades_slug (slug),
  KEY idx_cidades_estado_nome (estado, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nome_usuario VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  tipo_conta ENUM('user', 'company') NOT NULL DEFAULT 'user',
  eh_admin TINYINT(1) NOT NULL DEFAULT 0,
  foto_url VARCHAR(500) NULL,
  cidade_id BIGINT UNSIGNED NULL,
  reputacao SMALLINT NOT NULL DEFAULT 0,
  contagem_indicacoes_validas INT NOT NULL DEFAULT 0,
  contagem_selecionadas_avaliadas INT NOT NULL DEFAULT 0,
  codigo_compartilhamento VARCHAR(16) NULL,
  contagem_visitas_compartilhamento INT NOT NULL DEFAULT 0,
  tutorial_concluido_em DATETIME NULL DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  excluido_em DATETIME NULL DEFAULT NULL,
  UNIQUE KEY uq_usuarios_nome_usuario (nome_usuario),
  UNIQUE KEY uq_usuarios_email (email),
  UNIQUE KEY uq_usuarios_codigo_compartilhamento (codigo_compartilhamento),
  KEY idx_usuarios_cidade (cidade_id),
  KEY idx_usuarios_excluido_em (excluido_em),
  KEY idx_usuarios_eh_admin (eh_admin),
  CONSTRAINT fk_usuarios_cidade FOREIGN KEY (cidade_id) REFERENCES cidades (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS empresas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NULL,
  cnpj CHAR(14) NOT NULL,
  razao_social VARCHAR(255) NULL,
  logo_url VARCHAR(500) NULL,
  cidade_id BIGINT UNSIGNED NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_empresas_cnpj (cnpj),
  UNIQUE KEY uq_empresas_usuario (usuario_id),
  KEY idx_empresas_cidade (cidade_id),
  CONSTRAINT fk_empresas_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_empresas_cidade FOREIGN KEY (cidade_id) REFERENCES cidades (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedidos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  solicitante_id BIGINT UNSIGNED NOT NULL,
  cidade_id BIGINT UNSIGNED NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  detalhes TEXT NULL,
  foto_url VARCHAR(500) NULL,
  status ENUM(
    'open',
    'in_evaluation',
    'completed',
    'closed_voluntary',
    'closed_no_valid',
    'closed_timeout'
  ) NOT NULL DEFAULT 'open',
  contagem_reaberturas TINYINT UNSIGNED NOT NULL DEFAULT 0,
  numero_ciclo INT NOT NULL DEFAULT 0,
  contagem_selecoes_ciclo TINYINT UNSIGNED NOT NULL DEFAULT 0,
  comparacao_aberta_em DATETIME NULL,
  indicacao_selecionada_id BIGINT UNSIGNED NULL,
  avaliacao_iniciada_em DATETIME NULL,
  avaliacao_prazo_em DATETIME NULL,
  fechado_em DATETIME NULL,
  motivo_fechamento VARCHAR(64) NULL,
  excluido_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_pedidos_cidade_status_criado (cidade_id, status, criado_em),
  KEY idx_pedidos_solicitante_criado (solicitante_id, criado_em),
  KEY idx_pedidos_status_prazo (status, avaliacao_prazo_em),
  CONSTRAINT fk_pedidos_solicitante FOREIGN KEY (solicitante_id) REFERENCES usuarios (id),
  CONSTRAINT fk_pedidos_cidade FOREIGN KEY (cidade_id) REFERENCES cidades (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indicacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido_id BIGINT UNSIGNED NOT NULL,
  indicador_id BIGINT UNSIGNED NOT NULL,
  descricao VARCHAR(500) NOT NULL,
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
  resultado ENUM('valid', 'invalid', 'not_selected') NULL,
  selecionada_em DATETIME NULL,
  avaliada_em DATETIME NULL,
  motivo_invalido_codigo ENUM(
    'incorrect_insufficient',
    'unavailable',
    'closed_nonexistent',
    'no_contact',
    'other'
  ) NULL,
  motivo_invalido_texto TEXT NULL,
  numero_ciclo INT NOT NULL DEFAULT 0,
  bloqueada_em DATETIME NULL,
  reputacao_congelada SMALLINT NULL,
  contagem_validas_congelada INT NULL,
  chave_ordenacao_comparacao INT NULL,
  excluido_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_indicacoes_pedido_indicador (pedido_id, indicador_id),
  KEY idx_indicacoes_indicador_criado (indicador_id, criado_em),
  KEY idx_indicacoes_pedido_ciclo (pedido_id, numero_ciclo),
  CONSTRAINT fk_indicacoes_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
  CONSTRAINT fk_indicacoes_indicador FOREIGN KEY (indicador_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedidos'
    AND CONSTRAINT_NAME = 'fk_pedidos_indicacao_selecionada'
);
SET @fk_sql := IF(
  @fk_exists = 0,
  'ALTER TABLE pedidos ADD CONSTRAINT fk_pedidos_indicacao_selecionada FOREIGN KEY (indicacao_selecionada_id) REFERENCES indicacoes (id)',
  'SELECT 1'
);
PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;

CREATE TABLE IF NOT EXISTS indicacao_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  indicacao_id BIGINT UNSIGNED NOT NULL,
  url TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  KEY idx_indicacao_links_indicacao (indicacao_id),
  CONSTRAINT fk_indicacao_links_indicacao FOREIGN KEY (indicacao_id) REFERENCES indicacoes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS indicacao_locais (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  indicacao_id BIGINT UNSIGNED NOT NULL,
  origem ENUM('google_maps', 'manual') NOT NULL DEFAULT 'manual',
  place_id VARCHAR(255) NULL,
  nome VARCHAR(255) NOT NULL,
  endereco TEXT NOT NULL,
  maps_url TEXT NULL,
  UNIQUE KEY uq_indicacao_locais_indicacao (indicacao_id),
  CONSTRAINT fk_indicacao_locais_indicacao FOREIGN KEY (indicacao_id) REFERENCES indicacoes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pedido_participacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  primeira_indicacao_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pedido_participacoes_pedido_usuario (pedido_id, usuario_id),
  CONSTRAINT fk_pedido_participacoes_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
  CONSTRAINT fk_pedido_participacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitante_bloqueios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  indicador_id BIGINT UNSIGNED NOT NULL,
  solicitante_id BIGINT UNSIGNED NOT NULL,
  ultima_indicacao_em DATETIME NOT NULL,
  UNIQUE KEY uq_solicitante_bloqueios_par (indicador_id, solicitante_id),
  KEY idx_solicitante_bloqueios_busca (indicador_id, solicitante_id, ultima_indicacao_em),
  CONSTRAINT fk_solicitante_bloqueios_indicador FOREIGN KEY (indicador_id) REFERENCES usuarios (id),
  CONSTRAINT fk_solicitante_bloqueios_solicitante FOREIGN KEY (solicitante_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avaliacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido_id BIGINT UNSIGNED NOT NULL,
  indicacao_id BIGINT UNSIGNED NOT NULL,
  avaliador_id BIGINT UNSIGNED NOT NULL,
  resultado ENUM('valid', 'invalid') NOT NULL,
  motivo_codigo ENUM(
    'incorrect_insufficient',
    'unavailable',
    'closed_nonexistent',
    'no_contact',
    'other'
  ) NULL,
  motivo_texto TEXT NULL,
  avaliada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_avaliacoes_pedido (pedido_id),
  KEY idx_avaliacoes_indicacao (indicacao_id),
  CONSTRAINT fk_avaliacoes_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
  CONSTRAINT fk_avaliacoes_indicacao FOREIGN KEY (indicacao_id) REFERENCES indicacoes (id),
  CONSTRAINT fk_avaliacoes_avaliador FOREIGN KEY (avaliador_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eventos_auditoria (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo_entidade VARCHAR(32) NOT NULL,
  entidade_id BIGINT UNSIGNED NOT NULL,
  status_anterior VARCHAR(64) NULL,
  status_novo VARCHAR(64) NULL,
  tipo_ator ENUM('user', 'system') NOT NULL,
  ator_id BIGINT UNSIGNED NULL,
  motivo VARCHAR(255) NULL,
  payload_json JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eventos_auditoria_entidade (tipo_entidade, entidade_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS eventos_pontuacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  pedido_id BIGINT UNSIGNED NULL,
  indicacao_id BIGINT UNSIGNED NULL,
  tipo_evento VARCHAR(64) NOT NULL,
  valor INT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eventos_pontuacao_usuario (usuario_id, criado_em),
  CONSTRAINT fk_eventos_pontuacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historico_reputacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  avaliacao_id BIGINT UNSIGNED NOT NULL,
  pedido_id BIGINT UNSIGNED NOT NULL,
  titulo_pedido_snapshot VARCHAR(200) NOT NULL,
  resultado ENUM('valid', 'invalid') NOT NULL,
  reputacao_antes SMALLINT NOT NULL,
  delta SMALLINT NOT NULL,
  reputacao_depois SMALLINT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_historico_reputacao_usuario_criado (usuario_id, criado_em),
  KEY idx_historico_reputacao_avaliacao (avaliacao_id),
  CONSTRAINT fk_historico_reputacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_historico_reputacao_avaliacao FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes (id),
  CONSTRAINT fk_historico_reputacao_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rankings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cidade_id BIGINT UNSIGNED NULL,
  modalidade ENUM('weekly', 'monthly') NOT NULL,
  periodo_inicio DATETIME NOT NULL,
  periodo_fim DATETIME NOT NULL,
  status ENUM('open', 'tallying', 'final') NOT NULL DEFAULT 'open',
  titulo VARCHAR(200) NOT NULL,
  patrocinador_empresa_id BIGINT UNSIGNED NULL,
  patrocinador_nome_exibicao VARCHAR(255) NULL,
  patrocinador_logo_url VARCHAR(500) NULL,
  patrocinador_banner_url VARCHAR(500) NULL,
  patrocinador_site_url VARCHAR(500) NULL,
  premio_posicoes_json JSON NULL,
  premio_modo_beneficio ENUM('equal', 'per_position') NULL,
  premio_beneficios_json JSON NULL,
  premio_instrucoes_resgate TEXT NULL,
  premio_prazo_resgate_dias INT UNSIGNED NULL,
  texto_regulamento TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rankings_cidade_modalidade_periodo (cidade_id, modalidade, periodo_inicio),
  KEY idx_rankings_status_janela (status, periodo_inicio, periodo_fim),
  KEY idx_rankings_modalidade_status (modalidade, status),
  CONSTRAINT fk_rankings_cidade FOREIGN KEY (cidade_id) REFERENCES cidades (id),
  CONSTRAINT fk_rankings_patrocinador FOREIGN KEY (patrocinador_empresa_id) REFERENCES empresas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitacoes_patrocinio (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  empresa_id BIGINT UNSIGNED NOT NULL,
  cidade_id BIGINT UNSIGNED NULL,
  modalidade ENUM('weekly', 'monthly') NOT NULL,
  periodo_inicio DATETIME NOT NULL,
  periodo_fim DATETIME NOT NULL,
  nome_exibicao VARCHAR(255) NOT NULL,
  logo_url VARCHAR(500) NULL,
  banner_url VARCHAR(500) NULL,
  site_url VARCHAR(500) NULL,
  texto_regulamento TEXT NOT NULL,
  premio_posicoes_json JSON NOT NULL,
  premio_modo_beneficio ENUM('equal', 'per_position') NOT NULL DEFAULT 'equal',
  premio_beneficios_json JSON NOT NULL,
  premio_instrucoes_resgate TEXT NOT NULL,
  prazo_resgate_dias INT UNSIGNED NOT NULL DEFAULT 30,
  status ENUM(
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'awaiting_correction'
  ) NOT NULL DEFAULT 'submitted',
  ranking_id BIGINT UNSIGNED NULL,
  nota_revisao VARCHAR(500) NULL,
  revisado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_solicitacoes_patrocinio_empresa (empresa_id, criado_em),
  KEY idx_solicitacoes_patrocinio_slot (cidade_id, modalidade, periodo_inicio, status),
  KEY idx_solicitacoes_patrocinio_ranking (ranking_id),
  CONSTRAINT fk_solicitacoes_patrocinio_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT fk_solicitacoes_patrocinio_cidade FOREIGN KEY (cidade_id) REFERENCES cidades (id),
  CONSTRAINT fk_solicitacoes_patrocinio_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_participacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ranking_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  inscrito_em DATETIME NOT NULL,
  saldo INT NOT NULL DEFAULT 0,
  contagem_validas_periodo INT NOT NULL DEFAULT 0,
  reputacao_congelada SMALLINT NULL,
  contagem_visitas_compartilhamento_congelada INT NULL,
  posicao_final INT NULL,
  status ENUM('active', 'frozen', 'final') NOT NULL DEFAULT 'active',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ranking_participacoes_usuario (ranking_id, usuario_id),
  KEY idx_ranking_participacoes_usuario (usuario_id, ranking_id),
  CONSTRAINT fk_ranking_participacoes_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_ranking_participacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT chk_ranking_participacoes_saldo_nao_neg CHECK (saldo >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visitas_compartilhamento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dono_usuario_id BIGINT UNSIGNED NOT NULL,
  visitante_usuario_id BIGINT UNSIGNED NULL,
  chave_visitante VARCHAR(64) NOT NULL,
  primeiro_acesso_em DATETIME NOT NULL,
  ultimo_acesso_em DATETIME NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_visitas_compartilhamento_dono_visitante (dono_usuario_id, chave_visitante),
  KEY idx_visitas_compartilhamento_dono (dono_usuario_id),
  KEY idx_visitas_compartilhamento_visitante (visitante_usuario_id),
  CONSTRAINT fk_visitas_compartilhamento_dono FOREIGN KEY (dono_usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_visitas_compartilhamento_visitante FOREIGN KEY (visitante_usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ranking_premios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ranking_id BIGINT UNSIGNED NOT NULL,
  empresa_id BIGINT UNSIGNED NOT NULL,
  usuario_id BIGINT UNSIGNED NOT NULL,
  participacao_id BIGINT UNSIGNED NOT NULL,
  posicao_final INT NOT NULL,
  texto_beneficio VARCHAR(500) NOT NULL,
  status ENUM('pending', 'redeemed', 'expired') NOT NULL DEFAULT 'pending',
  expira_em DATETIME NOT NULL,
  resgatado_em DATETIME NULL,
  lembretes_parados_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ranking_premios_ranking_usuario (ranking_id, usuario_id),
  KEY idx_ranking_premios_empresa_status (empresa_id, status),
  KEY idx_ranking_premios_usuario (usuario_id),
  KEY idx_ranking_premios_expira (status, expira_em),
  CONSTRAINT fk_ranking_premios_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_ranking_premios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas (id),
  CONSTRAINT fk_ranking_premios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_ranking_premios_participacao FOREIGN KEY (participacao_id) REFERENCES ranking_participacoes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_pontuacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  ranking_id BIGINT UNSIGNED NOT NULL,
  participacao_id BIGINT UNSIGNED NOT NULL,
  tipo_evento VARCHAR(64) NOT NULL,
  codigo_motivo VARCHAR(64) NULL,
  chave_regra VARCHAR(64) NOT NULL,
  delta INT NOT NULL,
  saldo_depois INT NOT NULL,
  avaliacao_id BIGINT UNSIGNED NULL,
  pedido_id BIGINT UNSIGNED NULL,
  indicacao_id BIGINT UNSIGNED NULL,
  chave_idempotencia VARCHAR(120) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ledger_pontuacao_idempotencia (chave_idempotencia),
  KEY idx_ledger_pontuacao_usuario_ranking (usuario_id, ranking_id, criado_em),
  KEY idx_ledger_pontuacao_ranking (ranking_id, criado_em),
  KEY idx_ledger_pontuacao_avaliacao (avaliacao_id),
  CONSTRAINT fk_ledger_pontuacao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_ledger_pontuacao_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_ledger_pontuacao_participacao FOREIGN KEY (participacao_id) REFERENCES ranking_participacoes (id),
  CONSTRAINT fk_ledger_pontuacao_avaliacao FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes (id),
  CONSTRAINT chk_ledger_pontuacao_saldo_nao_neg CHECK (saldo_depois >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificacoes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  categoria ENUM('indications', 'rankings', 'scoring') NOT NULL,
  evento VARCHAR(64) NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  corpo TEXT NOT NULL,
  deeplink VARCHAR(500) NOT NULL,
  pedido_id BIGINT UNSIGNED NULL,
  indicacao_id BIGINT UNSIGNED NULL,
  ranking_id BIGINT UNSIGNED NULL,
  avaliacao_id BIGINT UNSIGNED NULL,
  lida_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  chave_idempotencia VARCHAR(160) NULL,
  UNIQUE KEY uq_notificacoes_idempotencia (chave_idempotencia),
  KEY idx_notificacoes_usuario_criado (usuario_id, criado_em),
  KEY idx_notificacoes_usuario_nao_lida (usuario_id, lida_em, criado_em),
  KEY idx_notificacoes_usuario_categoria (usuario_id, categoria, lida_em),
  KEY idx_notificacoes_pedido_evento (pedido_id, evento, lida_em),
  CONSTRAINT fk_notificacoes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
  CONSTRAINT fk_notificacoes_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos (id),
  CONSTRAINT fk_notificacoes_indicacao FOREIGN KEY (indicacao_id) REFERENCES indicacoes (id),
  CONSTRAINT fk_notificacoes_ranking FOREIGN KEY (ranking_id) REFERENCES rankings (id),
  CONSTRAINT fk_notificacoes_avaliacao FOREIGN KEY (avaliacao_id) REFERENCES avaliacoes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS exclusoes_conta (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  nome_usuario_anterior VARCHAR(40) NOT NULL,
  email_anterior VARCHAR(255) NOT NULL,
  metodo_reautenticacao ENUM('password', 'google') NOT NULL,
  contagem_pedidos_fechados INT NOT NULL DEFAULT 0,
  contagem_rankings_congelados INT NOT NULL DEFAULT 0,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exclusoes_conta_usuario (usuario_id),
  KEY idx_exclusoes_conta_criado (criado_em),
  CONSTRAINT fk_exclusoes_conta_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
