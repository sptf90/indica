/**
 * Normaliza linhas MySQL (colunas em português) para as chaves
 * históricas em inglês usadas pelo restante do app.
 */

const MAP = {
  nome_usuario: "username",
  senha_hash: "password_hash",
  tipo_conta: "account_type",
  eh_admin: "is_admin",
  foto_url: "photo_url",
  cidade_id: "city_id",
  reputacao: "reputation",
  contagem_indicacoes_validas: "valid_indication_count",
  contagem_selecionadas_avaliadas: "selected_and_evaluated_count",
  codigo_compartilhamento: "share_code",
  contagem_visitas_compartilhamento: "share_visit_count",
  tutorial_concluido_em: "tutorial_completed_at",
  criado_em: "created_at",
  atualizado_em: "updated_at",
  excluido_em: "deleted_at",
  razao_social: "legal_name",
  usuario_id: "user_id",
  solicitante_id: "requester_id",
  titulo: "title",
  detalhes: "details",
  contagem_reaberturas: "reopen_count",
  numero_ciclo: "cycle_number",
  contagem_selecoes_ciclo: "selection_count_in_cycle",
  comparacao_aberta_em: "comparison_opened_at",
  indicacao_selecionada_id: "selected_indication_id",
  avaliacao_iniciada_em: "evaluation_started_at",
  avaliacao_prazo_em: "evaluation_deadline_at",
  fechado_em: "closed_at",
  motivo_fechamento: "close_reason",
  pedido_id: "request_id",
  indicador_id: "recommender_id",
  descricao: "description",
  resultado: "result",
  selecionada_em: "selected_at",
  avaliada_em: "evaluated_at",
  motivo_invalido_codigo: "invalid_reason_code",
  motivo_invalido_texto: "invalid_reason_text",
  bloqueada_em: "locked_at",
  reputacao_congelada: "frozen_reputation",
  contagem_validas_congelada: "frozen_valid_count",
  chave_ordenacao_comparacao: "comparison_sort_key",
  indicacao_id: "indication_id",
  ordem: "sort_order",
  origem: "source",
  nome: "name",
  endereco: "address",
  primeira_indicacao_em: "first_indicated_at",
  ultima_indicacao_em: "last_indication_at",
  avaliador_id: "evaluator_id",
  motivo_codigo: "reason_code",
  motivo_texto: "reason_text",
  tipo_entidade: "entity_type",
  entidade_id: "entity_id",
  status_anterior: "from_status",
  status_novo: "to_status",
  tipo_ator: "actor_type",
  ator_id: "actor_id",
  motivo: "reason",
  tipo_evento: "event_type",
  valor: "value",
  avaliacao_id: "evaluation_id",
  titulo_pedido_snapshot: "request_title_snapshot",
  reputacao_antes: "reputation_before",
  reputacao_depois: "reputation_after",
  modalidade: "modality",
  periodo_inicio: "period_start",
  periodo_fim: "period_end",
  patrocinador_empresa_id: "sponsor_company_id",
  patrocinador_nome_exibicao: "sponsor_display_name",
  patrocinador_logo_url: "sponsor_logo_url",
  patrocinador_banner_url: "sponsor_banner_url",
  patrocinador_site_url: "sponsor_site_url",
  premio_posicoes_json: "prize_positions_json",
  premio_modo_beneficio: "prize_benefit_mode",
  premio_beneficios_json: "prize_benefits_json",
  premio_instrucoes_resgate: "prize_redemption_instructions",
  premio_prazo_resgate_dias: "prize_redemption_deadline_days",
  texto_regulamento: "regulation_text",
  empresa_id: "company_id",
  nome_exibicao: "display_name",
  prazo_resgate_dias: "redemption_deadline_days",
  nota_revisao: "review_note",
  revisado_em: "reviewed_at",
  inscrito_em: "enrolled_at",
  saldo: "balance",
  contagem_validas_periodo: "valid_count_in_period",
  contagem_visitas_compartilhamento_congelada: "frozen_share_visit_count",
  posicao_final: "final_position",
  dono_usuario_id: "owner_user_id",
  visitante_usuario_id: "visitor_user_id",
  chave_visitante: "visitor_key",
  primeiro_acesso_em: "first_seen_at",
  ultimo_acesso_em: "last_seen_at",
  participacao_id: "participation_id",
  texto_beneficio: "benefit_text",
  expira_em: "expires_at",
  resgatado_em: "redeemed_at",
  lembretes_parados_em: "reminders_stopped_at",
  codigo_motivo: "reason_code",
  chave_regra: "rule_key",
  saldo_depois: "balance_after",
  chave_idempotencia: "idempotency_key",
  categoria: "category",
  evento: "event",
  corpo: "body",
  lida_em: "read_at",
  nome_usuario_anterior: "previous_username",
  email_anterior: "previous_email",
  metodo_reautenticacao: "reauth_method",
  contagem_pedidos_fechados: "closed_requests_count",
  contagem_rankings_congelados: "frozen_rankings_count",
  estado: "state",
};

export function mapRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const [pt, en] of Object.entries(MAP)) {
    if (Object.prototype.hasOwnProperty.call(row, pt)) {
      if (out[en] === undefined) out[en] = row[pt];
    }
  }
  // avaliacoes.resultado / indicacoes.resultado
  if (Object.prototype.hasOwnProperty.call(row, "resultado")) {
    if (out.result === undefined) out.result = row.resultado;
    if (out.outcome === undefined) out.outcome = row.resultado;
  }
  // Aliases comuns de JOIN
  if (row.cidade_nome != null && out.city_name === undefined) {
    out.city_name = row.cidade_nome;
  }
  if (row.cidade_estado != null && out.city_state === undefined) {
    out.city_state = row.cidade_estado;
  }
  return out;
}

export function mapRows(rows) {
  return (rows || []).map(mapRow);
}
