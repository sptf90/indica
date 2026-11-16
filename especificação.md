GOINDICA — ESPECIFICAÇÃO FUNCIONAL

Adequação da tela “Nova indicação”, equivalência de indicações, pontuação e reputação

1. OBJETIVO

Corrigir o funcionamento da tela “Nova indicação” ("/indicar/:id/nova") para que os campos exigidos sejam determinados automaticamente pela modalidade escolhida pelo solicitante na criação do pedido.

A tela “Pedir uma indicação” já possui três opções corretamente implementadas:

1. Localização no mapa.
2. WhatsApp.
3. Localização e WhatsApp.

A modalidade selecionada deverá determinar quais informações o indicador precisará fornecer.

Além disso, as informações deverão ser armazenadas de forma padronizada, permitindo que o sistema identifique quando diferentes usuários indicaram o mesmo estabelecimento, profissional ou contato.

Essa identificação será utilizada para atribuir pontuação não apenas ao usuário cuja indicação foi escolhida e validada, mas também aos demais usuários que forneceram uma indicação equivalente.

Regra fundamental: o usuário escolhido receberá a pontuação principal. Os demais usuários que indicaram a mesma opção validada receberão uma pontuação inferior, e suas indicações também serão contabilizadas como válidas na reputação.

2. MODALIDADES DE INDICAÇÃO

A tela “Nova indicação” deverá consultar a modalidade registrada no pedido original e apresentar exclusivamente os campos correspondentes.

O indicador não poderá modificar a modalidade solicitada.

2.1. Modalidade: Localização no mapa

Campos:

- Descrição — obrigatória.
- Links externos — opcionais.
- Nome do estabelecimento ou local — obrigatório.
- Endereço — obrigatório.
- Seleção e confirmação da localização no mapa — obrigatória.

A localização deverá ser confirmada por meio do mapa, permitindo registrar os dados geográficos necessários à identificação do estabelecimento.

Não permitir o envio sem a confirmação da localização.

Não apresentar campo WhatsApp.

2.2. Modalidade: WhatsApp

Campos:

- Descrição — obrigatória.
- Links externos — opcionais.
- Nome do profissional, empresa ou contato — obrigatório.
- Número do WhatsApp — obrigatório.

Regras para o WhatsApp:

- Exigir número com DDD.
- Aplicar máscara de telefone.
- Validar o formato informado.
- Armazenar o número em formato padronizado.
- Desconsiderar diferenças de espaços, parênteses, hífens e código de país na comparação, quando representarem o mesmo número.
- Permitir a abertura de conversa pelo WhatsApp.

Não apresentar campos de endereço ou localização no mapa.

2.3. Modalidade: Localização e WhatsApp

Campos:

- Descrição — obrigatória.
- Links externos — opcionais.
- Nome do estabelecimento, profissional ou empresa — obrigatório.
- Endereço — obrigatório.
- Seleção e confirmação no mapa — obrigatória.
- Número do WhatsApp — obrigatório.

Os dois conjuntos de informações deverão ser preenchidos.

Não permitir o envio contendo apenas localização ou apenas WhatsApp.

3. IDENTIFICAÇÃO DA MODALIDADE NO PEDIDO

Na tela “Nova indicação”, apresentar a modalidade definida pelo solicitante.

Exemplo:

Você está indicando para: Dentista Infantil

O solicitante deseja receber: Localização e WhatsApp.

Essa informação deverá ser carregada automaticamente a partir do pedido original.

A modalidade não poderá ser alterada pelo indicador.

4. VALIDAÇÃO E PRÉ-VISUALIZAÇÃO

O botão “Pré-visualizar” deverá validar os campos obrigatórios conforme a modalidade.

A pré-visualização deverá apresentar somente as informações exigidas e preenchidas para o pedido.

O envio definitivo somente poderá ocorrer após o preenchimento e a validação dos campos obrigatórios.

As validações deverão ocorrer também no servidor, impedindo o envio de indicações incompletas.

5. IDENTIFICAÇÃO DE INDICAÇÕES EQUIVALENTES

