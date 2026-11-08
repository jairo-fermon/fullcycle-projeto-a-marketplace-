# Plano de desempenho declarado antes da medição - A

Data: 08/11/2026. Resultados serão registrados em desempenho.md somente após execução real.

## Hipótese e intervenção verificável

Com 100.000 pedidos sintéticos e 5.000 produtos, filtrar pedidos por status e ordenar data/ID sem índice composto pode exigir leitura e sort de muitos registros. Comparar EXPLAIN ANALYZE real, latência k6 e throughput antes/depois de índice `(status,created_at DESC,id DESC)`.

O catálogo usa cache local limitado a 100 chaves, TTL padrão 5.000 ms. Cadastro pelo próprio processo invalida o cache inteiro e aumenta uma geração para não recolocar resultados antigos de consultas em voo. Alterações externas podem aparecer apenas após expiração; tolerância é até o TTL desde inserção no cache, além do tempo de consulta em voo. Preços usados para criar pedido sempre consultam PostgreSQL diretamente. Não usar cache local para garantir estoque, saldo ou preço de compra. Nenhum desses recursos adicionais foi criado.

## Cenário controlado e SLO

- Mesma imagem, host, dados, endpoints, pausas e estágios; nenhuma escrita no conjunto entre as duas medições.
- Baseline real: índice removido pela ferramenta de manutenção do próprio módulo, cache desligado por configuração. Sem atraso artificial, randomização ou consulta inútil para fabricar gargalo.
- Otimizado: mesmo SQL/contrato com índice habilitado e cache de catálogo ligado. O runner reconfigura o app e repete o mesmo script.
- Aquecimento igual: 10 consultas de cada rota antes de cada execução.
- k6 com exatamente três estágios: 10 s até 5 VUs, 15 s até 15 VUs, 10 s até zero. Cada iteração faz GET /orders?status=PENDING&limit=20&page=1 e GET /catalog/products?category=category-01&limit=20; pausa 100 ms.
- SLI: p95 de cada endpoint, em milissegundos. Meta/SLO nesta janela local de 35 segundos: p95 <500 ms para cada rota, zero erro HTTP e 100% dos checks de forma/quantidade.
- Registrar hardware, versões, horários, requests, checks, erros, p95 e throughput reais. Aumentar throughput em carga fechada com pausa não prova capacidade máxima.
- Consultar planos antes/depois. Não atribuir ganho isoladamente a cache ou índice em teste combinado; os planos mostram o efeito do índice e os contadores do cache mostram hits/misses. Se não melhorar, registrar isso sem selecionar apenas a execução favorável.

## Fila e idempotência

PostgreSQL guarda tentativa e job na mesma transação. Claim usa FOR UPDATE SKIP LOCKED; recibo único por pagamento reconhece duplicata. O módulo Pedidos também aplica atualização idempotente por paymentReference: se ocorrer falha após atualizar o pedido e antes do recibo, o retry pode repetir o chamado sem efeito adicional.

Até três entregas, com backoff de 1 s e 2 s entre as tentativas; a terceira falha encerra em DEAD/FAILED. Erros permanentes de negócio encerram imediatamente. A fila mantém código de erro seguro, não stack/SQL/payload. Retry não promete sucesso e não substitui investigação de jobs DEAD. Não há endpoint extra de administração/reprocessamento no escopo.

Não há transação distribuída entre módulos: atualização do pedido e recibo são transações locais distintas. A recuperação usa entrega pelo menos uma vez e idempotência, comprovada por teste de falha após efeito. Não chamar isso de execução exatamente uma vez.

## Ampliação do hardening A

O plano anterior continua histórico. O runner benchmark-matrix.mjs fixa, antes das medições, quatro configurações de índice/cache, duas rodadas por padrão e ordem inversa na segunda. Mantém os três estágios, pausas, rotas, 10 aquecimentos por rota, imagem e dataset. Não escolher a menor medição para representar todas: registrar cada rodada, p50/p95/p99/máximo/amostras/erros/throughput e recursos amostrados. Informações p99 que não existiam nos summaries antigos não serão inventadas.

Matriz somente em clone isolado, com portas e nome Compose próprios e declaração BENCHMARK_ISOLATED=true. Migrations/seed fora das janelas de carga; nenhum dado é removido pelo runner. Fingerprints antes/depois e restauração de índice/cache são verificações obrigatórias. Coleta de recursos gera overhead comum às fases e não garante captura de toda pausa curta. GC e escalonamento não são inferidos de um único agregado.

O pico antigo fica classificado como causa indeterminada enquanto não houver correlação suficiente. Novas amostras lentas terão IDs e tempos do cliente para tentativa de consulta de trace real; resultados novos não provam retroativamente a causa do evento antigo. Referências primárias das opções de coleta: [estatísticas de Trend](https://grafana.com/docs/k6/latest/using-k6/k6-options/reference/#summary-trend-stats) e [tempos por requisição](https://grafana.com/docs/k6/latest/examples/get-timings-for-an-http-metric/). A compatibilidade é verificada na imagem k6 1.3.0 usada no projeto.
