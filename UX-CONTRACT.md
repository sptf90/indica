# Pedidos e indicações: canais de contato

Este contrato documenta o fluxo de contato alterado nesta versão. A identidade visual e os tokens continuam em DESIGN.md e app/globals.css.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | components/ContactModePicker.js e components/IndicationContactFields.js | lib/indication-contact.js e serviços do servidor | Pedido: Maps, WhatsApp ou ambos; indicação antiga: formato livre | scripts/smoke-contact-scoring.mjs e verificação no navegador |
| Seleção no mapa | components/LocationPicker.js e components/MapLocationPicker.js | Leaflet/OpenStreetMap e validação por coordenadas em lib/map-selection.js | Clique ou confirmação do ponto central | Teclado, mobile e prévia |
| CRUD | lib/requests-service.js e lib/indications-service.js | Estado persistido e autorização no servidor | Pedido editável antes da primeira participação; indicação editável antes da comparação | scripts/smoke-contact-scoring.mjs |

Novos pedidos exigem a escolha explícita de um canal; a prévia preserva essa escolha. Localização exige confirmar um estabelecimento encontrado na busca ou preencher nome e endereço manualmente e confirmar um ponto no mapa. WhatsApp exige um número válido com DDD, ou + e DDI para outro país. Ambos exige todos esses dados. Links adicionais não substituem os campos. Sem configuração Google, o mapa usa Leaflet/OpenStreetMap para marcação manual. A busca por nome usa Places API (New) no servidor e exibe seus resultados somente no Google Maps. Uma falha no mapa apresenta feedback e permite nova tentativa, mantendo os textos preenchidos.

Números brasileiros são persistidos com DDI 55 e sem formatação. Localizações manuais usam identidade por coordenadas, com nome/endereço declarados pela pessoa e validação local. Na seleção Places (`google_places`), o servidor resolve novamente o Place ID: nome, endereço e coordenadas canônicos substituem o conteúdo enviado pelo cliente. IDs em seleções manuais são descartados. A latitude e longitude são validadas e persistidas como DECIMAL com sete casas. Edição e criação usam as mesmas regras.

Somente após uma avaliação válida, outras indicações ainda não avaliadas, não excluídas e do mesmo ciclo são consideradas válidas se coincidirem diretamente com o local ou WhatsApp da escolhida. No canal ambos basta a coincidência de um desses identificadores. A equivalência não se propaga por uma terceira indicação. Cada indicação equivalente recebe avaliação, reputação e pontuação pelas mesmas regras da escolhida, inclusive elegibilidade de ranking. A data de seleção da escolhida determina o prazo do ranking para todas as equivalentes. Avaliação inválida não se propaga.

A operação ocorre em uma transação, com pedido bloqueado e pontuação idempotente por avaliação e ranking. As equivalentes preservam selecionada_em nulo, para a interface distinguir “escolhida” de “também válida”. Cada indicador recebe notificação e histórico próprios. Outras identidades e contatos continuam ocultos após a seleção, conforme o comportamento existente da comparação.

Pedidos anteriores à migração mantêm canal nulo e o formato livre; ao editar um pedido sem participações é necessário escolher um dos novos canais. Não há reprocessamento de pontos antigos.


## Seleção no mapa e navegação

`components/LocationPicker.js` combina nome/endereço editáveis e `MapLocationPicker`. O provedor é carregado somente ao abrir o mapa. A pessoa pode clicar num ponto ou mover o mapa com o teclado e usar o ponto central. “Usar esta localização” confirma o ponto; cancelar mantém a localização anterior e os textos preenchidos. O mapa inicia no ponto salvo, quando existente; em novas indicações, aproxima a cidade e UF do pedido (zoom 13), sem selecionar automaticamente um estabelecimento. “Usar minha localização” aproxima o mapa somente após a solicitação explícita e a permissão do navegador; negar a permissão mantém o posicionamento manual disponível. O centro da cidade vem da base local em `data/br-city-centers.json`, consultada somente no servidor pelo endpoint autenticado `map-config`. Municípios homônimos são diferenciados pela UF. Se uma cidade informada não for encontrada, o mapa apresenta um erro e permite tentar novamente; a visão do Brasil fica reservada aos fluxos sem cidade informada. Não há chamada externa de geocodificação.

