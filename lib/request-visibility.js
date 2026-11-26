// Both predicates use the pedidos alias r. Bind the viewer ID for the second.
export const REQUEST_ACCEPTS_RESPONSES_SQL = `
  r.status = 'open' AND r.comparacao_aberta_em IS NULL
  AND (r.indicacao_prazo_em IS NULL OR r.indicacao_prazo_em > UTC_TIMESTAMP())
`;

export const REQUEST_VIEWER_INDICATED_SQL = `EXISTS (
  SELECT 1 FROM indicacoes AS viewer_indication
  WHERE viewer_indication.pedido_id = r.id AND viewer_indication.indicador_id = ?
    AND viewer_indication.excluido_em IS NULL
)`;
