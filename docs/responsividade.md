# Revisão de responsividade e mapa — 06/11/2026

O mapa de uma nova indicação abre na cidade e UF do pedido, em zoom 13. Na edição, o ponto já salvo tem prioridade, em zoom 17. Aproximar a cidade não confirma um estabelecimento: a pessoa continua marcando e confirmando o ponto exato. A base local de 5.571 municípios é consultada no servidor, sem nova configuração no `.env` nem geocodificação externa. Fonte, licença e transformação em `data/README.md`.

## Correções

- Cabeçalho público permite quebrar os botões em outra linha em telas pequenas.
- Cartões de perfil e resgates aceitam textos longos e podem encolher dentro de grids/flex. Nomes, links e endereços não impõem largura mínima à página.
- O efeito decorativo do perfil fica dentro do cartão, eliminando rolagem horizontal.
- Campos de formulário respeitam a largura disponível.
- Listas de estado/cidade usam `ViewportPopover`, com portal, limites da viewport visual, abertura acima quando necessário e rolagem interna. A opção ativa pelo teclado permanece visível.
- Menu da conta e cartões do tutorial têm altura limitada e rolagem interna.
- Navegação lateral usa altura dinâmica, lista rolável e botão de fechamento interno em mobile.

## Resultado

Build de produção aprovado. A execução final de `npm run test:responsive` concluiu **502 verificações, 35 cenários e seis resoluções**, com **zero estouros de largura/painéis e zero erros de JavaScript**. `npm run test:maps` passou em 5/5 testes, e o smoke real de contatos/pontuação concluiu com sucesso e limpeza dos seus registros. Uma inspeção adicional com tiles reais do OpenStreetMap confirmou a cidade visível em zoom 13 (seis respostas HTTP 200); as imagens da varredura automatizada usam tiles simulados para evitar tráfego desnecessário ao provedor.

## Cobertura

`npm run test:responsive` usa Chrome/Playwright contra o build de produção. Percorre 35 cenários de página (incluindo redirecionamentos), com visitante, usuário, empresa e administrador. As APIs recebem dados simulados com nomes, títulos, links e descrições extensos. O teste não altera registros reais.

Resoluções: 320×568, 390×844, 844×390 (horizontal), 768×1024, 1024×768 e 1440×900.

Além das páginas, a varredura abre: mapa novo e de edição, formulário de indicação, motivo de avaliação, confirmação de exclusão de conta, menu lateral, menu da conta, notificações, listas de estado/cidade próximas à borda inferior, perfil empresarial, etapas de período/banner/prêmios, detalhes de patrocínio, fases de rankings administrativos e tutoriais de usuário e empresa.

A verificação mede a largura da página, elementos fora das bordas laterais e limites completos dos painéis abertos. Áreas com rolagem interna intencional, como listas e tabelas, são tratadas separadamente. As capturas de perfil, empresa, pedido e mapa também permitem inspeção visual.

Os testes de mapas verificam coordenadas, navegação, equivalência e cidades homônimas. `scripts/smoke-contact-scoring.mjs` verifica separadamente o endpoint real de centro municipal, criação/edição de coordenadas, autorização, privacidade e pontuação no banco local, removendo seus próprios registros ao terminar.

## Reprodução

```sh
npm run build
npm run start -- -p 3001
# Em outro terminal:
npm run test:responsive
npm run test:maps
BASE_URL=http://127.0.0.1:3001 node scripts/smoke-contact-scoring.mjs
```

O teste visual usa `/usr/bin/google-chrome`, quando disponível. Alternativas: definir `CHROME_PATH` ou instalar Chromium com `npx playwright install chromium`. `BASE_URL` altera a URL da aplicação e `RESPONSIVE_OUTPUT` altera a pasta de evidências. O padrão é `/tmp/indica-responsive`, com `report.json` e capturas PNG.

## Limites e pendências existentes

A validação usa tamanhos de viewport no Chrome; não substitui teste físico de Safari/iOS, teclado virtual ou popups nativos de seleção. O layout estático e o posicionamento de listas são verificados; não houve nova auditoria geral de acessibilidade nem alteração das regras de pontuação.

O lint global mantém 25 erros e 3 avisos anteriores, sobretudo de hooks React; o lint dos novos módulos e scripts passa. O detector Impeccable encontrou alertas de estilo no CSS legado (554 recomendações e 2 avisos de fontes), sem apontamentos nos componentes JS verificados. A ferramenta também informou que `.impeccable/design.json` está desatualizado em relação ao documento de design; o arquivo auxiliar não foi regenerado nesta tarefa. O auditor estático premium excedeu o limite de 20 segundos sem produzir relatório; a evidência principal é a execução da aplicação e seus testes.