5.1. Finalidade

O GoIndica deverá reconhecer automaticamente quando dois ou mais usuários indicarem a mesma opção para um determinado pedido.

Essa identificação permitirá reconhecer a contribuição de usuários que forneceram uma indicação correta, mesmo que não tenham sido escolhidos pelo solicitante.

A equivalência será verificada exclusivamente entre indicações pertencentes ao mesmo pedido.

5.2. Equivalência por localização

Quando a modalidade envolver localização, o sistema deverá comparar a identidade do estabelecimento ou local indicado.

A identificação poderá considerar:

- Identificador do estabelecimento no serviço de mapas.
- Coordenadas geográficas.
- Nome do estabelecimento.
- Endereço confirmado.
- Outros dados necessários para confirmar que se trata do mesmo local.

Estabelecimentos diferentes situados no mesmo endereço ou muito próximos não deverão ser considerados automaticamente equivalentes.

A comparação deverá buscar identificar o mesmo estabelecimento, e não apenas endereços semelhantes.

5.3. Equivalência por WhatsApp

Quando a modalidade envolver WhatsApp, o sistema deverá comparar os números normalizados.

Exemplo:

- (17) 99999-8888
- 17 99999-8888
- +55 17 99999-8888

Esses formatos deverão ser reconhecidos como o mesmo número.

A comparação não deverá depender da descrição ou do nome digitado pelo indicador.

5.4. Equivalência por localização e WhatsApp

Quando o pedido exigir localização e WhatsApp, o sistema deverá comparar os dois dados.

Será possível reconhecer uma indicação equivalente pela identidade do estabelecimento ou pelo número do WhatsApp, desde que os dados permitam confirmar que se trata do mesmo estabelecimento, profissional ou contato.

A coincidência de um único dado não deverá gerar pontuação automaticamente quando houver conflito que indique estabelecimentos ou profissionais diferentes.

6. REGRAS DE PONTUAÇÃO

6.1. Pontuação principal

Quando o solicitante escolher uma indicação e confirmar que ela é válida, o usuário responsável receberá a pontuação principal prevista no sistema de reputação do GoIndica.

Essa indicação deverá ser classificada como:

Indicação válida — Escolhida

6.2. Pontuação por equivalência

Após a confirmação da indicação escolhida como válida, o sistema deverá verificar as demais indicações recebidas para o mesmo pedido.

Caso outros usuários tenham indicado o mesmo estabelecimento, profissional ou contato, esses usuários também deverão receber pontuação.

Regras obrigatórias:

1. A indicação deverá pertencer ao mesmo pedido.
2. Deverá ter sido enviada antes do bloqueio de novas indicações.
3. Deverá corresponder à indicação escolhida e confirmada como válida.
4. Não será necessário que o solicitante escolha ou avalie individualmente as indicações equivalentes.
5. A pontuação por equivalência deverá ser inferior à pontuação principal.
6. Cada usuário poderá receber pontuação por equivalência apenas uma vez por pedido.
7. Não poderá ocorrer pontuação duplicada.
8. A pontuação somente será atribuída após a confirmação de validade da indicação escolhida.

Essas indicações deverão ser classificadas como:

Indicação válida — Por equivalência

6.3. Indicações diferentes

Os usuários que indicaram estabelecimentos, profissionais ou contatos diferentes da indicação validada não receberão pontuação por equivalência.

Essas indicações não deverão ser automaticamente classificadas como inválidas apenas por não terem sido escolhidas.

6.4. Indicação escolhida considerada inválida

Quando o solicitante considerar inválida a indicação escolhida:

- Não atribuir pontuação principal.
- Não atribuir pontuação por equivalência com base nessa indicação.
- Manter o fluxo de avaliação previsto no GoIndica.
- Permitir que o solicitante prossiga para outra indicação, conforme as regras existentes.

Caso uma indicação posterior seja escolhida e confirmada como válida, a comparação de equivalência deverá considerar essa nova indicação validada.

6.5. Valores da pontuação

