export const BRAND = {
  orange: "#F05A28",
  cream: "#FDF9F6",
};

export const SESSION_COOKIE = "indica_session";
/** Modo de visualização do admin: admin | user | company */
export const ADMIN_VIEW_COOKIE = "indica_admin_view";
export const SESSION_DAYS = 14;
export const COOLDOWN_HOURS = 24;
export const MAX_REOPENS = 3;
export const MAX_DESCRIPTION = 500;
export const MAX_TITLE = 200;

export const FIRST_SELECTION_HOURS = 36;
export const NEXT_SELECTION_HOURS = 24;

export const INVALID_REASONS = [
  {
    code: "incorrect_insufficient",
    label: "Informação incorreta ou insuficiente",
  },
  {
    code: "unavailable",
    label: "Produto ou serviço indisponível",
  },
  {
    code: "closed_nonexistent",
    label: "Estabelecimento fechado ou inexistente",
  },
  {
    code: "no_contact",
    label: "Não foi possível entrar em contato",
  },
  {
    code: "other",
    label: "Outro motivo",
  },
];

export const REQUEST_STATUS_LABELS = {
  open: "Aberto",
  in_evaluation: "Em avaliação",
  completed: "Concluído",
  closed_voluntary: "Encerrado sem solução",
  closed_no_valid: "Encerrado - nenhuma indicação válida",
  closed_timeout: "Encerrado por falta de avaliação",
};

export const INDICATION_UI_STATUS = {
  sent: "Enviada",
  in_evaluation: "Em avaliação",
  selected: "Em avaliação",
  valid: "Escolhida",
  invalid: "Não válida",
  not_selected: "Não escolhida",
  closed_timeout: "Encerrado por falta de avaliação",
  closed_no_valid: "Encerrado - nenhuma indicação válida",
};

export const MSG = {
  emptyList: "Não há pedidos disponíveis no momento.",
  inEvaluation:
    "Este pedido está em avaliação e não aceita novas indicações.",
  indicationOk: "Indicação enviada com sucesso",
  timeout: "Encerrado por falta de avaliação",
  noValid: "Encerrado - nenhuma indicação válida",
  voluntaryClose: "Encerrado sem solução",
  noEvals: "Reputação 0/100 - Sem avaliações",
  cooldown:
    "Você já enviou uma indicação para este solicitante nas últimas 24 horas. Tente novamente após esse período.",
  tallying: "Em apuração - classificação ainda não é final",
  sponsoredBy: "Patrocinado por",
  userDeleted: "Usuário excluído",
};
