# Demonstração executável - A

Este roteiro técnico apoia o gate A. Não é PDF definitivo, ensaio com o aluno ou apresentação cronometrada.

## Fluxo para o aluno repetir

Na raiz do A, executar:

```powershell
npm run env:init
docker compose up --build -d --wait
npm run demo
```

O script imprime IDs/respostas reais, verifica produto -> pedido -> tentativa assíncrona -> pedido PAID e termina com `result: PASSOU`. Não exige seed para o fluxo de negócio. Repetir a chave no demo deve retornar a mesma tentativa; valores são calculados no servidor.

Para volume e evidência SQL:

```powershell
docker compose exec -T app node scripts/seed.mjs
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT origin,count(*) FROM orders.orders GROUP BY origin;"'
```

Explicar que os 100 mil pedidos são sintéticos e os registros de chamadas reais ficam separados por origem. O seed em lotes pode ser repetido sem duplicar.

Abrir Jaeger na porta local 16687 e usar paymentTraceId devolvido pelo demo. Um trace válido une o HTTP de submissão a payments.process_job e orders.mark_paid; o worker pode ocorrer depois que o HTTP já respondeu 202. O trace salvo em docs/evidencias/trace-real.json comprova execução anterior, não uma nova requisição.

Mostrar /metrics e logs JSON pelos comandos do README, depois OpenAPI, ADR e os dois C4. Ao falar de fila, apontar chave de idempotência, recibo e update idempotente do pedido; não dizer que todo job executa uma única vez.

## Cinco arquivos/conceitos para defender

| Arquivo | Explicação operacional |
| --- | --- |
| src/modules/orders/service.ts | Coordena o pedido e pede preço à API pública do Catálogo, como um setor que consulta outro por um procedimento definido. Não lê a tabela do outro setor. |
| src/modules/payments/domain.ts | Strategy escolhe aprovação/recusa simulada. Política é separada de persistência/retry, sem gateway ou cobrança real. |
| src/modules/payments/repository.ts | Fila durável: claim, recibo, retry e limite. É como protocolo de recebimento; a operação pode voltar, mas não deve duplicar o efeito. |
| src/modules/catalog/service.ts | Cache tem validade curta e invalidação. É uma cópia de consulta, não a fonte para cobrar o preço de um novo pedido. |
| scripts/check-boundaries.mjs | Fiscaliza automaticamente as fronteiras e direções, impedindo que a arquitetura seja apenas três pastas com acesso cruzado. |

Complemento: C4 de contexto mostra pessoa/sistema; contêiner mostra aplicação, banco e observabilidade. Um módulo não equivale a serviço separado. Logs contam eventos, métricas resumem frequência/erros/tempo e trace liga operações de uma chamada.

## Duas perguntas de prova

1. Se o worker atualizar o pedido e cair antes de registrar recibo, como retoma sem duplicar? Deve mencionar retry pelo menos uma vez e update idempotente por paymentReference, além do recibo persistido.
2. Por que o catálogo pode ter cache, mas a criação do pedido consulta preço atual? A listagem tolera pequena desatualização; a transação de compra precisa do valor consultado e guardado como snapshot. Cache não garante consistência financeira.

## Plano B de demonstração

Se a execução ao vivo falhar, mostrar arquivos datados do ciclo real: demonstracao.txt, seed-sql.txt, qualidade.txt, trace-real.json, plano-baseline.txt, plano-optimized.txt e os resumos k6, explicando que são registros de 08/11. Mostrar health/logs para investigar a falha atual, sem apresentar arquivo como resposta nova da API.

`npm run validate:local -- --clean` repete o gate com banco vazio, mas apaga dados locais somente do A e altera temporariamente índice/cache durante a medição. Não executar sem compreender esse efeito. [CI remoto verificado como success](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42497720872), 58 testes aprovados. Consultar também a matriz de aceite e o commit final informado na entrega; evidências locais de seed/carga/trace não são etapas desse workflow.

## Próximo gate

Após revisão e aprovação do A: `APROVO O PROJETO A; INICIAR AUDITORIA E APRESENTAÇÕES`. Essa etapa futura inclui comparação, PDFs, perguntas de banca e ensaio; ainda não foi realizada.