A pontuação principal e a pontuação secundária deverão seguir os valores definidos nas configurações do sistema de reputação.

A pontuação secundária deverá ser sempre inferior à principal.

Os valores numéricos poderão ser definidos posteriormente, sem necessidade de alterar as regras de identificação e classificação.

7. CONTABILIZAÇÃO NA REPUTAÇÃO

7.1. Regra geral

Toda indicação reconhecida como válida, seja por escolha direta ou por equivalência, deverá ser contabilizada como indicação válida na reputação do usuário.

Isso significa que o usuário que não foi escolhido, mas indicou a mesma opção confirmada como válida, também terá sua reputação atualizada.

7.2. Indicação válida escolhida

Quando a indicação for escolhida e confirmada como válida:

- Contabilizar uma indicação válida.
- Contabilizar uma indicação escolhida e validada.
- Atribuir a pontuação principal.
- Registrar a classificação “Válida — Escolhida”.

7.3. Indicação válida por equivalência

Quando uma indicação não escolhida for reconhecida como equivalente à indicação validada:

- Contabilizar uma indicação válida.
- Contabilizar uma indicação válida por equivalência.
- Atribuir a pontuação secundária.
- Registrar a classificação “Válida — Por equivalência”.
- Não contabilizar como indicação escolhida.
- Não exigir avaliação individual pelo solicitante.

7.4. Indicadores da reputação

A reputação deverá permitir distinguir:

- Total de indicações realizadas.
- Total de indicações válidas.
- Total de indicações válidas escolhidas.
- Total de indicações válidas por equivalência.
- Pontuação acumulada.

O total de indicações válidas deverá considerar a soma das indicações escolhidas e validadas com as indicações validadas por equivalência.

Exemplo:

Um usuário possui:

- 20 indicações realizadas.
- 8 indicações escolhidas e validadas.
- 5 indicações válidas por equivalência.

Sua reputação deverá contabilizar 13 indicações válidas, sendo 8 escolhidas e 5 equivalentes.

A quantidade de indicações válidas não poderá ser duplicada por alterações posteriores na classificação.

7.5. Histórico da reputação

O sistema deverá registrar a origem de cada pontuação.

Para cada registro, armazenar:

- Identificação do pedido.
- Identificação da indicação.
- Usuário beneficiado.
- Tipo de validação: escolhida ou equivalente.
- Pontos atribuídos.
- Data da atribuição.
- Referência à indicação escolhida que originou a validação por equivalência, quando aplicável.

O histórico deverá permitir identificar por que o usuário recebeu determinada pontuação.

8. PROCESSAMENTO AUTOMÁTICO

Quando o solicitante confirmar uma indicação como válida, o sistema deverá executar:

1. Identificar a indicação escolhida.
2. Registrar sua confirmação como válida.
3. Atribuir a pontuação principal ao indicador escolhido.
4. Atualizar a reputação desse usuário.
5. Consultar as demais indicações pertencentes ao mesmo pedido.
6. Comparar os dados de localização e/ou WhatsApp conforme a modalidade.
7. Identificar as indicações equivalentes.
8. Classificar essas indicações como válidas por equivalência.
9. Atribuir a pontuação secundária aos respectivos usuários.
10. Atualizar o total de indicações válidas e a reputação desses usuários.
11. Registrar as movimentações no histórico de pontuação.
12. Impedir duplicidade caso o processamento seja executado novamente.

A operação deverá garantir consistência entre a classificação das indicações, os pontos atribuídos e os totais da reputação.

9. REGRAS DE INTEGRIDADE

O sistema deverá observar:

- Uma indicação por usuário para cada pedido, conforme as regras existentes.
- Somente indicações efetivamente enviadas antes do bloqueio de novas respostas poderão participar da comparação.
- A equivalência deverá ser apurada dentro do mesmo pedido.
- Uma indicação não poderá receber simultaneamente pontuação principal e secundária.
- Uma indicação válida por equivalência deverá contar apenas uma vez no total de indicações válidas.
- Não atribuir pontuação por equivalência antes da confirmação de uma indicação válida.
- Não considerar automaticamente inválidas as indicações não escolhidas.
- Preservar o histórico e a rastreabilidade das pontuações.
- Evitar que o reprocessamento de uma avaliação gere pontos adicionais.
- Preservar as regras existentes de avaliação, encerramento e reputação.

