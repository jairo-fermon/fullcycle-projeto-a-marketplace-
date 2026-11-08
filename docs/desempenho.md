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
