# Desempenho e evidências reais - Projeto A

Status: **PASSOU no cenário local declarado**. Ciclo canônico em 08/11/2026, das **12:45:14 às 12:49:08**, America/Sao_Paulo (UTC-03:00). Fonte: `evidencias/validacao-local.json`, sourceCommit `3f55622bbedc208eeef41e8214eb8def43901c73`. Datas ISO com Z nos arquivos estão em UTC; subtrair 3 horas para horário local.

## Ambiente, dados e método

Host Windows build 26200; Intel Core i5-1135G7 @2.40 GHz; 8 processadores lógicos; memória física observada 16.893.386.752 bytes. Docker/WSL informou 8 CPUs e 8.185.405.440 bytes disponíveis ao engine. Node do host v24.19.0; Node do contêiner v24.22.2; PostgreSQL 17.11; Docker Engine 29.1.3; Compose v2.40.3-desktop.1; k6 v1.3.0+dirty, sufixo reportado pela imagem oficial preservado nas evidências. Jaeger 2.23.0 recebe OTLP real.

Mesma imagem, host, base e contrato em ambos os ensaios. Seed criou **100.000 pedidos sintéticos e 5.000 produtos**, em lotes de 5.000; repetição confirmou os mesmos 100.000 pedidos. Havia mais um pedido real da demonstração, PAID. SQL de coerência retornou **zero inconsistências**. A carga fez apenas leitura; não alterou os dados entre cenários. O B continuou em contêineres próprios e não foi modificado.

Baseline: índice de listagem removido e cache desligado. Otimizado: mesmo SQL, índice composto habilitado e cache ligado. Cada fase recria apenas app, fora da janela medida, e aquece dez consultas de cada rota. A configuração também é passada ao comando k6/Compose para impedir reaplicação de defaults. Headers e métricas são verificados; não basta declarar uma flag.

Roteiro k6: exatamente **três estágios** (10 s até 5 VUs; 15 s até 15 VUs; 10 s até zero). Cada iteração faz GET /orders?status=PENDING&limit=20&page=1 e GET /catalog/products?category=category-01&limit=20, depois pausa de 100 ms. Duração configurada 35 s; duração efetiva cerca de 35,1 s com conclusão da última iteração. Terminal inclui tempo adicional de preparação do contêiner.

SLO pré-declarado no [plano](PLANO_DE_DESEMPENHO.md): p95 <500 ms por rota na janela local; zero falha HTTP e 100% dos checks de resposta. Esse SLO não é um objetivo mensal de disponibilidade nem garantia de capacidade máxima.

## Resultado observado

| Indicador | Baseline | Otimizado |
| --- | ---: | ---: |
| Requisições HTTP | 2.652 | 4.740 |
| Iterações completas | 1.326 | 2.370 |
| Throughput, requisições/s | 75,60 | 135,04 |
| p95 GET /orders | **172,85 ms** | **4,30 ms** |
| p95 GET /catalog/products | **18,41 ms** | **2,38 ms** |
| Falhas HTTP | 0% | 0% |
| Checks aprovados | 100% | 100% |
| Resultado dos thresholds / código de saída | PASSOU / 0 | PASSOU / 0 |

Valores completos, sem arredondamento, em `k6-baseline.json` e `k6-optimized.json`; terminais em TXT datados com comandos. k6-summary.json contém a última fase. No formato legado de summary do k6, false no campo de threshold significa que ele não falhou; conferir também terminal e exit code.

## Gargalo demonstrado e intervenção

`plano-baseline.txt`: EXPLAIN ANALYZE mostrou Seq Scan paralelo, Sort top-N e Gather Merge. Tempo de execução dessa consulta isolada: **37,589 ms**. Filtrar cerca de 80 mil pendentes e ordenar o conjunto para devolver 20 itens consome trabalho desnecessário sem um índice apropriado.

`plano-optimized.txt`: **Index Scan usando orders_status_created_id_idx**, sem Sort do conjunto. Tempo observado da consulta isolada: **0,521 ms**. Índice `(status,created_at DESC,id DESC)` atende filtro e ordenação e permite parar após os primeiros registros. Esses tempos de EXPLAIN não são o p95 HTTP: medem outra camada e uma execução individual.

Cache real: baseline registrou **1.336 bypass**, sem hits; otimizado registrou **2.365 hits e 15 misses** (incluem aquecimento). Expiração/concor­rência podem produzir mais de um miss na mesma renovação; não foi implementado single-flight. Contadores foram coletados por fase, após recriação do processo, em `metrics-baseline.prom` e `metrics-optimized.prom`.

