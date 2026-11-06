# Centros dos municípios brasileiros

`br-city-centers.json` contém 5.571 coordenadas municipais, usadas somente para a visão inicial do mapa. Nenhum ponto de indicação é escolhido automaticamente.

Fonte: https://github.com/kelvins/municipios-brasileiros, versão `503e2f70bbf1b4b7ec0b1f68b09086ccc38fe861`, arquivos `csv/municipios.csv` e `csv/estados.csv`, consultados em 06/11/2026. Licença MIT reproduzida em `br-city-centers.LICENSE`.

Transformação: unir os dois CSVs por `codigo_uf`; chave `UF:nome`, com nome em minúsculas, sem acentos nem pontuação; valores `[latitude, longitude]`. IDs de cidades do banco local não são códigos IBGE e não são usados nessa consulta.

A base é carregada somente no servidor. O navegador recebe apenas as coordenadas da cidade solicitada, sem chamadas externas a geocodificadores ou APIs pagas. Nome e UF devem ser usados juntos, pois existem municípios homônimos.
