# Gate de aceite - Projeto A

Data: 08/11/2026, America/Sao_Paulo. Revisão do fluxo, testes e validador: `3f55622`; ciclo completo **PASSOU**, de 12:45:14 a 12:49:08, com banco inicialmente vazio. Horários, comandos e resultados em `evidencias/validacao-local.json`. Cobertura medida: **98,06% linhas e 95,47% branches**. P95 de pedidos **172,85 -> 4,30 ms** e catálogo **18,41 -> 2,38 ms**, zero erros; métricas comprovam configurações distintas. Publicação/CI remoto ainda não executados; aprovação humana e envio ao Moodle pendentes.

M1 35, M2 20, M3 15, M4 30 são pesos dos módulos oficiais inteiros. Não há subpesos oficiais inventados nem nota garantida/estimada nesta etapa. Projeto B aprovado foi preservado em repositório/pasta distintos.

| Requisito / peso do módulo | Implementação | Comando de verificação | Evidência em docs/evidencias/ | Status local | Risco / limite |
| --- | --- | --- | --- | --- | --- |
| M1 / 35: monólito com três módulos e fronteiras | src/modules/*/index.ts, app.ts, check-boundaries.mjs | npm run boundaries e testes negativos da regra | qualidade.txt | PASSOU | Regra verifica imports/direção/SQL do código atual; não substitui revisão humana. |
| M1 / 35: fluxo produto -> pedido -> pagamento -> estado | Serviços dos três módulos e worker bootstrap | npm run demo | demonstracao.txt, trace-real.json | PASSOU | Pagamento simulado; sem gateway/cobrança real. |
| M1 / 35: >=100.000 pedidos e seed em lotes | platform/seed-plan.ts, scripts/seed.mjs, manutenção pública dos módulos | Executar seed duas vezes e SELECT origin,count(*) | seed-primeira.txt, seed-repetida.txt, seed-sql.txt | PASSOU | 100 mil sintéticos separados de chamadas de API; contagem não é venda real. |
| M1 / 35: Compose com um comando e migrations | docker-compose.yml, Dockerfile, platform/migrate.ts | docker compose up --build -d --wait desde banco vazio | limpeza.txt, subida.txt, compose-status.txt | PASSOU | Preparação explícita de .env e engine Linux são pré-requisitos. |
| M1 / 35: SOLID, design pattern e Database Pattern | OrderService/CatalogPort/OrderRepository; Strategy; repositories | Inspecionar código/ADR e rodar unitários/integração | qualidade.txt; ADR 0001 | PASSOU | Exemplos concretos, sem afirmar que cada classe prova todos os princípios. |
| M2 / 20: unitários, integração e contrato | tests/unit, integration e contract | npm test em PostgreSQL isolado | qualidade.txt | PASSOU | 42 unitários, 14 integrações e 2 de contrato; falhas injetadas só em testes. |
| M2 / 20: coverage declarado e bloqueante | vitest.config.ts inclui src inteiro | npm test --coverage incorporado ao script | coverage-summary.json | PASSOU | Mínimos 80% linhas/75% branches; bootstrap/scripts fora de src têm validação de execução própria. |
| M2 / 20: CI verde com install/lint/test/coverage | .github/workflows/ci.yml | Sequência equivalente em contêiner; publicar e acompanhar execução remota | qualidade.txt; sem URL de CI remoto ainda | BLOQUEADO | Controles locais passaram; URL verde depende de publicação expressamente autorizada e execução GitHub. |
| M3 / 15: SCA bloqueante | npm run sca, lockfile, workflow | npm audit --audit-level=moderate | qualidade.txt: zero vulnerabilidades | PASSOU | Consulta temporal do registry; vulnerabilidades futuras podem surgir. O controle também está no workflow. |
| M3 / 15: dois ambientes e segredos externos | .env.example, config.ts, compose.production.yml | Promover production local e retornar development | config-production.txt, config-development.txt, validacao-local.json | PASSOU | Configurações locais reais; não alegar cloud/HA. .env não deve ser versionado. |
| M3 / 15: logs estruturados e RED | platform/observability.ts, app.ts | HTTP real, logs e GET /metrics | logs-json.txt, metrics-baseline.prom, metrics-optimized.prom, qualidade.txt | PASSOU | Contadores por rota/status; reiniciam com processo; Prometheus externo não foi implantado. |
| M3 / 15: trace observável de requisição real | platform/telemetry.ts, instrumentation.mjs, jobs.trace_context | Demo e GET do trace no Jaeger | trace-real.json, validacao-local.json | PASSOU | HTTP/worker/SQL no mesmo trace; Jaeger transitório; spans não representam microsserviços inexistentes. |
| M3 / 15: SLO declarado e medido | PLANO_DE_DESEMPENHO.md, scripts/k6-load.js | Três estágios de carga controlada | k6-baseline.json, k6-optimized.json | PASSOU | Janela local de 35 s; não SLO mensal ou capacidade máxima. |
| M3 / 15: feature flag e estratégia de deploy | config.ts, PaymentService, compose.production.yml | Suspender admissão/worker e retornar configuração validada | promocao-production.txt, rollback-development.txt, validacao-local.json | PASSOU | Recreate com interrupção; rollback de configuração executado; rollback binário diferente somente proposto. |
| M4 / 30: ADR com alternativa plausível | docs/adr/0001-decisao.md | Conferir fila SQL versus Redis/BullMQ e código | ADR, testes de transação/idempotência | PASSOU | Alternativa aceita pelo escopo; revisão da decisão pelo aluno pendente. |
| M4 / 30: C4 contexto e contêiner consistentes | docs/c4/*.md, *.mmd e *.png | Mermaid CLI e inspeção dos dois PNGs | c4-render.json | PASSOU | Sem nível Component nem Redis/fila externa desenhados; cache/worker no processo. |
| M4 / 30: OpenAPI 3.1 e lint em CI | docs/openapi.yaml, schemas.ts, generate-openapi.mjs | npm run openapi:lint e contrato Ajv contra HTTP real | qualidade.txt | PASSOU | Zero erros e quatro avisos de estilo, sem regras desligadas. |
| M4 / 30: cache com tolerância e invalidação | catalog/service.ts e plano de desempenho | Unitários TTL/invalidação/em voo; métrica do cenário | qualidade.txt, metrics-*.prom | PASSOU | Limite de 100 chaves; TTL padrão 5 s; preço de pedido sempre sem cache. |
| M4 / 30: fila idempotente, retry e falha | payments/repository.ts, orders.markPaid | Concorrência, entrega duplicada, falha após efeito e limite de três entregas | qualidade.txt, demonstracao.txt, trace-real.json | PASSOU | Pelo menos uma vez com efeito idempotente; não transação distribuída/exatamente uma vez. |
| M4 / 30: k6 três estágios, antes/depois e gargalo | scripts/k6-load.js, optimize.mjs, índice 002 | Mesmo conjunto/cenário; EXPLAIN ANALYZE e métricas reais | plano-*.txt, k6-*.json, metrics-*.prom | PASSOU | Comparação combina índice e cache; planos sustentam mecanismo, sem atribuição isolada ou extrapolação para produção. |
| Entrega transversal: README, CONTRIBUTORS e IA | README.md, CONTRIBUTORS.md, docs/ia.md | Revisar contra execução/decisões do aluno | Documentos e Git real | PASSOU | Aprendizado e revisão humana não presumidos; sem PDFs definitivos nesta etapa. |
| Entrega: repositório/CI e Moodle | Ação autorizada e execução remota | Publicar, obter URL verde e comprovante de envio | Repositório criado pelo aluno; sem CI/comprovante ainda | BLOQUEADO | Não há autorização de A publicada nem comprovação de submissão oficial. |

## Correção de preparação do benchmark

A primeira execução local revelou, pela própria métrica, que o comando auxiliar Compose usado para k6 podia reaplicar defaults e ligar o cache no cenário declarado desligado. A preparação foi corrigida para propagar imagem/configuração também ao comando run, e o validador passou a exigir headers e contadores compatíveis em ambos os cenários. A execução preliminar está preservada em tmp/validacao-preliminar, fora do versionamento; não é usada como comparação oficial de cache.

O resultado canônico deve ter sourceCommit 3f55622 ou posterior e status PASSOU, com `bypass` no baseline e `hit` no otimizado. Não foi desligado threshold ou teste para contornar a falha.

## Próximos passos do gate

1. Revisar documentação/evidências e autorizar expressamente publicação do A no repositório público informado. A autorização anterior de publicação era do B.
2. Executar e verificar CI remoto, corrigindo eventual falha; só então atualizar esta matriz com URL success.
3. Conferir a revisão final identificada e preservar B. Não iniciar auditoria comparativa/PDFs antes da aprovação humana literal: `APROVO O PROJETO A; INICIAR AUDITORIA E APRESENTAÇÕES`.
4. Apresentação do aluno em 13/11; Moodle, ensaio e avaliação independente continuam ações futuras sem comprovante.
