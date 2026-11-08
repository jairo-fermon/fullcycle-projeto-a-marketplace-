# Investigação complementar do pico de 6,17 segundos

Data: 08/11/2026, America/Sao_Paulo. Solicitada pelo aluno antes de aprovar o hardening A. Base pública preservada: `08ea873b23344751f0fa47765b8f83143b5cbf6d`. Projeto B intacto em `6d6f58f664918e69c7c5964331f358d87d230708`. Este complemento não inicia fechamento global/apresentações.

## Resultado e grau de certeza

**Incidente confirmado:** o Windows registrou reset do armazenamento NVMe durante o intervalo anormal do ensaio antigo. **Causa provável do pico:** interrupção de I/O no ambiente local, sustentada pela coincidência temporal, pelo armazenamento do Docker no disco envolvido e pela pausa simultânea nas conclusões HTTP. É uma inferência técnica forte, não identificação individual comprovada da amostra de 6.165,86 ms.

A classificação anterior “CAUSA INDETERMINADA COM OS DADOS DISPONÍVEIS” foi feita sem consultar o log System do Windows. Essa evidência posterior permite refinar a análise para **causa ambiental provável com incidente de armazenamento comprovado**. Os registros antigos são preservados; não serão reescritos como se esse diagnóstico já fosse conhecido.

O motivo do reset (driver, firmware, saturação, energia ou falha física) não foi determinado. Não declarar SSD defeituoso nem causa de código descartada com certeza absoluta. Faltam ID/timestamp individual da amostra k6 antiga e rastreamento de I/O daquele momento para demonstrar toda a cadeia causal. A lacuna de investigação foi reduzida com evidência nova; o limite de certeza permanece explícito.

## Cronologia recuperada

Horários abaixo em UTC-03; os JSON preservam UTC e/ou offset explícito.

| Horário local | Fato observado | Fonte |
| --- | --- | --- |
| 13:11:32.535 | Início do comando Compose/k6 otimizado, que inclui preparação fora dos 35 s da carga | validacao-local antigo, check k6-optimized |
| 13:11:50.351 | Última conclusão HTTP antes da pausa: GET /orders,200,0,865243ms medidos pelo hook | Log original da aplicação |
| **13:11:54.251982** | **Windows System, stornvme, EventID129, RecordID31143: reset para \Device\RaidPort1** | Evento original preservado e recorte sanitizado |
| 13:11:56.020 | Próxima conclusão HTTP: GET /orders,200,244,067654ms medidos pelo hook | Log original da aplicação |
| 13:12:10.391 | Comando k6 concluído com exit0; máximo6.165,863163ms, p95 pedidos6,0197886ms, zero erros | Resumo/terminal originais |

A pausa entre conclusões foi **5.669 ms**, e o evento129 ocorreu dentro dela. Não são a mesma medida que os6.165,86ms do cliente; não subtrair uma da outra para inventar fases. As3.570 requisições k6 possuem3.570 conclusões no recorte do servidor (1.785 por rota), afastando a hipótese de um trecho de logs simplesmente omitido. Isso ainda não identifica qual ID corresponde ao máximo k6.

[Correlação e dois registros HTTP reais](evidencias/investigacao-pico-20261108/historico-correlacao.json), [evento Windows sanitizado](evidencias/investigacao-pico-20261108/windows-evento129.json).

## Por que o armazenamento entrou no diagnóstico

O disco do C: foi identificado como NVMe KINGBANK KP230, Disk0/SCSIPort1. O Docker mantém seu arquivo de dados em `%LOCALAPPDATA%/Docker/wsl/disk/docker_data.vhdx`, no mesmo disco. O evento aponta RaidPort1. Essa topologia sustenta a hipótese de impacto no ambiente Docker; o mapeamento não é rastreamento ETW de cada operação. A consulta atual retorna Online/Healthy, o que não apaga o reset histórico nem demonstra defeito físico.

