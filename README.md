# Projeto A — Full Cycle

Marketplace como **monólito modular** com exatamente três módulos de negócio: **Catálogo, Pedidos e Pagamento**. Fluxo real: cadastrar/listar produto -> criar pedido com preço consultado no catálogo -> enfileirar pagamento simulado -> processar resultado -> consultar pedido pago. A simulação é determinística e auditável; não existe cobrança, gateway ou conta de pagamento.

Trabalho individual de Jairo Fermon. Projeto independente do B, com banco, volumes, portas, configuração, Git e testes próprios. O B aprovado permanece na revisão `7a617593545cbcfdeb18778eefaffabb1b8bc430`.

## Estado e leitura inicial

Validação técnica local executada em 08/11/2026: [matriz de aceite](docs/ACEITE_A.md), [desempenho](docs/desempenho.md) e [demonstração](docs/DEMONSTRACAO.md). O aluno criou o [repositório público do A](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-), com hífen final no nome. Publicação e CI remoto ainda aguardam autorização/execução; não confundir pipeline escrito com execução verde.

## Preparação e subida

Pré-requisitos: Node 24 LTS, npm 11, Docker Desktop Linux e Compose v2; internet na primeira instalação. Verificar `node --version`, `npm --version`, `docker info` e `docker compose version`. Portas locais padrão: API 3001 e Jaeger 16687; configuráveis no `.env`. PostgreSQL não expõe porta ao host. Não depende de instalar PostgreSQL, Redis ou k6 no Windows.

Na raiz deste projeto, uma vez: `npm run env:init`. Usa somente Node para criar `.env` com senha aleatória; preserva arquivo existente e não mostra segredo. `.env.example` explica as variáveis e `.gitignore` exclui o arquivo real.

Depois dessa preparação explícita, subir em **um comando**:

```powershell
docker compose up --build -d --wait
```

Sobe app/worker, PostgreSQL e Jaeger; banco saudável precede migrations transacionais e abertura HTTP; health da API consulta banco real. Volume de negócio `fullcycle-a-marketplace_marketplace-data`. Para parar mantendo dados: `docker compose down`.

```powershell
docker compose ps
Invoke-RestMethod http://127.0.0.1:3001/health
npm run demo
```

O demo cria produto de 1.500 centavos, pedido com duas unidades (3.000 centavos), tentativa de pagamento, repete a mesma chave sem duplicar, aguarda o worker e verifica pedido PAID. Usa IDs novos, imprime respostas reais e falha se o fluxo estiver incorreto. Outra porta no `.env` é lida automaticamente; `BASE_URL` externo permite outro endereço.

## Rotas e regras

Contrato completo em [OpenAPI 3.1](docs/openapi.yaml). Os exemplos de IDs na documentação são ilustrativos; usar IDs reais retornados pela aplicação ou pelo seed.

| Rota | Comportamento |
| --- | --- |
| POST /catalog/products | 201; sku único, nome, categoria e preço em centavos. |
| GET /catalog/products?category=geral&limit=20 | 200; até 50 produtos, ordenados por nome/ID. Header x-cache: miss, hit ou bypass. |
| POST /orders | 201; itens productId/quantity, sem preço enviado pelo cliente. |
| GET /orders/{id} | 200 com itens, total, status e referência de pagamento. |
| GET /orders?status=PENDING&limit=20&page=1 | 200; até 50 resumos/página, até página 5000; data/ID decrescentes. Sustenta o benchmark com volume. |
| POST /payments | 202 na criação; exige header Idempotency-Key UUID e body orderId/outcome (approve ou decline). Mesmo payload/chave recebe 200 com a tentativa existente. |
| GET /payments/{id} | QUEUED, SUCCEEDED, DECLINED ou FAILED; amountCents, processedAt e deliveries para auditoria. |
| GET /health | 200 se PostgreSQL responde; 503 se indisponível. |
| GET /metrics | Contadores/histogramas reais em formato Prometheus. |

UUID malformado/entrada inválida: 400; inexistente: 404; SKU ou idempotência conflitante/pedido já pago: 409; corpo >64 KiB: 413; tipo de conteúdo não suportado: 415; feature flag desligada: 503; falha interna: 500 genérico. Erros de negócio têm `error.code`, `message`, `requestId`; header x-request-id sempre correlaciona logs. Chamadas de negócio válidas também têm x-trace-id.

Pedido aceita 1 a 100 produtos distintos, quantidade inteira 1 a 1000; preço vem do catálogo (1 a 1.000.000 centavos). Total inteiro seguro <=100.000.000.000 centavos. Produto ausente impede criação; transação impede pedido parcial. Pedido PENDING torna-se PAID apenas por resultado SUCCEEDED; uma recusa mantém PENDING e permite nova tentativa com outra chave. Não há saldo, estoque ou autenticação neste escopo acadêmico.

## Fronteiras e arquitetura

`src/modules/catalog/index.ts`, `orders/index.ts` e `payments/index.ts` são as entradas públicas. Direção: Pagamento -> API pública de Pedidos -> API pública de Catálogo. O módulo só consulta suas próprias tabelas. `src/app.ts` monta as dependências; `src/platform/` contém infraestrutura técnica, sem um quarto domínio de negócio.

