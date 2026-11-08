# RELATORIO_HARDENING_A

Data: 08/11/2026, America/Sao_Paulo. Autorização literal: `APROVO O HARDENING DO B; INICIAR O A`.

## Diagnóstico e prioridade

**PASSOU: validação local, publicação autorizada e CI do commit de ajustes.** Nenhuma falha P0 funcional foi reproduzida no A. Intervenções P1 melhoram reprodução, investigação da latência e evidência. Não foi alterado o comportamento do marketplace. O fechamento documental exige sua própria CI, cujo SHA/resultado exatos são conferidos no certificado externo entregue ao aluno.

Baseline pública: `ca2ade99c6c9c6b6be541fad59ad5aee7b77b831`, árvore `455fcd6f909aa7b7e557804685e852bb2120a1d8`, [CI histórica](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42499111933). Candidata local `040d9d24bb0f7810e4b0668af203ff4f46bb4e9f`, publicada em `4e59721e2321b4308c8024c9064482ddb562f42f`, árvore **9946461adebf1dd1c46301cf68c91cff5acfe746** idêntica local/remota. [CI dos ajustes: success](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42514607401), 58 testes/98,06% linhas/95,47% branches, lint/fronteiras/tipos/build/OpenAPI/SCA. Datas diferentes da API explicam SHAs distintos, sem diferença de conteúdo. Branch publicada local `codex/hardening-a-publicado`. [Registro](docs/evidencias/hardening-a-20261108/ci-ajustes.json). O aluno autorizou literalmente “Autorizo publicar o hardening do A e executar o CI”.

O B permanece em `6d6f58f664918e69c7c5964331f358d87d230708`, sem alterações nesta etapa. Os projetos são alternativas; nenhuma escolha de submissão foi feita. Relatório do mesmo assistente que implementou/revisou: não é auditoria externa independente. PDFs, pacote global, notas e Moodle não são fechados nesta etapa.

## Problema → hipótese → intervenção → comprovação

| Prioridade e problema reproduzido | Hipótese e correção mínima | Teste e resultado | Risco residual |
| --- | --- | --- | --- |
| P1: máximo histórico 6.165,86 ms sem correlação individual e sem p99 | Acrescentar estatísticas e log somente de amostras >500 ms com timestamp, rota, IDs e timings, sem mudar API | k6 inspect compatível; 8 cargas reais com p50/p95/p99/max/count; verificação sintética separada do log | Nenhuma nova amostra >500 ms/slow trace; dados novos não explicam retroativamente o pico |
| P1: antes/depois combina índice e cache | Runner nativo de 4 configurações em clone isolado, 2 rodadas em ordem inversa, mesma imagem/dataset/aquecimento/estágios e recursos Docker/PG | Oito execuções PASSOU, fingerprints iguais, configuração e índice restaurados | Host compartilhado, poucas repetições e overhead de instrumentação; sem inferência estatística universal |
| P1: clone/preparação/persistência manual precisavam ficar explícitos no PowerShell | Documentar comandos testados, JSON e consulta do mesmo pedido após restart | Fluxo 201/201/202/200, SUCCEEDED/PAID/3.000 centavos, replay mesmo ID, erros 400/404/409; restart/recriação preservaram pedido | Docker/rede/preparação dependem dos pré-requisitos; recriação causa interrupção breve |
| P1: evidência nova de reprodução pelo GitHub necessária | Clone público limpo, portas/volume próprios, env:init seguro e ciclo completo sem --clean | Compose saudável, duas seeds com 100 mil sintéticos, zero incoerências SQL, trace, ambientes/flag/config rollback | Cada futura revisão precisa de CI própria; materiais finais aguardam gate |

O máximo histórico foi **6.165,863163 ms**, seu p95 de pedidos **6,0197886 ms**. Os 3.601 logs antigos têm máximo 369,143125 ms no servidor, mas faltam IDs/horário da amostra k6; as janelas medidas também diferem. Não correlacionar máximos agregados automaticamente. Faltam séries antigas de CPU/locks/GC/pool/trace. **CAUSA INDETERMINADA COM OS DADOS DISPONÍVEIS.** [Dados e limitações](docs/evidencias/hardening-a-20261108/pico-historico.json).

