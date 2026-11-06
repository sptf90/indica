# Administração do sistema

Acesse `/admin` no modo de gestão. A visão geral reúne contadores reais, pendências, atividade recente, configuração das integrações e acesso aos módulos. A sidebar mantém também as áreas de usuário/empresa e os botões de prévia continuam disponíveis.

| Área | Conteúdo |
| --- | --- |
| Contas | Usuários, administradores, empresas e cidades |
| Comunidade | Pedidos, indicações e avaliações |
| Premiações | Patrocínios, rankings mensais/semanais e resgates |
| Operação | Extrato de pontos, histórico de reputação, notificações e auditoria |

Os onze novos módulos oferecem busca, filtros de período e situação quando aplicável, paginação de 25 registros, detalhes e links para registros relacionados. Períodos usam o calendário de Brasília. Indicações mostram descrição, contato, estabelecimento, endereço, coordenadas e navegação pelo Google Maps/Waze.

## Edição e permissões

Nos detalhes de um usuário ativo, use **Editar cadastro** para alterar nome de usuário, e-mail, foto e cidade. Contas pessoais podem receber ou perder acesso administrativo, com confirmação explícita. Contas empresariais preservam o perfil empresarial. Nos detalhes de empresas, é possível editar razão social, logo e cidade; o responsável permanece vinculado à conta original.

Cada gravação exige justificativa. O histórico registra administrador responsável, campos alterados e motivo. Cadastros excluídos são somente consultados. A própria permissão administrativa não pode ser removida; o servidor preserva ao menos um administrador ativo e revalida permissões dentro da transação. Revisões impedem sobrescrever uma alteração concorrente; recarregue o cadastro em caso de conflito.

Os novos módulos de pedidos, indicações, avaliações, pontos, reputação, resgates, notificações e auditoria são de consulta. Alterações de patrocínios e rankings continuam nas telas existentes, com suas validações. Não há alteração manual de pontuação, reputação ou senha, nem exclusão de contas por esses formulários.

## Verificação

- `npm run build`: compilação e validação das rotas.
- `npm run test:admin-console`: banco real com dados temporários próprios, permissões, listagens/detalhes dos onze módulos, filtros, paginação, edição, conflitos, concorrência, auditoria e formulários no navegador em 320 e 1440 px. Limpa os próprios dados ao terminar.
- `npm run test:admin-navigation`: acesso completo e isolamento das prévias de usuário/empresa, com banco e navegador.
- `npm run test:responsive`: APIs simuladas, textos longos, 57 cenários em seis resoluções, incluindo todas as novas listagens, detalhes e edição de usuário. Tabelas usam rolagem interna em telas pequenas. Relatório/capturas em `/tmp/indica-responsive`.

Os testes do console salvam capturas em `/tmp/indica-admin-console`. As credenciais locais permanecem no ambiente; os endpoints novos não retornam senhas, hashes ou chaves de integração. Não é necessária migração de banco para estes módulos.

Na validação desta entrega, o console passou em 112 verificações de API e nos dois tamanhos de navegador. A navegação completa e as prévias também passaram. A varredura de responsividade executou 640 verificações em 57 cenários e seis resoluções, sem falhas ou erros de navegador. Foram exercitados separadamente os estados de erro, nova tentativa, vazio, acesso negado e retorno de foco após cancelar a edição.

O ESLint dos arquivos novos passou. O lint global mantém os 25 erros e três avisos preexistentes em outros componentes. A auditoria estática auxiliar da skill de interface excedeu o limite de 20 segundos sem emitir relatório; ela não foi considerada aprovada. A compilação e os testes próprios do projeto são a evidência executada para esta alteração.
