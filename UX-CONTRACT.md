# Pedidos e indicações: canais de contato

Este contrato documenta o fluxo de contato alterado nesta versão. A identidade visual e os tokens continuam em DESIGN.md e app/globals.css.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Form | components/ContactModePicker.js e components/IndicationContactFields.js | lib/indication-contact.js e serviços do servidor | Pedido: Maps, WhatsApp ou ambos; indicação antiga: formato livre | scripts/smoke-contact-scoring.mjs e verificação no navegador |
| Seleção no mapa | components/LocationPicker.js e components/MapLocationPicker.js | Leaflet/OpenStreetMap e validação por coordenadas em lib/map-selection.js | Clique ou confirmação do ponto central | Teclado, mobile e prévia |
| CRUD | lib/requests-service.js e lib/indications-service.js | Estado persistido e autorização no servidor | Pedido editável antes da primeira participação; indicação editável antes da comparação | scripts/smoke-contact-scoring.mjs |

Novos pedidos exigem a escolha explícita de um canal; a prévia preserva essa escolha. Localização exige preencher nome e endereço manualmente e confirmar um ponto no mapa. WhatsApp exige um número válido com DDD, ou + e DDI para outro país. Ambos exige todos esses dados. Links adicionais não substituem os campos. O mapa usa Leaflet com OpenStreetMap, sem chave Google, Geocoding ou Nominatim. Uma falha no mapa apresenta feedback e permite nova tentativa, mantendo os textos preenchidos.

Números brasileiros são persistidos com DDI 55 e sem formatação. Novas localizações usam identidade por coordenadas: nome e endereço são declarados pela pessoa que indica, validados em tamanho e obrigatoriedade, sem consulta automática a um provedor. Place IDs enviados pelo cliente são descartados. A latitude e longitude são validadas e persistidas como DECIMAL com sete casas. Edição e criação usam as mesmas regras.

Somente após uma avaliação válida, outras indicações ainda não avaliadas, não excluídas e do mesmo ciclo são consideradas válidas se coincidirem diretamente com o local ou WhatsApp da escolhida. No canal ambos basta a coincidência de um desses identificadores. A equivalência não se propaga por uma terceira indicação. Cada indicação equivalente recebe avaliação, reputação e pontuação pelas mesmas regras da escolhida, inclusive elegibilidade de ranking. A data de seleção da escolhida determina o prazo do ranking para todas as equivalentes. Avaliação inválida não se propaga.

A operação ocorre em uma transação, com pedido bloqueado e pontuação idempotente por avaliação e ranking. As equivalentes preservam selecionada_em nulo, para a interface distinguir “escolhida” de “também válida”. Cada indicador recebe notificação e histórico próprios. Outras identidades e contatos continuam ocultos após a seleção, conforme o comportamento existente da comparação.

Pedidos anteriores à migração mantêm canal nulo e o formato livre; ao editar um pedido sem participações é necessário escolher um dos novos canais. Não há reprocessamento de pontos antigos.


## Seleção no mapa e navegação

`components/LocationPicker.js` combina nome/endereço manuais e `MapLocationPicker`. Leaflet é carregado somente ao abrir o mapa. A pessoa pode clicar num ponto ou mover o mapa com o teclado e usar o ponto central. “Usar esta localização” confirma o ponto; cancelar mantém a localização anterior e os textos preenchidos. O mapa inicia no ponto salvo, quando existente; em novas indicações, aproxima a cidade e UF do pedido (zoom 13), sem selecionar automaticamente um estabelecimento. “Usar minha localização” aproxima o mapa somente após a solicitação explícita e a permissão do navegador; negar a permissão mantém o posicionamento manual disponível. O centro da cidade vem da base local em `data/br-city-centers.json`, consultada somente no servidor pelo endpoint autenticado `map-config`. Municípios homônimos são diferenciados pela UF. Se uma cidade informada não for encontrada, o mapa apresenta um erro e permite tentar novamente; a visão do Brasil fica reservada aos fluxos sem cidade informada. Não há chamada externa de geocodificação.

Os pontos preservam o clique com sete casas decimais. Para pontuação, locais sem Place ID usam latitude/longitude arredondadas a cinco casas (aproximadamente um metro), comparadas diretamente à escolhida. Place IDs legados diferentes nunca são unificados apenas por coordenadas. Registros antigos não são apagados e não há reprocessamento de pontuação. Ao editar uma localização com coordenadas, ela passa à seleção manual, sem consultar Google Places.

`components/PlaceNavigationLinks.js` gera os botões Google Maps e Waze a partir de `lib/location.js`, usando as mesmas coordenadas persistidas. As URLs HTTPS oficiais abrem no aplicativo ou na web conforme o sistema operacional. Registros antigos sem coordenadas mantêm apenas o link Google Maps existente, sem inventar destino Waze. Contatos e coordenadas seguem as regras existentes de visibilidade na comparação.

O mapa utiliza atribuição OpenStreetMap visível, cache HTTP padrão e carregamento da área visível, sem pré-busca ou download em massa. `.env.example` documenta os opcionais `MAP_TILE_URL` e `MAP_TILE_ATTRIBUTION`. O endpoint autenticado `map-config` permite trocar o provedor por configuração, sem expor chaves. O fluxo não exige configurar essas variáveis: o padrão é OpenStreetMap. Endpoints legados de Places permanecem separados e não são chamados pelo cadastro/edição de indicações.

Verificação: `npm run test:maps`, `scripts/smoke-contact-scoring.mjs` e navegação real com Leaflet em mobile/desktop.

Referências: [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html), [política de mapas OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/), [URLs Google Maps](https://developers.google.com/maps/documentation/urls/get-started) e [links Waze](https://developers.google.com/waze/deeplinks).

## Limites da janela e telas pequenas

`ViewportPopover` é o componente canônico para as listas de estado/cidade. Usa portal no body, acompanha rolagem e viewport visual (incluindo teclado virtual), inverte a abertura quando falta espaço abaixo e limita altura e largura, com rolagem interna. Opções ativas via teclado permanecem visíveis.

Menus de conta e cartões do tutorial têm altura limitada à janela e rolagem interna. O menu lateral usa altura dinâmica, navegação rolável e botão de fechar interno em mobile. Textos livres podem quebrar palavras longas; cartões de perfil e resgates e campos de formulário podem encolher sem forçar largura mínima. O cabeçalho público permite quebra de linha.

Verificação reproduzível: `npm run test:responsive` com a aplicação de produção em `http://localhost:3001` (ou `BASE_URL`). As APIs são simuladas com conteúdo longo e perfis de visitante, usuário, empresa e administrador. O teste percorre todas as rotas de página e interações adicionais em seis resoluções, gera relatório e capturas em `/tmp/indica-responsive`. A integração real de coordenadas e regras de pontuação é verificada separadamente por `scripts/smoke-contact-scoring.mjs`.
