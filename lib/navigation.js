import { ADMIN_NAVIGATION } from "./admin-catalog";

export const NAV_USER = [
  { href: "/", label: "Início", icon: "home", exact: true, tourId: "nav-inicio" },
  { href: "/pedir", label: "Pedir uma indicação", icon: "ask", exact: true, tourId: "nav-pedir" },
  { href: "/indicar", label: "Fazer uma indicação", icon: "give", tourId: "nav-indicar" },
  { href: "/pedir/meus", label: "Meus pedidos", icon: "orders", tourId: "nav-meus-pedidos" },
  { href: "/minhas-indicacoes", label: "Minhas indicações", icon: "sent", tourId: "nav-minhas-indicacoes" },
  { href: "/pontuacao", label: "Pontuação e credibilidade", icon: "score", tourId: "nav-pontuacao" },
  { href: "/rankings", label: "Rankings", icon: "rank", tourId: "nav-rankings" },
  { href: "/perfil", label: "Meu perfil", icon: "user", tourId: "nav-perfil" },
];

/** RF-EMP-05 / RF-SPON-10: empresa não pede/indica — só gestão. */
export const NAV_COMPANY = [
  {
    href: "/empresa",
    label: "Patrocínio",
    icon: "gift",
    exact: true,
    tourId: "nav-empresa",
  },
  {
    href: "/empresa/resgates",
    label: "Resgates",
    icon: "check",
    exact: true,
    tourId: "nav-empresa-resgates",
  },
  {
    href: "/rankings",
    label: "Seu ranking",
    icon: "rank",
    tourId: "nav-rankings-empresa",
  },
];

export function isNavigationActive(pathname, item) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function navigationGroups({ isAdmin, isCompany }) {
  if (!isAdmin) return [{ id: "primary", items: isCompany ? NAV_COMPANY : NAV_USER }];
  return [
    { id: "admin", label: "Admin", items: ADMIN_NAVIGATION },
    { id: "user", label: "Usuário", items: [
      ...NAV_USER.map(item => item.href === "/perfil" ? {
        ...item, children: [{ href: "/perfil/reputacao", label: "Histórico de reputação" }],
      } : item),
      { href: "/beneficios", label: "Benefícios e cupons", icon: "gift" },
      { href: "/missoes", label: "Missões", icon: "mission" },
    ] },
    { id: "company", label: "Empresa", items: NAV_COMPANY },
  ];
}
