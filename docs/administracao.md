# Administração do sistema

A gestão é dividida por responsabilidade. `/admin` mostra quatro números principais, filas com itens a acompanhar e atividade recente. Os mesmos módulos não são repetidos em cartões na home. Quando as filas estão vazias, há um único estado sem pendências.

Todas as áreas permanecem na barra lateral: Admin, Usuário e Empresa. Dentro de Admin, os grupos são recolhíveis e o grupo da página atual abre automaticamente. Cada destino administrativo aparece uma única vez no menu. Os títulos dos grupos abrem/fecham as opções; os links levam às telas. As áreas de usuário e empresa continuam abertas, conforme a preferência definida para este projeto.

| Grupo | Conteúdo |
| --- | --- |
| Contas | Usuários e administradores, empresas e cidades |
| Comunidade | Pedidos, indicações e avaliações |
| Premiações | Patrocínios, rankings mensais/semanais e resgates |
| Histórico | Pontuação, reputação, notificações e auditoria |
| Sistema | Integrações e prévias de usuário/empresa |

`/admin/sistema` concentra ferramentas técnicas e prévias. As integrações informam conexão ao banco e presença das configurações, sem expor credenciais nem prometer que os serviços externos ou as rotinas estão funcionando. O botão “Voltar à gestão admin” encerra a prévia. As permissões são revalidadas no servidor e as prévias continuam sem acesso aos dados da gestão.

## Organização do código

| Responsabilidade | Arquivo |
| --- | --- |
| Metadados dos módulos e destinos administrativos | `lib/admin-catalog.js` |
| Destinos de usuário/empresa e composição dos perfis | `lib/navigation.js` |
| Menu, grupos recolhíveis e seleção da página atual | `components/SidebarNavigation.js` |
| Ícones compartilhados do menu | `components/NavIcon.js` |
| Sessão, estrutura da aplicação e cabeçalho | `components/AppShell.js` |
| Composição do dashboard | `components/AdminDashboard.js` |
| Resumo, filas e atividade recente | `components/admin/DashboardSummary.js`, `DashboardTasks.js`, `RecentActivity.js` |
| Composição da página Sistema | `components/AdminSystem.js` |
| Integrações e prévias | `components/admin/SystemStatus.js`, `ProfilePreview.js` |
| Mudança de perfil compartilhada entre prévia e cabeçalho | `lib/admin-view-client.js` |
| Consultas da visão geral e do sistema | `lib/admin-dashboard.js` |
| Consulta e edição dos registros administrativos | `lib/admin-service.js` |
| Estados, campos e estrutura das telas de registros | `components/AdminWorkspace.js` |

O endpoint `/api/admin/overview` retorna contadores, atividade recente e data da consulta. `/api/admin/system` verifica conexão e retorna somente os indicadores de integração e a data. Ambos exigem gestão administrativa e desabilitam cache compartilhado. A home não consulta configurações e a página Sistema não executa contagens do dashboard.

Os módulos oferecem busca, filtros de período e situação quando aplicável, paginação de 25 registros, detalhes e vínculos entre registros. Períodos usam o calendário de Brasília. Indicações mostram descrição, contato, estabelecimento, endereço, coordenadas e navegação.

## Edição e permissões

Nos detalhes de um usuário ativo, use **Editar cadastro** para alterar nome de usuário, e-mail, foto e cidade. Contas pessoais podem receber ou perder acesso administrativo, com confirmação explícita. Nos detalhes de empresas, é possível editar razão social, logo e cidade; o responsável permanece vinculado à conta original.

Cada gravação exige justificativa. A auditoria registra responsável, campos alterados e motivo. Cadastros excluídos são somente consultados. A própria permissão administrativa não pode ser removida; o servidor preserva ao menos um administrador ativo e revalida permissões dentro da transação. Revisões impedem sobrescrever uma alteração concorrente.

Pedidos, indicações, avaliações, pontos, reputação, resgates, notificações e auditoria são de consulta. Patrocínios e rankings mantêm suas telas e validações. A reorganização não altera regras de negócio nem exige migração de banco.

## Verificação

- `npm run test:admin-dashboard`: APIs simuladas, sem gravar no banco. Cobre hierarquia, ausência de destinos duplicados, teclado, seleção ativa, Sistema, prévia e retorno, erro, nova tentativa, acesso negado e carregamento em seis resoluções entre 320 e 1440 px, incluindo paisagem. Capturas em `/tmp/indica-admin-dashboard`.
- `npm run test:admin-navigation`: acesso completo e isolamento das prévias, com banco e navegador. As prévias são abertas na página Sistema.
- `npm run test:admin-console`: permissões dos dois endpoints, consultas/edição dos módulos, filtros, paginação, conflitos, concorrência, auditoria e formulários. Usa banco real com fixtures próprias e limpeza.
- `npm run test:responsive`: conteúdo extenso e rotas de todos os perfis em seis resoluções, incluindo Sistema. Tabelas usam rolagem interna em telas pequenas.
- `npm run build`: compilação e validação das rotas.