O ensaio combina índice e cache. O plano mostra o mecanismo de redução do trabalho SQL, e os contadores mostram o uso do cache; não foi estimada a contribuição percentual isolada de cada mudança. O aumento de throughput é da carga fechada com pausa/concorrência fixadas, não uma medição da capacidade máxima de produção.

## Validade, tentativa preliminar e limitações

A primeira preparação do benchmark reaplicava defaults do Compose ao iniciar k6 e acabava ligando cache no baseline. A revisão dos contadores identificou o erro. A passagem de configuração foi corrigida e o validador passou a exigir estado real por header/métrica; o ciclo completo foi repetido desde banco vazio. A tentativa preliminar está preservada em tmp/validacao-preliminar e não é usada como comparação oficial de cache. Nenhum threshold foi reduzido/desligado para produzir aprovação.

Não houve host dedicado ou reserva exclusiva de CPU; navegador, Codex, serviços de saúde e o B compartilham o computador. A suíte, seed, build e renderização dos C4 estavam concluídos antes das janelas finais de carga. É uma comparação descritiva de dois ensaios no mesmo cenário, com planos SQL e contadores, sem intervalo estatístico de confiança ou alegação de ganho universal. Outras distribuições de dados/páginas/categorias podem ter resultados diferentes. Não existe gráfico/screenshot fabricado.

Cache tolera desatualização no TTL documentado (padrão 5 s desde inserção, mais consulta em voo), limita 100 chaves e invalida ao cadastrar produto. Preço para criar pedido sempre é consultado sem cache; não confundir desempenho de consulta com integridade de valores de compra.

## CI e escopo da evidência

[CI do código validado: success](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42497720872), 58 testes e cobertura 98,06% linhas/95,47% branches. O workflow verifica qualidade/SCA/testes com PostgreSQL; os números de k6, seed, trace e deploy deste relatório foram medidos no ciclo local identificado acima. Publicação não transforma medições locais em medições do runner GitHub.

## Reprodução

```powershell
npm run env:init
npm run validate:local -- --clean
```

**--clean apaga dados somente do A**; não usar em dados importantes. O ciclo prepara base, verifica duas execuções do seed, testa contratos/coverage/SCA, comprova trace/flag/ambientes/rollback e executa os dois cenários. Registra comandos, configurações não secretas, horários e exit codes. Alterações futuras podem modificar resultados; preservar evidências anteriores antes de substituir arquivos.

Para inspecionar plano atual: `docker compose exec -T app node scripts/optimize.mjs explain`. O sistema termina com índice e cache habilitados. Para comparar manualmente, seguir as etapas/configurações do validador, incluindo a mesma configuração no comando Compose que inicia k6; apenas mudar um comando de subida não é suficiente.

## Hardening de 08/11/2026: investigação e medições adicionais

As seções anteriores descrevem o ciclo canônico original e sua CI histórica. Esta seção registra execuções novas e não substitui os números anteriores. Baseline de código pública: `ca2ade99c6c9c6b6be541fad59ad5aee7b77b831`; scripts adicionais identificados por SHA-256 em [matrix.json](evidencias/hardening-a-20261108/matriz/matrix.json). Estado da candidata e da publicação em [RELATORIO_HARDENING_A.md](../RELATORIO_HARDENING_A.md).

### Pico histórico: conclusão limitada pelos dados

A repetição da pré-auditoria registrou máximo de pedidos **6.165,863163 ms**, p95 de pedidos **6,0197886 ms**, p95 do catálogo **3,164019 ms** e zero erros HTTP. O máximo agregado de waiting do cliente foi 6.165,803541 ms. Isso não identifica a origem da espera. Os 3.601 logs request_completed disponíveis tiveram máximo de duração no servidor 369,143125 ms. São janelas de medição diferentes e não há requestId/traceId/timestamp da amostra k6 que permita correlacioná-las.

Não existem séries históricas de CPU, locks, espera do pool, eventos de GC ou trace daquela requisição. Fila/cache têm testes, mas isso não demonstra sua participação no pico. **CAUSA INDETERMINADA COM OS DADOS DISPONÍVEIS.** Não atribuir ao Docker, GC, worker, cache ou banco sem correlação. [Extração dos dados históricos e limitações](evidencias/hardening-a-20261108/pico-historico.json). Os arquivos históricos integrais ficam no pacote de pré-auditoria e em tmp local; não foram alterados.

### Reprodução completa obtida do GitHub

