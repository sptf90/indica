# Busca de estabelecimentos no mapa

Ao cadastrar ou editar uma indicação com localização:

1. Abra “Selecionar no mapa”. O mapa inicia na cidade e UF do pedido ou no local já salvo.
2. Digite o nome, por exemplo “Muffato”, e clique em “Buscar” ou pressione Enter.
3. Os resultados aparecem numa lista e em marcadores numerados. Selecione pela lista ou pelo marcador; o mapa aproxima o estabelecimento e exibe nome, endereço e coordenadas.
4. “Usar esta localização” confirma o candidato e preenche os campos automaticamente. “Cancelar” preserva a seleção anterior.
5. A prévia e os detalhes exibem o nome/endereço confirmados e links Google Maps/Waze para as coordenadas salvas.

A marcação manual continua disponível com clique, teclado/ponto central, localização do dispositivo e zoom pela roda do mouse. Campos manuais editados enquanto o mapa está aberto são preservados. A pesquisa é explícita, sem chamadas ao provedor a cada tecla. Alterar o termo cancela a busca anterior e limpa seus marcadores.

## Configuração

| Variável | Uso |
| --- | --- |
| `GOOGLE_PLACES_API_KEY` | Chave do servidor, com **Places API (New)** habilitada. Reutiliza o cliente Google Places existente. |
| `GOOGLE_MAPS_BROWSER_API_KEY` | Chave pública para **Maps JavaScript API**, restrita aos referenciadores HTTP do site. Somente esta chave é retornada ao navegador. |
| `GOOGLE_MAPS_MAP_ID` | ID do mapa para marcadores avançados. Sem valor, utiliza `DEMO_MAP_ID` para desenvolvimento; configure um ID do projeto em produção. |
| `MAP_TILE_URL` / `MAP_TILE_ATTRIBUTION` | Provedor/atribuição do mapa manual Leaflet/OpenStreetMap. |

Não é necessário habilitar Geocoding API. As duas APIs Google precisam estar ativas e autorizadas no projeto usado pelas respectivas chaves. O `.env.example` documenta as variáveis; `.env` não foi alterado. No ambiente local desta entrega, as chaves Google estão ausentes.

Os resultados Places são exibidos somente sobre Google Maps, conforme a [política oficial](https://developers.google.com/maps/documentation/places/web-service/policies). Sem chave de navegador, mantém-se o mapa manual. Se o SDK Google falhar, “Usar mapa manual” permite continuar com Leaflet/OpenStreetMap. Resultados vazios ou falhas de pesquisa não bloqueiam a marcação manual.

## Persistência e segurança

A busca pede apenas ID, nome, endereço, coordenadas e link Google Maps, sem fotos, avaliações ou buscas de similares. O servidor usa a cidade/UF do pedido e viés pelo centro municipal para a pesquisa.

Na gravação, `resolveIndicationPlace` consulta o Place ID novamente pelo cliente Google existente. Os dados canônicos substituem nome/endereço/coordenadas enviados pelo navegador. A origem Google e o Place ID são preservados na edição, enquanto a marcação manual remove esse ID. O esquema de banco existente continua armazenando os dados e as coordenadas com sete casas decimais. As regras de pontuação não foram alteradas.

## Resultado da execução

Build aprovado; 6/6 testes de mapas; busca integrada com banco real e Google simulado aprovada em 390/1440 px, incluindo fallback manual em 320 px e preservação de campos editados com o mapa aberto. A varredura de layout concluiu 502 verificações em 35 cenários e seis resoluções, sem estouros de tela ou erros JavaScript. Os testes reais de pontuação/contatos e de navegação/prévias do administrador também passaram.

## Verificação

- `npm run build` e `npm run test:maps`.
- `npm run test:map-search`: processo isolado na porta 3002, banco real e Google simulado, sem chamadas pagas. Cria/remove seus próprios dados. Cobre pesquisa, vazio, erro, cancelamento de requisição antiga, seleção pela lista e pelo marcador, preenchimento, cancelamento de escolha, prévia, gravação, detalhes e edição em 390 e 1440 px. Cobre falha do SDK e alternativa manual em 320 px, proteção da chave de servidor e substituição de dados forjados pelos dados canônicos.
- `npm run test:responsive`: varredura geral de páginas/painéis com APIs simuladas.
- `scripts/smoke-contact-scoring.mjs`: integração real de coordenadas, privacidade e pontuação.
- `npm run test:admin-navigation`: navegação completa do administrador e manutenção das prévias por perfil.

As capturas e logs de busca ficam em `/tmp/indica-map-search`. O teste do SDK e das respostas Places usa fixtures; não houve validação com credenciais Google reais, pois elas não estão configuradas. A lista de notificações também recebeu uma correção dos nomes físicos das colunas nos filtros, após retornar HTTP 500 durante o teste real.

O lint dos módulos novos/alterados da integração passa. O lint global mantém os 25 erros e 3 avisos anteriores de hooks. O detector de design apontou apenas recomendações/avisos no CSS legado; o auditor estático premium excedeu 20 segundos sem produzir relatório.