**Atualização posterior solicitada pelo aluno antes da aprovação:** a conclusão acima é histórica, anterior à consulta do Windows. A [investigação complementar](docs/INVESTIGACAO_PICO.md) confirmou stornvme129 às 13:11:54, dentro de uma pausa HTTP de 5,67 s, e refinou a hipótese para **causa provável de I/O no ambiente local**. O evento é comprovado; nexo individual com a amostra antiga e motivo interno do reset permanecem sem prova. Cinco repetições instrumentadas, 23.474 requisições, zero erros e sem novo reset. Sem alteração de negócio/hardware. Publicação autorizada em8af3328, [CI42516930337 success](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42516930337),58 testes/98,06%linhas/95,47%branches. O HEAD documental final exige CI própria, registrada no certificado externo. Não inicia fechamento global.

## Arquivos e decisões preservadas

- `scripts/k6-load.js`: estatísticas e log lento; rotas, estágios, pausa, checks e thresholds preservados.
- `scripts/benchmark-matrix.mjs`: ferramenta manual sem dependência extra, isolamento explícito, recusa de instalação padrão/saída existente e restauração em finally.
- `README.md`: clone, preparação, fluxo manual/persistência e matriz.
- `docs/desempenho.md`: preserva históricos e acrescenta todas as oito medições, planos, recursos e limites.
- `docs/PLANO_DE_DESEMPENHO.md`, `docs/ACEITE_A.md`, `docs/DEMONSTRACAO.md`, `docs/ia.md`: origem dos resultados e gates.
- `docs/evidencias/hardening-a-20261108/`: evidências e manifesto de SHA-256/origem; logs integrais e `.env` fora do Git.

**MANTER SEM ALTERAÇÃO:** src, testes, migrations, Dockerfile/Compose, package/lock, workflow CI, contrato OpenAPI, ADR, fontes/PNGs C4, regras de cache/fila e limites de cobertura. Nenhuma exclusão de fonte, remoção de teste ou redução de threshold. Descartadas mudanças P2, novas dependências, Redis/BullMQ, frontend, autenticação e infraestrutura externa.

## Validações reais

Pasta principal: [evidências](docs/evidencias/hardening-a-20261108/README.md). Timestamps Z são UTC; subtrair três horas para horário local. Comandos completos/exit codes nos arquivos.

| Verificação | Resultado e evidência | Status |
| --- | --- | --- |
| Ciclo completo da baseline GitHub | `node scripts/validate-local.mjs`, sem --clean, 18:49:35.774Z–18:52:38.189Z; 28 checks aprovados | PASSOU |
| Qualidade da candidata em test-db novo | `docker compose -p fullcycle-a-hardening-candidate-20261108 --profile test run --build --rm tests sh -c 'npm run lint && npm run typecheck && npm run build && npm run openapi:lint && npm run sca && npm test'`, 19:04:58.182Z–19:05:25.893Z | PASSOU |
| Testes/cobertura | 58: 42 unitários, 14 integração, 2 contrato; 254/259 linhas=98,06%, 211/221 branches=95,47%, 100% funções. Thresholds 80%/75% preservados | PASSOU |
| Primeira qualidade, test-db já inicializado | Também 58/58, 97,68% linhas/95,02% branches; caminho de aplicação inicial da migration não exercitado nessa repetição. Registro preservado | PASSOU |
| Fronteiras/contratos | Checker de imports/direção/SQL com testes negativos; Ajv valida HTTP real e rejeita resposta incompatível | PASSOU |
| Fila/falhas/idempotência | Teste força falha após efeito antes do recibo e recupera sem repetir efeito; duplicatas, 8 submits concorrentes, workers concorrentes, 3 entregas, DEAD/FAILED, recusa e reinício | PASSOU |
| Cache/integridade | TTL/invalidação/generation testados; preço sempre do PG sem cache; manual observou miss→hit | PASSOU |
| Seed/migrations | Duas seeds, 100.000 sintéticos, zero incoerências SQL; testes de checksum e rollback transacional | PASSOU |
| Observabilidade | RED muda em HTTP real, sem IDs como labels; logs JSON; trace `a2624434ffaa10e55fb75a045ab0fff5`, 15 spans, worker/markPaid/SQL | PASSOU |
| Ambientes/flag | development/production locais, 503 com flag desligada, recriação/config rollback e pedido preservado | PASSOU |
| Rollback entre binários diferentes | Somente documentado, não executado | BLOQUEADO |
| Matriz k6 | 4 cenários ×2 rodadas, mesmos 3 estágios/imagem/dados, zero erros/100% checks/todos p95<500ms, restauração | PASSOU |
| C4 | Dois PNGs reabertos visualmente, legíveis/coerentes: três módulos no app, PG e Jaeger separados, arquivos preservados | PASSOU |
| OpenAPI/SCA | OpenAPI 3.1 sem erros, quatro avisos conhecidos; SCA zero vulnerabilidades reportadas | PASSOU |
| CI do commit de ajustes | 4e59721, execução42514607401 success; 58/58,98,06%/95,47%; ver certificado externo para HEAD documental final | PASSOU |

