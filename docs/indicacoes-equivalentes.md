# Nova indicação e reconhecimento por equivalência

O GoIndica conecta pedidos a recomendações da comunidade. A escolha confirma uma solução; contribuições equivalentes também são reconhecidas, com pontuação menor.

## Modalidades

Novos pedidos e a edição oferecem apenas Localização no mapa ou WhatsApp. A modalidade combinada não pode ser selecionada ou publicada, inclusive por rascunhos antigos e pela API. Pedidos já gravados com ambos continuam recebendo indicações e mantendo seu histórico. O pedido continua sendo a fonte da modalidade. `/indicar/[requestId]/nova` e a edição de indicações compartilham a validação com o servidor em `lib/indication-contact.js`. O payload não altera a modalidade do pedido.

- `maps`: descrição e pelo menos um item do local: nome, endereço ou ponto confirmado no mapa. Nome e endereço consultam a Places API; escolher uma sugestão preenche a identidade do estabelecimento.
- `whatsapp`: descrição, nome do profissional/empresa/contato e número válido com DDD. O número é apresentado com máscara e salvo com DDI, sem pontuação.
- `both` (somente pedidos existentes): descrição, pelo menos um item do local e WhatsApp.

A tela Nova indicação não apresenta campos de links adicionais: o preenchimento fica concentrado na descrição e no contato solicitado. Links de registros existentes continuam compatíveis com o sistema. Pedidos legados sem modalidade mantêm o formato livre. A criação e a prévia validam as duas modalidades disponíveis.

## Identificação

A comparação é direta com a indicação escolhida, dentro do pedido e ciclo atuais. Excluídas, já avaliadas e respostas enviadas após a abertura da comparação não recebem equivalência.

Place IDs iguais identificam o estabelecimento. IDs diferentes impedem equivalência. Quando faltar Place ID em algum dos registros, é necessário coincidir nome e endereço normalizados e coordenadas arredondadas a cinco casas. Coordenadas ou endereços isolados não identificam um estabelecimento.

WhatsApp usa números normalizados, independentemente do nome. Para `both`, local ou telefone pode confirmar a identidade, mas conflito entre telefones, IDs ou dados manuais impede o reconhecimento. A comparação é conservadora: divergências não são unificadas automaticamente.

## Pontos e reputação

A migração `004_validacao_equivalencia.sql` cria `configuracao_reputacao`, com 10 pontos principais e 5 por equivalência. Os valores podem ser alterados nessa tabela; uma restrição exige `0 < pontos_equivalencia < pontos_principal`. A avaliação lê os valores na transação. As penalidades existentes para avaliações inválidas permanecem.

A indicação mantém `tipo_validacao` (`chosen` ou `equivalent`) e `indicacao_origem_id`. Equivalentes preservam `selecionada_em = NULL`. Outras opções permanecem não escolhidas, sem penalização.

`contagem_indicacoes_validas` inclui escolhidas e equivalentes. Os novos contadores `contagem_validas_escolhidas` e `contagem_validas_equivalentes` distinguem as origens. `contagem_selecionadas_avaliadas` inclui apenas avaliações diretas, válidas ou inválidas. A reputação usa:

```
válidas / (selecionadas e avaliadas + válidas por equivalência) × 100
```

A pontuação acumulada é atribuída uma vez por contribuição, independentemente de inscrições em rankings. Cada ranking elegível recebe o respectivo delta, sem multiplicar a pontuação acumulada do perfil. A data de seleção da escolhida continua determinando a elegibilidade de ranking das equivalentes.

O histórico guarda usuário, pedido, indicação, classificação, referência à escolhida, pontos, alteração de reputação e data. Uma chave única por usuário/pedido para resultados válidos, o bloqueio transacional do pedido/usuário e as chaves do ledger impedem duplicação. Uma avaliação inválida não propaga reconhecimento; uma escolha válida posterior passa a ser a referência.

## Dados anteriores

A migração classifica as validações antigas e separa os contadores. Pontos de rankings e o histórico de reputação anterior são preservados. Pontos históricos recuperáveis do ledger são registrados uma única vez por avaliação (sem somar o mesmo reconhecimento em vários rankings). Quando não há ledger anterior, os pontos históricos permanecem desconhecidos (`NULL`), sem inventar uma concessão retroativa. O reconhecimento novo independe de ranking.

## Verificação

- `npm run test:equivalence`: identidade, conflitos, telefones e campos obrigatórios.
- `npm run test:indication-form`: formulário real com APIs/SDK simulados em 320px e 1440px, nas três modalidades.
- `npm run test:maps`: coordenadas, mapa manual e validação Places.
- `npm run test:contacts`: integração com MySQL e aplicação em `BASE_URL` (padrão `http://127.0.0.1:3001`), incluindo três modalidades, classificação, pontos, reputação, isolamento, resposta tardia, avaliação inválida/nova escolha, ausência de ranking e avaliação concorrente. Cria e remove somente suas fixtures.
- `npm run test:map-search`: navegador e banco reais com Google simulado.
- `npm run build`: compilação de produção.

Nome/endereço isolados e marcações sem identidade suficiente não geram equivalência automaticamente. Resultados selecionados da API preservam o Place ID e são resolvidos novamente no servidor. A edição também aceita local parcial e não apresenta campo para adicionar links; links históricos são preservados.
