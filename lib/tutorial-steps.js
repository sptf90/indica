/**
 * Passos do product tour GoIndica (proposta → comunidade → reputação → prêmios).
 * Targets: data-tour="<id>" na UI real. Sem target = card centrado.
 */

export const TUTORIAL_STORAGE_KEY = "goindica_tutorial_completed";
export const COMPANY_TUTORIAL_STORAGE_KEY = "goindica_company_tutorial_completed";
export const TUTORIAL_FORCE_EVENT = "goindica:tutorial-restart";

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   body: string,
 *   tagline?: string,
 *   target?: string | null,
 *   route?: string,
 *   openMenu?: boolean,
 *   placement?: 'auto'|'top'|'bottom'|'left'|'right'|'center',
 *   softSpotlight?: boolean,
 * }} TutorialStep
 */

/** @type {TutorialStep[]} */
export const TUTORIAL_STEPS = [
  {
    id: "proposta",
    title: "O que é o GoIndica?",
    tagline: "Você procura. Alguém indica.",
    body:
      "Sabe aquele perfume importado que você não sabe onde achar? Ou um mecânico de confiança na cidade?\n\nÉ pra isso que o GoIndica existe: você pede o que precisa, pessoas reais indicam o que conhecem, e você compara, escolhe e avalia.\n\nNão é feed, catálogo nem busca de empresas. É indicação de gente pra gente.\n\nAjude bem e a comunidade reconhece: reputação é a confiança que você constrói; rankings e prêmios celebram quem indica com qualidade — com patrocínios quando houver.",
    target: "brand-logo",
    route: "/",
    placement: "center",
    softSpotlight: true,
  },
  {
    id: "comunidade",
    title: "Comunidade de ajuda",
    body: "A função principal do GoIndica é a comunidade: você pede o que precisa na sua cidade e outras pessoas indicam o que conhecem. Não há feed nem catálogo — tudo nasce de um pedido real.",
    target: "home-hero",
    route: "/",
    placement: "bottom",
  },
  {
    id: "pedir",
    title: "Pedir uma indicação",
    body: "Comece por aqui quando não souber onde encontrar algo. Descreva o que procura, confirme a cidade e publique. A comunidade responde com indicações — sem revelar a sua identidade ao indicador.",
    target: "cta-pedir",
    route: "/",
    placement: "bottom",
  },
  {
    id: "indicar",
    title: "Fazer uma indicação",
    body: "Quando souber de um bom lugar ou serviço, ajude quem pediu. Na home, «Ajude a comunidade» lista pedidos abertos da sua cidade (dos mais antigos aos mais novos). Escolha um, descreva a indicação e envie — uma vez por pedido.",
    target: "ajude-comunidade",
    route: "/",
    placement: "top",
  },
  {
    id: "comparar",
    title: "Comparar e avaliar",
    body: "No seu pedido, abra a comparação quando quiser escolher. As indicações aparecem anónimas (reputação e válidas visíveis). Escolha uma para testar, avalie como válida ou não válida — e pode reabrir até 3 vezes se precisar.",
    target: "metric-pedidos",
    route: "/",
    placement: "bottom",
  },
  {
    id: "meus-pedidos",
    title: "Meus pedidos",
    body: "Acompanhe todos os pedidos que você criou: abertos, em avaliação ou concluídos. Daqui você abre o detalhe, compara respostas e gere o ciclo de escolha e avaliação.",
    target: "nav-meus-pedidos",
    route: "/",
    openMenu: true,
    placement: "right",
  },
  {
    id: "minhas-indicacoes",
    title: "Minhas indicações",
    body: "Veja o que você já indicou e o status de cada participação (enviada, em avaliação, concluída…). O solicitante permanece sempre oculto — a privacidade vale nos dois sentidos.",
    target: "nav-minhas-indicacoes",
    route: "/",
    openMenu: true,
    placement: "right",
  },
  {
    id: "reputacao",
    title: "Reputação = confiança",
    body: "A reputação (0–100) é a confiança da comunidade em você. Indicações válidas sobem; avaliações negativas baixam. Na home fica em destaque junto à saudação — e também no perfil.",
    target: "metric-reputacao",
    route: "/",
    placement: "left",
  },
  {
    id: "pontuacao",
    title: "Pontuação e credibilidade",
    body: "Além da reputação, a pontuação nos rankings acompanha o quanto você ajuda bem nas competições da cidade. Acumule pontos e acompanhe o saldo em Pontuação e credibilidade.",
    target: "nav-pontuacao",
    route: "/",
    openMenu: true,
    placement: "right",
  },
  {
    id: "rankings",
    title: "Rankings e prêmios",
    body: "Rankings semanais e mensais da sua cidade mostram quem está ajudando melhor. É o reconhecimento por indicar bem — e, quando houver patrocínio, posições premiadas e benefícios para resgatar no fim do período.",
    target: "nav-rankings",
    route: "/",
    openMenu: true,
    placement: "right",
  },
  {
    id: "notificacoes",
    title: "Sino de notificações",
    body: "O sino no topo avisa sobre indicações novas, prazos de avaliação, rankings e pontuação. Toque para abrir a central — as notificações não se apagam; marque como lidas quando quiser.",
    target: "notify-bell",
    route: "/",
    placement: "bottom",
  },
  {
    id: "partilha",
    title: "Link de partilha",
    body: "No perfil tem o seu link pessoal. Cada pessoa distinta que entra por ele conta para o 1.º desempate nos rankings. Partilhe com amigos da cidade — a contagem aparece aqui.",
    target: "perfil-share",
    route: "/perfil",
    placement: "bottom",
  },
  {
    id: "perfil",
    title: "Seu perfil",
    body: "Ajuste username, foto e cidade (a cidade é o padrão ao indicar). A reputação fica em destaque. Pode repetir este tutorial a qualquer momento pelo botão «Ver tutorial» neste ecrã ou no menu da conta.",
    target: "perfil-rep",
    route: "/perfil",
    placement: "bottom",
  },
];

