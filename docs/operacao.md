# Operação e limites demonstrados - A

## Dois ambientes e segredos

Development e production local usam a mesma imagem imutável de aplicação, com APP_ENV/loglevel externos. `.env` contém senha aleatória local e é ignorado; `.env.example` tem nomes e exemplos sem senha fixa. O Compose injeta PG* no app e POSTGRES_* no banco. Não imprimir docker compose config completo com segredos; usar --quiet.

O pipeline usa PostgreSQL efêmero, APP_ENV=test e senha derivada do identificador da execução. Não são credenciais de ambiente real. Tests não acessam volume do app nem banco de demonstração. Não foram criados contas, secrets de nuvem ou recursos pagos.

## Feature flags e deploy

PAYMENT_PROCESSING_ENABLED false: POST /payments recebe 503 antes de registrar tentativa; worker fica paused e não consome jobs. true retoma após recriar app. CATALOG_CACHE_ENABLED false: consulta catálogo no PostgreSQL e retorna x-cache=bypass; true permite hit/miss conforme TTL.

Estratégia: recreate local com breve interrupção, imagem previamente validada preservada e rollback de configuração. O ciclo efetivamente executou production com flag false, verificou HTTP 503, retornou a development/true e conferiu dados. Imagem/tag e resultados exatos estão em validacao-local.json. Não houve troca para uma versão binária defeituosa nem rollback binário executado; não declarar isso como ensaio realizado.

Procedimento proposto para futura nova versão: registrar image ID e tag da versão atual, validar nova imagem em banco isolado, aplicar migrations compatíveis e promover. Se falhar, reaplicar APP_IMAGE da versão anterior com configuração compatível e health check. Não desfazer migration destrutiva automaticamente; planejar expansão/contração para mudança incompatível. Não chamar esse arranjo de rolling, blue/green, alta disponibilidade ou deploy em nuvem.

## Fila durável

Inspeção real, sem senha no terminal:

```powershell
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT state,deliveries,last_error_code,count(*) FROM payments.jobs GROUP BY state,deliveries,last_error_code;"'
```

READY aguarda available_at; DONE tem resultado; DEAD encerrou processamento. Tentativa DECLINED é uma recusa simulada e pode ter job DONE; FAILED é falha de processamento. Recibos e atualização idempotente do pedido protegem duplicatas. A fila oferece pelo menos uma entrega, com até três tentativas, sem cobrar dinheiro real. Jobs DEAD exigem investigação; o escopo não inclui painel ou endpoint administrativo.

## Observabilidade real

Request ID: x-request-id no HTTP e reqId no log. Trace ID: x-trace-id de chamada de negócio e contexto W3C persistido no job. O SDK inicia antes da aplicação, exporta OTLP para Jaeger e fecha no shutdown. Spans de SQL envolvem queries reais, sem gravar SQL bruto/valores; não são spans fictícios para uma captura.

Métricas RED consultáveis em /metrics:

- Rate: incremento de http_requests_total; taxa exige janela, por exemplo `sum(rate(http_requests_total[1m]))` em Prometheus, caso conectado. Não foi implantado Prometheus neste projeto.
- Errors: http_errors_total por rota/status >=400. Diferenciar erro esperado 409 de falha 5xx ao interpretar.
- Duration: histograma http_request_duration_seconds em segundos. Exemplo de consulta com coletor Prometheus externo: `histogram_quantile(0.95, sum by (le,route)(rate(http_request_duration_seconds_bucket[1m])))`.
- Cache e fila: catalog_cache_requests_total e payment_job_results_total; não são contagem de vendas.

Exemplos PromQL acima são consultas propostas para um coletor externo, não evidência de Prometheus implantado. As evidências efetivas do projeto vêm da rota /metrics, Jaeger e k6, preservadas em docs/evidencias.

## Trace consultado

O arquivo trace-real.json contém a resposta real do Jaeger com HTTP POST /payments, payments.submit, payments.process_job, orders.mark_paid e cliente PostgreSQL no mesmo trace. A requisição foi assíncrona: o span HTTP pode terminar antes dos spans do worker. Esse intervalo não é falha de causalidade; o traceparent salvo permite relacioná-los.

Jaeger roda em memória no ambiente local e pode descartar traces ao reiniciar. O JSON preservado não é uma nova consulta ao vivo. Para obter outro: rodar npm run demo, usar o paymentTraceId real e abrir a UI ou consultar /api/traces/{id} da versão 2.23.0. A API de serviços /api/v3/services foi verificada; não depender do antigo /api/services, que retorna 404 nesta versão.

## Riscos assumidos

Uma réplica implica interrupção em recreate. Cache local pode ficar desatualizado no limite documentado e não coordena instâncias. PostgreSQL é dependência comum da API/fila; backup, HA e retenção longa não foram implantados. SLO é da janela de carga controlada; não é garantia mensal. A API acadêmica não implementa autenticação/controle de acesso de produção.
