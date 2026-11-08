# Evidências da investigação complementar — A

Base pública inicial:08ea873. [Relatório completo](../../INVESTIGACAO_PICO.md). Os horários são comparados em UTC, com offset explicitamente convertido.

| Arquivo | Escopo |
| --- | --- |
| windows-evento129.json | Evento Windows real, stornvme129/Record31143; XML/nome computador omitidos e hash original preservado |
| armazenamento.json | Disco NVMe do C:, adaptador e caminho Docker; sem serial; saúde atual não exclui reset histórico |
| historico-correlacao.json | 3.570 requests cliente e servidor no recorte; pausa5.669ms com evento dentro; não mapeia individualmente o máximo antigo |
| conclusao.json | Grau de certeza explícito, cinco novas cargas,23.474 requests e estado da candidata |
| resumo.json | Três cargas iniciais, cliente↔log de negócio completos; coleta nativa sem ID individual, limitação preservada |
| resumo-v2.json | Duas cargas seguintes,9.406 requests também correlacionados ao HTTP nativo por X-Diagnostic-Id |
| repeticoes*/r*-summary.json | Todos os cinco summaries originais k6, com p50/p95/p99/max/count/throughput e thresholds |
| repeticoes*/pg-samples.ndjson e runtime.ndjson | Todas as amostras PG/runtime/GC; capturas incluem preparo/aquecimento/cargas, não só janela k6 |
| repeticoes*/probe.mjs, k6-diagnostico.js.txt, repetir-diagnostico.py | Versões realmente executadas, com hashes no resumo; temporárias, não integram inicialização normal; caminhos locais no runner |
| fontes-descartadas.json | Normalização/exclusão de logs de outro horário e limitações da coleta |
| manifesto.json | SHA-256 e origem/normalização/seleção dos arquivos |
| ci-investigacao.json / ci-investigacao-resumo.txt | Candidata66824b1/publicação8af3328 com árvore igual,CI42516930337 success; fechamento documental requer CI própria |

Logs integrais cliente/aplicação e XML Windows bruto ficam locais, fora do Git, com hashes para verificação. Não foram publicados .env, senha, serial, nome do computador ou conteúdo livre dos logs de host. Não existe trace lento novo, pois nenhuma amostra nova passou de500ms. Não foi induzido reset ou executada manutenção de disco. Incidente de armazenamento comprovado; causalidade do pico provável, subcausa física/driver não determinada.

Snapshots k6 possuem sufixo .txt para leitura como evidência; bytes e SHA-256 são os scripts executados, sem entrar no lint de código de produção.