/** Tutorial da conta empresarial — campos, banner e fluxo de patrocínio. */
/** @type {TutorialStep[]} */
export const COMPANY_TUTORIAL_STEPS = [
  {
    id: "emp-proposta",
    title: "Área da empresa",
    tagline: "Patrocinar. Premiar. Confirmar resgates.",
    body:
      "Conta empresarial não pede nem indica. O foco é solicitar patrocínio de um ranking da cidade, definir prêmios e confirmar resgates dos ganhadores.\n\nNa lista de Rankings você só vê a campanha da sua empresa — nunca Café Demo nem outros patrocinadores.",
    target: "emp-hero",
    route: "/empresa",
    placement: "bottom",
    softSpotlight: true,
  },
  {
    id: "emp-periodo",
    title: "Escolha o período",
    body: "Comece pelo tipo Semanal ou Mensal e selecione a cidade/datas disponíveis. O prazo de solicitação fecha 3 dias antes do início (23h59 UTC). Enviar a solicitação não publica o ranking automaticamente — há análise.",
    target: "emp-slot",
    route: "/empresa",
    placement: "right",
  },
  {
    id: "emp-nome",
    title: "Nome «Patrocinado por»",
    body: "Este é o nome que aparece no ranking junto ao selo de patrocínio. Pode ser a razão social ou a marca da campanha.",
    target: "emp-display-name",
    route: "/empresa",
    placement: "bottom",
  },
  {
    id: "emp-banner",
    title: "Banner obrigatório",
    body: "Carregue a arte full-bleed do ranking no tamanho canónico 1200×240 px (ratio 5:1). Texto e logo vão na própria imagem. Sem banner, o botão de envio fica bloqueado.",
    target: "emp-banner",
    route: "/empresa",
    placement: "top",
  },
  {
    id: "emp-premios",
    title: "Posições e benefícios",
    body: "Defina o Top N (até 1000), o regulamento, se o benefício é igual ou distinto por posição, as instruções de resgate e o prazo em dias. Tudo isso alimenta a campanha após aprovação.",
    target: "emp-prizes",
    route: "/empresa",
    placement: "top",
  },
  {
    id: "emp-enviar",
    title: "Enviar para análise",
    body: "Com período, nome, banner e prêmios preenchidos, envie a solicitação. Acompanhe o status em Minhas solicitações. Depois da aprovação, o ranking da sua empresa aparece em Rankings — só o seu.",
    target: "emp-submit",
    route: "/empresa",
    placement: "top",
  },
  {
    id: "emp-resgates",
    title: "Resgates da campanha",
    body: "Quando o ranking termina, os ganhadores pedem o benefício. Só a empresa confirma o resgate (Pendente → Resgatado). Prazos expirados fecham sozinhos.",
    target: "emp-rewards",
    route: "/empresa",
    placement: "left",
  },
];
