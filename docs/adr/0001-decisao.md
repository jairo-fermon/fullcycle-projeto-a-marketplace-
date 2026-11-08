# ADR 0001 - Monólito modular com Repository, Strategy e fila PostgreSQL

Data: 08/11/2026. Status: implementada e testada; gate humano aprovado; domínio oral ainda depende de ensaio.

## Contexto e exigência

O nível A exige monólito modular de Catálogo, Pedidos e Pagamento, volume sintético, cache, idempotência da fila e observabilidade. Não é decisão deste ADR transformar em microsserviços: a proposta já exige monólito modular. Precisamos manter essas fronteiras e comprovar entrega assíncrona sem infraestrutura alheia ao trabalho.

## Decisão

Cada módulo tem entrada pública em index.ts e schema próprio no PostgreSQL; somente o dono consulta suas tabelas. Pedidos usa CatalogPort para preço atual; Pagamento usa OrderPaymentPort para consultar pedido e aplicar resultado. A montagem em app.ts injeta dependências. SQL parametrizado/transações ficam em repositories, com interfaces de persistência em Catálogo e Pedidos. A CI verifica importações privadas e SQL cruzado.

Adotar **Repository** como Database Pattern, separando regra e transporte dos comandos SQL. Exemplo concreto de inversão de dependência: OrderService conhece CatalogPort e OrderRepository, sem pg. Custo: mais contratos e mapeamento explícito de tipos; não alegar que usar um driver já seria um pattern.

Adotar **Strategy** na resolução de pagamento simulado: approve e decline produzem resultados determinísticos. A fábrica seleciona a estratégia; claim/transação/retry não carregam as regras de decisão. Alternativa simples para essa parte seria um if dentro do worker; com apenas dois resultados teria menos classes, mas misturaria política e execução assíncrona. Não alegar integração financeira real nem complexidade comercial inexistente.

Fila durável no próprio PostgreSQL: tentativa/job em transação; FOR UPDATE SKIP LOCKED; recibo único; efeito idempotente em Pedidos por paymentReference. O contexto de trace W3C é persistido no job. Falha após efeito e antes de recibo usa retry seguro; não há transação distribuída nem promessa de exatamente uma execução.

## Alternativa principal descartada

Redis + BullMQ para fila/cache. Seria válida e comum no mesmo monólito; facilitaria capacidades especializadas de fila e compartilhamento de cache. Foi descartada neste escopo porque adicionaria serviço, credenciais e coordenação entre PostgreSQL e Redis para provar um fluxo pequeno. A fila SQL aproveita o banco já obrigatório e permite reproduzir falhas/recibos com consultas simples.

O trade-off não é gratuito: polling, retenção de jobs/recibos e concorrência passam a ser responsabilidade do código; transações curtas e índice de READY limitam custo, mas alta vazão pode justificar migrar a fila. Um worker por aplicação e até três entregas são suficientes para a demonstração; não se prometeu escalabilidade ilimitada.

## Cache e desempenho

Cache local de catálogo limitado a 100 chaves, TTL 5 s e invalidação em escrita local; geração impede ressurreição por consulta em voo. Preços de pedidos consultam banco diretamente. O cache não é mecanismo de saldo/estoque e não é compartilhado entre réplicas. Índice composto suporta status + ordenação de pedidos; o benchmark usa SQL real sem índice e com índice, no mesmo conjunto, com relatório honesto.

## Consequências e verificação

- Falha da aplicação não perde pedidos/tentativas/fila; reinício recupera os jobs. Falha do Jaeger perde só observabilidade transitória.
- Indisponibilidade do PostgreSQL afeta negócio e fila; é uma dependência comum assumida, sem arquitetura distribuída artificial.
- Testes provam fronteiras, preço sem cache, concorrência de chave, duplicata, falha após efeito e retry limitado, além de contrato real.
- Consultar scripts/check-boundaries.mjs, src/modules/orders/service.ts, payments/domain.ts e payments/repository.ts; rodar lint/testes e o gate descritos no README.
- C4 representa containers reais; três módulos não são três serviços.