Clone direto limpo de ca2ade9, volume novo próprio, Compose `fullcycle-a-hardening-20261108`, API 3003/Jaeger 16689; nenhuma remoção de volume. `node scripts/validate-local.mjs`, **sem --clean**, passou de 18:49:35.774Z a 18:52:38.189Z (15:49–15:52 local). Mesmo roteiro original de três estágios, 100 mil pedidos sintéticos, imagem e aquecimento equivalentes: p95 pedidos **94,48 → 6,08 ms**, catálogo **8,51 → 3,47 ms**; 3.172 → 4.660 requests, 90,41 → 132,86 req/s, zero erros. É outra comparação combinada de índice+cache, não contribuição isolada. [Registro completo](evidencias/hardening-a-20261108/reproducao/validacao-local.json), summaries baseline/optimized preservados nessa mesma pasta. O k6-summary genérico do clone foi posteriormente sobrescrito pela matriz e não foi usado para representar essa comparação.

### Matriz de quatro configurações, duas rodadas

Execução **18:55:15.537Z–19:02:03.616Z** (15:55–16:02 local). Mesmo host Windows/i5-1135G7, 8 CPUs lógicas, 16.893.386.752 bytes físicos; engine Docker com 8 CPUs/8.185.405.440 bytes. Versões: Node contêiner 24.22.2, PostgreSQL 17.11, k6 1.3.0+dirty, Jaeger 2.23.0. Imagem de aplicação em todas as fases: `sha256:76894841c87dddc94c87f7d379d5e8532b60e8871ffbc64f4c601b204f150a6b`.

Dataset idêntico antes/depois: 100.000 pedidos sintéticos + 1 pedido da demonstração; 5.001 produtos. Fingerprint MD5 de pedidos `a9259c341d06a7260f624941d19f2bc7`, produtos `be85c5d93e9ee39b53903b8b3598a0b8`. São checks de igualdade das colunas declaradas na consulta, não hashes de segurança. Nenhuma escrita da carga; seed/build/qualidade/manual fora da janela. B e serviços originais compartilhavam o host; não havia reserva exclusiva de recursos.

Em cada fase: recriação do app fora da janela, dez aquecimentos por rota, mesmos três estágios (10 s/5 VUs, 15 s/15 VUs, 10 s/0), pausa 100 ms, 35 s configurados. A segunda rodada inverte a ordem. Configurações são propagadas inclusive ao Compose que inicia k6; image ID/índice/headers/contadores verificam estado real. Os 8 summaries, terminais, planos, métricas e recursos estão na [pasta matriz](evidencias/hardening-a-20261108/matriz).

Latências em ms. I=índice composto, C=cache. N é a quantidade de amostras **por rota** (uma chamada por iteração, confirmada pelo count exportado). HTTP é o total das duas rotas. p50=mediana.

| Rodada | I/C | Pedidos p50 | p95 | p99 | Máx. | Catálogo p50 | p95 | p99 | Máx. | N/rota | HTTP | req/s |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 0/0 | 49,20 | 95,99 | 125,57 | 172,31 | 2,77 | 9,97 | 16,50 | 35,99 | 1554 | 3108 | 88,67 |
| 1 | 1/0 | 2,91 | 6,55 | 9,77 | 47,36 | 3,64 | 7,74 | 10,40 | 20,11 | 2278 | 4556 | 130,08 |
| 1 | 0/1 | 42,83 | 90,38 | 139,62 | 294,42 | 0,93 | 4,37 | 10,63 | 27,59 | 1627 | 3254 | 92,98 |
| 1 | 1/1 | 2,79 | 5,33 | 8,82 | 35,49 | 1,26 | 3,02 | 5,87 | 9,14 | 2340 | 4680 | 133,69 |
| 2 | 1/1 | 2,95 | 5,92 | 10,41 | 47,80 | 1,32 | 3,36 | 6,50 | 16,14 | 2332 | 4664 | 133,14 |
| 2 | 0/1 | 46,57 | 98,30 | 142,62 | 274,14 | 0,98 | 5,12 | 9,63 | 23,09 | 1596 | 3192 | 90,98 |
| 2 | 1/0 | 2,81 | 6,02 | 11,38 | 45,37 | 3,50 | 7,88 | 12,95 | 51,72 | 2282 | 4564 | 130,14 |
| 2 | 0/0 | 46,24 | 95,64 | 142,30 | 305,33 | 2,69 | 10,37 | 23,63 | 101,36 | 1572 | 3144 | 89,82 |

Todas as oito execuções: **PASSOU**, zero erros HTTP, 100% checks, p95 <500 ms em ambas as rotas e exit 0. Nenhum pedido/catálogo excedeu 500 ms; máximo da matriz de pedidos 305,33 ms. Não houve novo slow trace para capturar. O trace real de 15 spans do fluxo de pagamento foi obtido separadamente no ciclo completo, não de uma requisição lenta da matriz. O teste suplementar do log lento usa tempo **sintético** 600 ms em VM e não é benchmark/HTTP real.