Schemas PostgreSQL têm os mesmos donos: catalog, orders, payments. Não há FK entre schemas de módulos; consistência do fluxo cruza APIs públicas. Migrations são orquestradas antes do HTTP; edição de migration aplicada é detectada por checksum. SQL é parametrizado. `npm run boundaries` verifica imports privados, direção de dependência e SQL de outro módulo; a regra também tem testes com violações propositalmente rejeitadas.

SOLID concreto: OrderService depende de CatalogPort e OrderRepository, sem importar driver PostgreSQL. Repository separa negócio de persistência; Strategy seleciona approve/decline sem misturar essa decisão com claim/transação/retry da fila. [ADR único com alternativa plausível e trade-offs](docs/adr/0001-decisao.md).

[C4 Contexto](docs/c4/contexto.md) e [C4 Contêiner](docs/c4/conteiner.md), com fontes Mermaid e PNGs renderizados/inspecionados. O worker/cache estão no processo Node; fila/recibos estão no PostgreSQL, e Jaeger é apenas observabilidade. Não confundir módulo com contêiner ou microsserviço.

## Fila, cache e idempotência

Tentativa e job são persistidos juntos. Worker usa `FOR UPDATE SKIP LOCKED`; cada pagamento tem recibo único. Atualizar o pedido e gravar recibo são transações distintas: se houver falha entre elas, o retry repete a operação pública de Pedidos, protegida pela mesma paymentReference. É entrega **pelo menos uma vez com efeito idempotente**, não execução exatamente uma vez.

Até três entregas; espera de 1 s e 2 s nas primeiras falhas transitórias; terceira falha vira job DEAD e tentativa FAILED. Erro de negócio permanente encerra imediatamente. O banco registra apenas código seguro de erro. Testes reais forçam falha depois do efeito, duplicata, concorrência, retry e limite; doubles de falha existem somente em testes.

Cache local de listagem: TTL padrão 5 s, no máximo 100 chaves; cadastro invalida tudo e protege contra consulta antiga em voo. Escrita externa pode aparecer após expiração; cache é por processo. **Preço usado para criar pedido sempre consulta banco**, mesmo se a listagem estiver antiga. [Plano de p95, tolerância e fila](docs/PLANO_DE_DESEMPENHO.md). Baseline/otimizado no benchmark são intervenções reais, sem atraso artificial.

## Seed de 100 mil pedidos

```powershell
docker compose exec -T app node scripts/seed.mjs
```

Cria 5.000 produtos e 100.000 pedidos sintéticos em lotes de 5.000, com IDs/datas/regras previsíveis; 20% têm pagamentos sintéticos SUCCEEDED e recibos coerentes. Origem marcada `synthetic_seed`, separada de chamadas reais da API. Repetir preserva a contagem; não há dump grande versionado. Contagem e coerência reais em `docs/evidencias/seed-sql.txt`. Não apresentar registros sintéticos como vendas ou indicadores comerciais reais.

```powershell
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT origin,count(*) FROM orders.orders GROUP BY origin;"'
```

## Testes, cobertura e SCA

Em contêiner, sem instalar dependências locais:

```powershell
docker compose --profile test run --build --rm tests sh -c 'npm run lint && npm run typecheck && npm run build && npm run openapi:lint && npm run sca && npm test'
```

Usa PostgreSQL separado em tmpfs e ambiente test. A suíte exige APP_ENV=test e PGDATABASE terminando em `_test` antes de limpar dados. Cada teste de integração prepara estado independente; arquivos rodam sem paralelismo para compartilhar só esse banco descartável. HTTP é real, em porta efêmera; não há skips para ocultar ausência do banco. Contrato Ajv valida schemas OpenAPI contra respostas reais e inclui uma resposta adulterada que deve ser rejeitada.

Mínimos declarados: **80% linhas e 75% branches** em todo `src/`, fiscalizados no Vitest e na CI, sem exclusões. Bootstrap/manutenção em scripts são verificados pelo ciclo completo; não entram no percentual de src. Resultados completos em `coverage/report/` e resumo pequeno nas evidências.