Os quatro avisos recomendados OpenAPI (licença não declarada, localhost, rotas técnicas sem 4xx) permanecem explicados; não inventar licença/deploy/erro para silenciá-los. Guard/VM são verificações suplementares e não aumentam a contagem de 58 testes. `k6 inspect` inicialmente falhou sem BASE_URL; repetido com `-e BASE_URL=http://app:3003` passou. Ambas as saídas preservadas. Nenhum controle foi desativado.

## Desempenho e limites

Históricos **172,85→4,30 ms** pedidos e **18,41→2,38 ms** catálogo preservados. Nova reprodução combinada: **94,48→6,08 ms** e **8,51→3,47 ms**. Na matriz: pedidos com índice p95 5,33–6,55 ms, sem índice 90,38–98,30 ms; catálogo com cache 3,02–5,12 ms, sem cache 7,74–10,37 ms. São faixas observadas, não intervalos de confiança ou percentis combinados. [Todas as 8 execuções, p50/p95/p99/máximos/amostras/throughput](docs/desempenho.md#matriz-de-quatro-configurações-duas-rodadas).

Máximo de pedidos na matriz: 305,33 ms; nenhuma amostra >500 ms. Não existe slow trace novo alegado. Trace real do pagamento foi obtido separadamente. Verificador sintético de log usa 600 ms artificiais em VM: não é medição HTTP real. Quarenta amostras de recursos (5/carga), pausa nominal 5 s mais comandos, nenhuma sessão bloqueada observada nesses instantes. Sem GC/espera de pool/escalonamento instrumentados; não exclui transientes. Duas repetições curtas, ordem inversa, máquina compartilhada e overhead de coleta não demonstram capacidade máxima, ganho causal percentual ou ausência de caudas futuras. Nenhuma otimização de negócio nova foi feita.

## VALIDAÇÃO DOCKER E REPRODUTIBILIDADE DA ENTREGA

Parecer A: **PASSOU localmente e conteúdo dos ajustes sincronizado no GitHub**. O parecer B permanece no relatório já aprovado, sem nova execução/alteração nesta etapa.

| Critério | Evidência | Status |
| --- | --- | --- |
| Arquivos Docker versionados | Dockerfile, Compose/override, .dockerignore, .env.example, .gitignore, env-init/migrate/seed/validate e lock presentes no clone ca2ade9, preservados na candidata | PASSOU |
| Clone limpo | Git clone do GitHub público; cleanAtStart=true; projeto fullcycle-a-hardening-20261108, API 3003/Jaeger16689, volume próprio | PASSOU |
| Preparação segura | npm run env:init sem npm install necessário; senha aleatória; repetição preserva .env | PASSOU |
| Docker Compose | Após preparo/configuração isolada, docker compose up --build -d --wait; migrations antes do HTTP; seed separado | PASSOU |
| Serviços saudáveis | app/PG/Jaeger saudáveis; health consulta PG; testes em PG tmpfs separado | PASSOU |
| Fluxo principal | Manual: produto/pedido201, pagamento202, replay200 mesmo ID, SUCCEEDED/PAID/3000 e referência iguais | PASSOU |
| Persistência restart | Mesmo contêiner antes/depois; HTTP confirmou pedido antes de outro Compose up | PASSOU |
| Persistência recriação | App com ID diferente; pedido a0148911-67c9-4745-8ae0-f3fc2b595012 PAID, pagamento 1e5b6d64-f1b3-4b80-a48b-d6dd3a5e977e, um recibo | PASSOU |
| Encerramento preservando volume | docker compose --profile test --profile tools down; volume marketplace-data confirmado antes/depois; zero contêiner auxiliar restante | PASSOU |
| README reproduzível | Fluxo manual, restart/retomada/erros executados; matriz com hashes dos scripts; pré-requisitos explícitos | PASSOU |
| GitHub sincronizado | Ajustes publicados em4e59721, árvore idêntica à candidata040d9d2; Docker e configuração preservados | PASSOU |

O clone foi limpo ao iniciar; recebeu dois scripts novos antes da matriz e documentos antes da qualidade da candidata. A imagem de negócio medida é a baseline preservada, enquanto k6 monta o script novo. A execução local antecedeu a publicação da candidata; a árvore completa publicada foi conferida depois. Fingerprints ficaram iguais durante a matriz; o manual posterior acrescentou produto/pedido/pagamento, explicando 5.002 produtos na consulta final. Não houve exclusão de volume/dados nem seed em banco importante.

## Demonstração, regressão e próximo gate

Comandos executados/documentados: `npm run env:init`, `docker compose up --build -d --wait`, `docker compose ps`, `npm run demo`. [README](README.md#demonstração-manual-no-powershell) tem fluxo PowerShell e consulta do mesmo ID após restart. Seed separado para banco apropriado; encerrar com `docker compose down`. Não usar --clean/down -v com dados a preservar.

Fila entrega **pelo menos uma vez com efeito idempotente**: se a interrupção ocorrer após atualizar pedido e antes do recibo, retry encontra a mesma referência sem repetir efeito. Não há exatamente uma execução/transação distribuída. Cache por processo TTL5s tolera desatualização externa; preço de compra bypassa cache. Jaeger é transitório. Recreate interrompe uma instância; não existe produção pública/HA/pagamento externo. Checker estático não prova toda dependência dinâmica.

A revisão pré-publicação em `revisao-candidata.json` passou: escopo preservado, links locais sem falta, nenhuma ocorrência de senhas reais conhecidas/tokens GitHub/chaves privadas no conjunto examinado. Não é garantia universal de detecção. `.env`, segredo, log integral, volume e banco não foram enviados. Baseline local/pública preservada; scripts/documentos podem ser restaurados sem mexer em dados. Todos os testes/controles existentes ativos. A CI também emitiu avisos de depreciação de ferramentas/Actions (Node24 aplicado pelo runner), sem falha; não foram feitas atualizações de dependências/Actions para fins estéticos.

Versão recomendada nesta etapa: ajustes publicados e revisão documental com CI do SHA final conferida no certificado externo (evita referência circular ao próprio commit). [Workflow de main](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/workflows/ci.yml?query=branch%3Amain). Não declarar **APTO TECNICAMENTE PARA SUBMISSÃO** enquanto sincronização dos materiais e fechamento global não forem concluídos no gate próprio. Ensaio/Moodle sem comprovante. Publicação/CI autorizadas não iniciam PDFs, notas, pacote global nem escolha de nível. Parar para `APROVO O HARDENING DO A; INICIAR FECHAMENTO E APRESENTAÇÕES`.