A [documentação Microsoft sobre eventos de armazenamento](https://learn.microsoft.com/en-us/troubleshoot/windows-server/backup-and-storage/troubleshoot-data-corruption-and-disk-errors#event-id-129-reset-to-device-deviceraidport1-was-issued) associa EventID129 a timeout de requisição de disco e reset pelo subsistema de armazenamento. É referência de interpretação do evento, não diagnóstico específico deste modelo de SSD. Não alteramos driver, firmware, energia, registro, timeouts, disco ou dados para obter essa conclusão.

Os logs Docker monitor inicialmente pareciam ter16:11, mas continham offset-03:00, equivalente a19:11Z. Foram normalizados e excluídos dessa correlação histórica. O recorte host backend contém chamadas de eventos/time, sem prova do mecanismo da pausa. Não usar esses dados de outro horário para reforçar artificialmente o diagnóstico.

## Repetições diagnósticas adicionais

Mesmo projeto isolado da validação anterior: `fullcycle-a-hardening-20261108`, API3003/Jaeger16689, volume próprio já com100mil sintéticos. Sem seed novo, sem remover índice/dados/volumes, cache e índice habilitados. Imagem de negócio idêntica à matriz anterior: `sha256:76894841c87dddc94c87f7d379d5e8532b60e8871ffbc64f4c601b204f150a6b`.

Cinco execuções, mesmos três estágios:10s/5VUs,15s/15VUs,10s/zero, pausa100ms e10 aquecimentos por rota. Instrumentação temporária adicionou log de cada requisição do cliente, HTTP nativo, GC/coleta de lixo, atraso do event loop, pressão de I/O Linux e amostras PG. Houve overhead: essas cargas diagnósticas não substituem a matriz de desempenho nem formam novo antes/depois.

| Coleta | Rodada | HTTP | Pedidos p95(ms) | Máx.(ms) | Catálogo p95(ms) | Máx.(ms) | Erros | Checks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Inicial | 1 | 4714 | 5,44 | 36,91 | 2,99 | 20,04 | 0% | 100% |
| Inicial | 2 | 4666 | 8,08 | 59,56 | 4,06 | 20,44 | 0% | 100% |
| Inicial | 3 | 4688 | 6,08 | 52,16 | 3,02 | 18,73 | 0% | 100% |
| Correlação nativa | 1 | 4726 | 4,26 | 35,01 | 2,37 | 10,16 | 0% | 100% |
| Correlação nativa | 2 | 4680 | 6,06 | 93,98 | 3,03 | 46,20 | 0% | 100% |

**23.474 requisições reais, zero erros,100% checks, todos os thresholds aprovados; nenhuma amostra>500ms.** Todas foram correlacionadas por requestId ao log de negócio. Na primeira coleta, o hook nativo não conseguia ler o ID por getHeader depois de writeHead. Foi um defeito da coleta temporária, não da API: header de resposta estava presente no cliente e o log de negócio tinha o ID correto. A coleta foi corrigida usando X-Diagnostic-Id somente nos logs, sem label de métrica ou mudança de negócio. Nas duas últimas cargas, **9.406 requisições também foram correlacionadas entre cliente, HTTP nativo e aplicação**. As três primeiras cargas e a limitação permanecem nos registros; nenhum resultado desfavorável foi ocultado. A [API HTTP do Node](https://nodejs.org/docs/latest-v24.x/api/http.html#responsesetheadername-value) explica que headers escritos diretamente com writeHead não precisam ficar disponíveis em getHeader.

Nas duas coletas:407 amostras do processo,168 eventos GC e187 amostras PG, sem erro de coleta PG. Maior evento GC11,33ms e atraso máximo de event loop148,37ms. Esses máximos abrangem inicialização/aquecimento/cargas da captura, não são percentis HTTP. Nenhuma sessão bloqueada/lock aguardando foi observada nos instantes PG; não exclui transientes entre amostras nem mede espera específica do pool. Nenhum novo evento stornvme129 no intervalo das repetições. Esses fatos mostram que não reproduzimos a cauda de segundos nessas condições; não provam que ela nunca retornará ou que GC/locks não participaram do episódio antigo.

As contagens/fingerprints de pedidos permaneceram iguais em cada coleta. O ambiente auxiliar foi encerrado sem remover volume e sem deixar preload ativo na aplicação original. Nenhum teste de falha de disco foi induzido. Os programas originais A/B ficaram separados.

## Evidências e reprodução da análise

- [Conclusão estruturada e cinco cargas](evidencias/investigacao-pico-20261108/conclusao.json).
- [Resumo inicial, incluindo limitação da coleta nativa](evidencias/investigacao-pico-20261108/resumo.json) e [resumo com correlação completa](evidencias/investigacao-pico-20261108/resumo-v2.json).
- Summaries k6 individuais, amostras PG/runtime/GC e versões dos scripts na pasta de evidências. [Manifesto de SHA-256 e seleção](evidencias/investigacao-pico-20261108/manifesto.json).
- [Metadados de armazenamento sem serial](evidencias/investigacao-pico-20261108/armazenamento.json) e [fontes descartadas/limitações](evidencias/investigacao-pico-20261108/fontes-descartadas.json).

Logs integrais do cliente/aplicação e XML bruto Windows ficam locais em `fullcycle-hardening/A/investigacao-pico`, com hashes para integridade. Nome do computador, XML livre do host, senhas e .env ficam fora do Git. As evidências são daquele computador/horário; outro avaliador reproduz a metodologia, não o incidente físico histórico. Scripts temporários contêm caminhos deste ambiente, identificados como tal; não são parte da inicialização normal.

Leitura Windows usada: `Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='stornvme';Id=129;StartTime=[datetime]'2026-11-08 12:00:00'}`. Os horários TimeCreated são convertidos para UTC antes de comparar com os timestamps k6/JSON. Não substituir essa normalização por busca textual de horário. Instrumentação baseada em [perf_hooks Node24](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html), [diagnostics_channel HTTP](https://nodejs.org/docs/latest-v24.x/api/diagnostics_channel.html#http) e [tempos HTTP k6](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/#http-specific-built-in-metrics). Canais HTTP do Node são experimentais nessa versão e usados somente no diagnóstico isolado.

## O que é defensável perante a banca

“O p95 continuou baixo, mas uma requisição apresentou6,17segundos. Preservei esse resultado e investiguei. O Windows registrou um reset do armazenamento exatamente dentro de uma pausa de5,67segundos nas conclusões do servidor. Por isso, a explicação mais sustentada é um incidente de I/O do ambiente local. Fiz mais cinco testes instrumentados, com23.474requisições sem erros e sem repetir o pico ou o reset. A causa é provável; não afirmo ter identificado o defeito interno do SSD nem correlacionado individualmente a amostra antiga, porque essa coleta não existia naquele ensaio.”

A banca pode verificar o evento, os horários e as repetições. A defesa distingue p95 e máximo e usa o grau de certeza permitido pelos dados.

## Estado e publicação

O aluno autorizou “Autorizo publicar o complemento e executar o CI”. Candidata local `66824b13853afabc43f6c1723ef738df499ec56d`, publicada em `8af3328852a6aa245726d0c06f086eee01e3b8f7`, árvore `627a0ee511ddf3246dfe8bca6cba9b4a14fd3c4f` idêntica. [CI do complemento: success](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42516930337):58 testes,98,06%linhas/95,47%branches, lint/fronteiras/tipos/build/OpenAPI/SCA. [Registro](evidencias/investigacao-pico-20261108/ci-investigacao.json). O fechamento documental exige CI própria, com SHA exato no certificado externo entregue ao aluno e no [workflow de main](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/workflows/ci.yml?query=branch%3Amain).

Sem alteração funcional ou manutenção de hardware. Código/testes/dependências/infra e thresholds preservados; CI08ea873 é histórica. PDFs, pacote global, Moodle e aprovação do hardening A continuam no gate próprio: `APROVO O HARDENING DO A; INICIAR FECHAMENTO E APRESENTAÇÕES`.