Resultados descritivos coerentes com os planos e contadores: pedidos sem índice p95 90,38–98,30 ms; com índice 5,33–6,55 ms. Catálogo sem cache p95 7,74–10,37 ms; com cache 3,02–5,12 ms. Esses intervalos são mínimo/máximo dos p95 observados, não percentis combinados. Não calcular média de p95 como percentil global. Cada mudança também altera o ritmo da carga fechada; não há estimativa percentual causal isolada ou capacidade máxima.

### Recursos, restauração e limitações

Foram coletadas cinco amostras Docker/PG por execução, 40 no total, incluindo k6 quando já ativo. Pausa nominal de 5 s entre coletas; duração dos comandos aumenta o intervalo efetivo. Os NDJSON preservam CPU, memória, sessões, sessões bloqueadas, locks aguardando e jobs READY. CPU Docker pode exceder 100% por processo multicore. Nenhuma sessão bloqueada foi observada nessas amostras; isso não exclui locks transitórios fora dos instantes coletados. GC, espera específica do pool e escalonamento do host não foram instrumentados. Nenhuma causa do pico antigo pode ser inferida dessas novas séries.

O runner verificou a restauração do índice e de cache=true, payments=true, APP_ENV=development, logLevel=info. Fingerprints de dados ficaram iguais. Depois da matriz, a demonstração manual criou mais um produto/pedido/pagamento; a contagem posterior 5.002 produtos não é drift durante o benchmark. O ambiente auxiliar foi encerrado com `docker compose down`, preservando o volume. Serviços originais A/B continuaram separados.

Duas repetições curtas no mesmo computador, sem randomização completa, host dedicado ou intervalo estatístico de confiança. Ordem inversa reduz dependência de ordem, não elimina ruído. Instrumentação tem overhead em todos os cenários. O ensaio não demonstrou o pico histórico novamente e não prova ausência de caudas longas em outras condições. Nenhuma nova otimização de negócio foi feita.

### Reprodução segura da matriz

Usar clone dedicado, `.env` com senha nova, portas próprias e COMPOSE_PROJECT_NAME=fullcycle-a-benchmark-<identificador>. Preparar `npm run env:init`, ajustar configuração, subir `docker compose up --build -d --wait` e executar separadamente `docker compose exec -T app node scripts/seed.mjs`. Conferir que é base descartável isolada. Então, `BENCHMARK_ISOLATED=true` no ambiente e `node scripts/benchmark-matrix.mjs` (sintaxe PowerShell no README). O runner recusa a instalação padrão e diretório de saída existente. Ele altera o índice do banco indicado e recria app; não usar com dados importantes. Não executa seed nem exclui dados/volumes. Rodadas e caminho podem ser definidos em BENCHMARK_ROUNDS/BENCHMARK_OUTPUT; preservar resultados anteriores.

## Investigação complementar do host

Após o hardening, o aluno pediu investigar antes de aprovar. Foi recuperado evento Windows **System/stornvme129/Record31143**, às **16:11:54.251982Z (13:11:54 local)**, dentro do intervalo sem conclusões HTTP de **16:11:50.351Z–16:11:56.020Z**. O Docker mantém seus dados no disco NVMe do C:, associado ao adaptador indicado. Conclusão atualizada: **incidente de armazenamento comprovado e causa ambiental provável do pico**, com forte correlação temporal. Não há identificação individual da amostra k6 antiga nem diagnóstico do motivo interno do reset. A classificação indeterminada anterior foi preservada como histórica.

Cinco cargas diagnósticas adicionais, mesmas rotas/três estágios/aquecimento, com logs por requisição, GC/event loop e amostras PG: **23.474 requests, zero erros, 100% checks e nenhuma amostra >500 ms**, sem novo evento129 nos intervalos. p95 de pedidos entre **4,26 e 8,08 ms**, máximo de pedidos **93,98 ms**; catálogo p95 **2,37–4,06 ms**, máximo **46,20 ms**. São intervalos de resultados individuais, não percentis combinados. A instrumentação tem overhead e não substitui a matriz original. Novas medições não permitem excluir com certeza todas as causas do episódio antigo.

[Relatório com cronologia, evidências, limitações e resposta técnica](INVESTIGACAO_PICO.md). Código/testes/dependências/infra preservados; sem manutenção de hardware ou falha induzida. Publicação deste complemento e CI do novo SHA ainda pendentes; CI08ea873 permanece histórica até nova publicação.