10. EXEMPLO PRÁTICO

Um solicitante cria o pedido:

“Preciso de indicação de dentista infantil em São José do Rio Preto.”

Modalidade escolhida: Localização e WhatsApp.

Quatro usuários enviam indicações:

João

- Clínica Sorriso.
- Localização confirmada.
- WhatsApp informado.

Maria

- Clínica Sorriso.
- Mesma localização.
- Mesmo WhatsApp.

Pedro

- Clínica Sorriso.
- Mesma localização.
- Mesmo WhatsApp.

Ana

- Clínica Dental Kids.
- Outra localização.
- Outro WhatsApp.

O solicitante escolhe a indicação de João e confirma que ela é válida.

Resultado:

João

- Indicação válida escolhida.
- Recebe pontuação principal.
- Soma uma indicação válida à reputação.

Maria

- Indicação válida por equivalência.
- Recebe pontuação secundária.
- Soma uma indicação válida à reputação.

Pedro

- Indicação válida por equivalência.
- Recebe pontuação secundária.
- Soma uma indicação válida à reputação.

Ana

- Não recebe pontuação por equivalência.
- Sua indicação não é automaticamente considerada inválida.

Nesse exemplo, três usuários tiveram suas contribuições reconhecidas como válidas, embora apenas uma indicação tenha sido escolhida pelo solicitante.

11. CRITÉRIOS DE ACEITAÇÃO

A implementação será considerada correta quando:

1. A tela “Nova indicação” identificar automaticamente a modalidade definida no pedido.
2. Os campos obrigatórios corresponderem à modalidade selecionada.
3. O indicador não puder alterar a modalidade.
4. Pedidos de localização exigirem confirmação no mapa.
5. Pedidos de WhatsApp exigirem número válido.
6. Pedidos de localização e WhatsApp exigirem ambos.
7. A pré-visualização apresentar os dados correspondentes à modalidade.
8. O servidor impedir indicações incompletas.
9. O sistema reconhecer indicações equivalentes dentro do mesmo pedido.
10. A indicação escolhida e validada receber pontuação principal.
11. As indicações equivalentes receberem pontuação inferior.
12. As indicações equivalentes serem contabilizadas como válidas na reputação.
13. O total de indicações válidas incluir as escolhidas e as equivalentes.
14. O histórico diferenciar pontuação principal e pontuação por equivalência.
15. Indicações diferentes não receberem pontos por equivalência.
16. Indicações não escolhidas não serem automaticamente consideradas inválidas.
17. Não ocorrer duplicidade de pontuação ou de contabilização.
18. A classificação e a reputação serem atualizadas automaticamente após a confirmação de validade.
19. As regras existentes de avaliação e encerramento continuarem funcionando.

12. RESTRIÇÕES DA ALTERAÇÃO

Não modificar a tela “Pedir uma indicação”.

As três modalidades existentes nessa tela deverão ser preservadas.

A implementação deverá concentrar-se em:

- Adequação funcional da tela “Nova indicação”.
- Validação dos campos conforme a modalidade.
- Padronização dos dados de localização e WhatsApp.
- Identificação automática de indicações equivalentes.
- Atribuição de pontuação principal e secundária.
- Atualização da reputação e do total de indicações válidas.
- Registro do histórico de pontuação.
- Prevenção de duplicidades.

REGRA CENTRAL: no GoIndica, uma indicação correta não depende exclusivamente de ter sido escolhida para ser reconhecida como válida. Quando diferentes usuários indicarem a mesma opção confirmada como válida pelo solicitante, todos deverão ter sua contribuição reconhecida na reputação, com pontuação maior para o indicador escolhido e pontuação menor para os demais indicadores equivalentes.