Os pontos preservam o clique com sete casas decimais. Para pontuação, locais sem Place ID usam latitude/longitude arredondadas a cinco casas (aproximadamente um metro), comparadas diretamente à escolhida. Place IDs legados diferentes nunca são unificados apenas por coordenadas. Registros antigos não são apagados e não há reprocessamento de pontuação. Ao confirmar novamente um estabelecimento Google sem alterações, o servidor preserva e valida seu Place ID. Editar nome/endereço ou marcar outro ponto muda a origem para manual e remove o ID.

`components/PlaceNavigationLinks.js` gera os botões Google Maps e Waze a partir de `lib/location.js`, usando as mesmas coordenadas persistidas. As URLs HTTPS oficiais abrem no aplicativo ou na web conforme o sistema operacional. Registros antigos sem coordenadas mantêm apenas o link Google Maps existente, sem inventar destino Waze. Contatos e coordenadas seguem as regras existentes de visibilidade na comparação.

O mapa utiliza atribuição OpenStreetMap visível, cache HTTP padrão e carregamento da área visível, sem pré-busca ou download em massa. `.env.example` documenta os opcionais `MAP_TILE_URL` e `MAP_TILE_ATTRIBUTION`. O endpoint autenticado `map-config` permite trocar o provedor por configuração, sem expor chaves. O fluxo não exige configurar essas variáveis: o padrão é OpenStreetMap. O endpoint de busca Places é reutilizado pelo cadastro/edição quando a integração Google está configurada. O modo manual não chama Places.

Verificação: `npm run test:maps`, `scripts/smoke-contact-scoring.mjs` e navegação real com Leaflet em mobile/desktop.