Alternativa local: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run openapi:lint`, `npm run sca`. Integração requer PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD e APP_ENV=test externos. `npm start` também permite execução local configurada por essas variáveis; não imprimir credenciais em comandos/histórico.

SCA usa `npm audit --audit-level=moderate` e falha em alerta moderado ou superior, incluindo desenvolvimento. O override minimatch 11.0.5 corrige vulnerabilidade transitiva das ferramentas de lint, revalidada com testes; não suprime alerta. CI instala, faz lint/fronteiras, tipos, build, OpenAPI, SCA e testes com banco real. Status verde só será declarado após execução GitHub efetiva.

## Ambientes, feature flag e estratégia de deploy

Development é o Compose padrão, APP_ENV=development e logs info. Production local usa a mesma imagem, APP_ENV=production e logs warn:

```powershell
docker compose -f docker-compose.yml -f compose.production.yml up --build -d --wait
```

Para retornar ao desenvolvimento: `docker compose up --no-build -d --wait app`. Segredos são externos em ambos. Production aqui é configuração executada localmente, sem alegação de nuvem, alta disponibilidade ou exposição pública da API. Publicação do código no GitHub não é deploy da aplicação.

Feature flag `PAYMENT_PROCESSING_ENABLED=false` suspende admissão com 503 e pausa worker, preservando jobs existentes. Alterar ambiente e recriar app para aplicar; não há alteração remota sem controle ou plataforma extra de flags. `CATALOG_CACHE_ENABLED` permite medir cache ligado/desligado. Ambas são booleanas estritas.

Estratégia escolhida: **recreate com imagem validada preservada e rollback de configuração**. Uma instância tem interrupção curta durante recriação; não prometer rolling/zero downtime. O validador registrou image ID, promoveu configuração production com pagamentos suspensos, comprovou 503, retornou a development e conferiu o pedido persistido. Rollback de uma versão binária diferente é procedimento documentado, não ensaio executado: selecionar a imagem anterior pelo ID/tag preservado e reaplicar configuração compatível; não reverter migration destrutiva automaticamente. Detalhes em [operação](docs/operacao.md).

## Logs, RED, trace e desempenho

```powershell
docker compose logs --no-color --no-log-prefix app
Invoke-WebRequest http://127.0.0.1:3001/metrics | Select-Object -ExpandProperty Content
```

Logs JSON têm reqId, método, rota normalizada, status, duração e traceId de chamadas de negócio. Sem payload, header de autorização, segredo ou SQL bruto. RED: taxa derivada de `http_requests_total`, erros em `http_errors_total` e duração em `http_request_duration_seconds`; contadores reiniciam com app. `catalog_cache_requests_total` e `payment_job_results_total` registram eventos reais.

OpenTelemetry exporta spans reais para Jaeger por OTLP HTTP. Contexto W3C é persistido no job e retomado pelo worker. Ver Jaeger em `http://127.0.0.1:16687`; usar o paymentTraceId impresso pelo demo. `docs/evidencias/trace-real.json` preserva um trace efetivamente consultado, com HTTP -> submit -> fila/worker -> markPaid -> SQL. São spans manuais de operações reais; não há serviços de negócio separados inventados. Jaeger usa memória transitória no arranjo local.

SLO de leitura para a janela local de carga: p95 <500 ms por rota de pedidos/catálogo, zero erro HTTP e 100% dos checks. [Relatório com antes/depois, ambiente e planos SQL](docs/desempenho.md). Teste individual:

```powershell
docker compose --profile tools run --rm k6
```

Precisa do seed para retornar 20 itens por rota. Os três estágios estão em scripts/k6-load.js. O comando substitui o resumo k6-summary.json; preservar resultados comparativos quando necessário.

## Repetir o gate local completo

```powershell
npm run validate:local -- --clean
```

**--clean apaga dados e volumes somente do A**, inclusive seus pedidos locais; não afeta o B. Sem --clean preserva o banco e repete as verificações. O ciclo cobre config/subida, testes/coverage/SCA/contrato, demo/trace, seed duas vezes, SQL, production/flag/rollback e carga antes/depois. Registra comando, início/fim e exit code por etapa em `docs/evidencias/validacao-local.json`.

O benchmark remove e restaura temporariamente o índice de leitura e recria o app para alternar cache. A aplicação sofre breves interrupções preparatórias, fora das janelas medidas. Não executar o gate contra dados importantes ou durante uso real.

## Troubleshooting e limites

- Docker: `docker info` precisa retornar servidor. CLI instalada não basta. Corrigir engine antes de alegar Compose validado.
- Senha não definida: `npm run env:init`; editar .env existente se vazio. Alterar .env não altera automaticamente senha de banco com volume já criado.
- Migração alterada: restaurar arquivo aplicado e criar nova migration. Não apagar histórico para esconder problema.
- Pagamento QUEUED: conferir flag, worker e jobs READY/DEAD. FAILED não significa recusa comercial; indica falha de processamento após política de entrega.
- Trace demora: exportação é assíncrona; usar ID real e aguardar lote. API estável de serviços do Jaeger 2.23 é `/api/v3/services`; a consulta de trace usada nas evidências foi `/api/traces/{id}`, interface interna dessa versão fixada.
- Cache não é global entre réplicas; desenho usa uma instância. SLO de 35 s é evidência controlada, não contrato mensal ou capacidade máxima.
- Linter OpenAPI pode emitir avisos de estilo por localhost, licença não definida e rotas técnicas sem 4xx. Regras recomendadas permanecem ativas; não inventar licença/deploy/resposta para silenciar aviso.

[CONTRIBUTORS](CONTRIBUTORS.md), [uso de IA](docs/ia.md) e [roteiro técnico](docs/DEMONSTRACAO.md). Revisão humana do A e submissão ao Moodle ainda não ocorreram. Auditoria comparativa e PDFs definitivos aguardam o próximo gate literal do briefing.
