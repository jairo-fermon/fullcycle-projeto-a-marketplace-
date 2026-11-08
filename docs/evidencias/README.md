# Evidências reais - A

Ciclo canônico: **08/11/2026, 12:45:14-12:49:08 UTC-03:00**, código/validador `3f55622bbedc208eeef41e8214eb8def43901c73`. Arquivo principal validacao-local.json; comando `npm run validate:local -- --clean`, na raiz do A. Timestamps Z estão em UTC. Cada TXT do validador registra início, comando, configuração não secreta e exit code. Stdout e stderr foram capturados separadamente e concatenados; ordem entre canais não é cronologia perfeita.

| Arquivo(s) | Evidência |
| --- | --- |
| validacao-local.json | Host, sourceCommit, fases, horários/exit codes, cobertura, trace, seed, promoção/rollback e performance. |
| limpeza.txt, compose-config.txt, subida.txt, compose-status.txt | Banco vazio, migrations e app/PostgreSQL/Jaeger reais. |
| qualidade.txt, coverage-summary.json | Lint/fronteiras, tipos, build, OpenAPI, SCA e 58 testes (42 unitários, 14 integração, 2 contrato). |
| demonstracao.txt | Produto, pedido, tentativa, replay idempotente e pedido PAID por HTTP real. |
| trace-real.json | Resposta real do Jaeger: 15 spans, com HTTP de pagamento, submit, worker, pedido e SQL. |
| seed-primeira.txt, seed-repetida.txt, seed-sql.txt | Dois seeds de 100 mil pedidos e contagem/coerência por SQL; origem sintética separada. |
| imagem-id.txt, imagem-preservada.txt, promocao-production.txt, config-production.txt, rollback-development.txt, config-development.txt | Imagem identificada, ambientes, flag 503 e rollback de configuração; não rollback binário diferente. |
| plano-baseline.txt, plano-optimized.txt | EXPLAIN ANALYZE real sem/com índice; mostram gargalo/intervenção. |
| config-baseline.txt, config-optimized.txt, k6-baseline.txt, k6-optimized.txt | Mesmo cenário/carga com configuração preservada inclusive ao iniciar k6. |
| k6-baseline.json, k6-optimized.json | Resultados reais dos três estágios por cenário; k6-summary.json contém a última fase. |
| metrics-baseline.prom, metrics-optimized.prom, logs-json.txt | RED e estado do cache: bypass no baseline, hit/miss no otimizado; JSON com correlação. |
| node-container.txt, postgres-container.txt, docker-version.txt, docker-resources.txt, compose-version.txt, k6-version.txt | Versões/recursos efetivos; não versões presumidas. |
| c4-render.json | Comandos/versão Mermaid, dimensões/hashes dos dois PNGs e inspeção visual. |

O fluxo e os números são observados, sem dados sintéticos disfarçados de vendas. Os 100 mil pedidos são explicitamente origin=synthetic_seed. Respostas do demo contêm identificadores de teste, não segredos de autenticação.

Registros preliminares redundantes estão em tmp/, fora do versionamento. A primeira preparação de cache do benchmark foi invalidada e corrigida antes do ciclo canônico; detalhes na matriz e no desempenho. Não foi escolhida a execução de menor latência para ocultar falha de preparação.

C4 é artefato de arquitetura renderizado, não captura de implantação. O trace JSON é consulta real anterior; o Jaeger pode descartá-lo ao reiniciar. Fonte de cada percentual é o relatório V8, sem exclusões em src/. Nenhum destes arquivos comprova por si só envio ao Moodle, apresentação ou revisão humana.