Referências: [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html), [política de mapas OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), [URLs Google Maps](https://developers.google.com/maps/documentation/urls/get-started) e [links Waze](https://developers.google.com/waze/deeplinks).

## Limites da janela e telas pequenas

`ViewportPopover` é o componente canônico para as listas de estado/cidade. Usa portal no body, acompanha rolagem e viewport visual (incluindo teclado virtual), inverte a abertura quando falta espaço abaixo e limita altura e largura, com rolagem interna. Opções ativas via teclado permanecem visíveis.

Menus de conta e cartões do tutorial têm altura limitada à janela e rolagem interna. O menu lateral usa altura dinâmica, navegação rolável e botão de fechar interno em mobile. Textos livres podem quebrar palavras longas; cartões de perfil e resgates e campos de formulário podem encolher sem forçar largura mínima. O cabeçalho público permite quebra de linha.

Verificação reproduzível: `npm run test:responsive` com a aplicação de produção em `http://localhost:3001` (ou `BASE_URL`). As APIs são simuladas com conteúdo longo e perfis de visitante, usuário, empresa e administrador. O teste percorre todas as rotas de página e interações adicionais em seis resoluções, gera relatório e capturas em `/tmp/indica-responsive`. A integração real de coordenadas e regras de pontuação é verificada separadamente por `scripts/smoke-contact-scoring.mjs`.

## Busca de estabelecimentos

`MapPlaceSearch` é o proprietário da busca dentro de `MapLocationPicker`. A pesquisa ocorre por botão ou Enter, com cidade/UF do pedido e viés pelo centro municipal. Editar o termo cancela a requisição anterior, limpa resultados e marcadores; respostas canceladas não substituem a pesquisa atual. A lista e os marcadores numerados selecionam o mesmo candidato. Confirmar preenche nome, endereço e coordenadas juntos; cancelar preserva o local confirmado anteriormente.

`lib/client-map.js` fornece os adaptadores Google Maps e Leaflet. Google Places nunca é plotado sobre OpenStreetMap. `GOOGLE_PLACES_API_KEY` é exclusiva do servidor; somente `GOOGLE_MAPS_BROWSER_API_KEY`, explicitamente destinada ao navegador, é retornada pelo endpoint autenticado `map-config`. `GOOGLE_MAPS_MAP_ID` configura marcadores avançados. Geocoding API não é necessária. Falhas do Google apresentam tentativa novamente e alternativa de mapa manual. A busca vazia/indisponível permite marcação manual sem bloquear o formulário.

`lib/map-selection.js` valida seleções manuais localmente e resolve estabelecimentos Google via `getPlaceById`. Os campos persistidos existentes armazenam origem, Place ID, nome, endereço e coordenadas; não houve alteração de esquema nem das regras de pontuação. `npm run test:map-search` usa um servidor isolado e Google simulado, com banco real e limpeza de suas próprias fixtures; verifica lista/marcador, cancelamento de busca, prévia, gravação, detalhes e edição.

## Navegação completa do administrador

`AppShell` mantém os grupos Admin, Usuário e Empresa no modo de gestão, incluindo os destinos principais e atalhos para reputação, benefícios e missões. Telas de detalhes/edição continuam ligadas aos seus respectivos registros. O admin pode abrir a home de usuário e a área empresarial sem mudar o cookie de visualização. O contexto empresarial reutiliza a empresa própria de prévia do admin, preservando os filtros de propriedade. Usuários comuns não ganham essa permissão.

Os botões de prévia continuam em `/admin`: como usuário, a sidebar apresenta somente os links de usuário; como empresa, somente os links empresariais. O botão de voltar restaura a navegação completa. `npm run test:admin-navigation` verifica as permissões reais e ambos os fluxos no navegador, em desktop e mobile.

## Gestão administrativa

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | AdminRecordEditor e IbgeCityPicker | validateProfilePatch e updateAdminRecord | Cadastro pessoal ou empresarial, justificativa obrigatória | test:admin-console e test:responsive |
| Select/Listbox | Select nativo em AdminRecords; IbgeCityPicker para municípios | admin-catalog e endpoints IBGE existentes | Situação nativa; cidade/UF com sugestões | test:responsive e test:admin-console |
| Date | Inputs date nativos em AdminRecords e adminDate | Períodos de criação e fuso America/Sao_Paulo | Início/fim opcionais, intervalo inclusivo | test:admin-console |
| Scrollbar | admin-table-scroll e sidebar existentes | CSS compartilhado e limites do viewport | Tabela com rolagem interna, página vertical | test:responsive |
| Toast | AdminFeedback e feedback inline em AdminRecord | Resposta da API e estado local | Carregamento, erro, sucesso e conflito persistentes | test:admin-console |
| CRUD | lib/admin-service.js e lib/admin-auth.js | Banco e permissões revalidadas na transação | Consulta dos módulos, edição de usuários/empresas ativas | test:admin-console |

`lib/admin-catalog.js` define os onze módulos de consulta. `lib/admin-service.js` é a autoridade para filtros, detalhes, edição e auditoria; `lib/admin-auth.js` exige um administrador ativo no modo de gestão em todos os novos endpoints. Prévia de usuário/empresa não acessa os dados administrativos. Contadores e atividade recente vêm do banco; os indicadores de integração informam configuração, sem prometer disponibilidade externa.

`AdminRecords` mantém busca, situação, período, página e contexto relacionado na URL. O servidor aceita somente filtros e módulos conhecidos, usa parâmetros SQL e retorna até 25 registros por página. Datas são apresentadas e filtradas pelo calendário de Brasília. `AdminRecord` oferece os vínculos entre usuários, pedidos, indicações, avaliações, pontos e resgates. A localização de uma indicação usa as coordenadas persistidas para abrir Google Maps/Waze.

`AdminRecordEditor` edita dados cadastrais de usuários e empresas ativas. Mudanças de acesso administrativo exigem confirmação explícita no formulário; toda gravação exige justificativa e revisão atual do cadastro. Erros preservam os dados digitados; conflito oferece recarregar. O servidor revalida o ator sob bloqueio na transação, impede remover o próprio acesso, conceder acesso administrativo a empresas ou deixar o sistema sem administrador ativo. Alterações concorrentes não sobrescrevem silenciosamente os dados. A auditoria registra ator, cadastro, campos alterados e justificativa na mesma transação. Senhas e segredos não são retornados pelas consultas.

Patrocínios e rankings continuam nos fluxos existentes. Pedidos, indicações, avaliações, pontos, reputação, resgates, notificações e auditoria são consultados pelos novos módulos; suas regras de negócio não são substituídas por edição livre. Detalhes de escopo e validação em `docs/administracao.md`.
