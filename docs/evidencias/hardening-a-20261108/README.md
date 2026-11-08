# Evidências do hardening A — 08/11/2026

Registros de execução real, exceto teste de log lento explicitamente sintético. Timestamps Z em UTC; America/Sao_Paulo é UTC-03. [Relatório principal](../../../RELATORIO_HARDENING_A.md).

| Arquivos | Origem e escopo |
| --- | --- |
| clone.json | GitHub ca2ade9 limpo ao iniciar, portas/volume próprios |
| reproducao/validacao-local.json e pasta | Ciclo completo da baseline, sem --clean: seed repetida, fluxo, trace, flag/ambientes/config rollback e antes/depois combinado |
| matriz/matrix.json | Scripts novos sobre clone ca2ade9, hashes/imagem/dataset/checks/horários/8 cargas/restauração |
| matriz/r*-k6.json e -k6.txt | Todos os summaries/terminais de 4 cenários ×2 rodadas, sem descarte |
| matriz/r*-plan.txt, -metrics.prom, -resources.ndjson | EXPLAIN/cache e 5 coletas Docker/PG por carga; não exclui pausas/locks entre amostras |
| matriz/r*-logs-amostra.json | Primeiros 3, últimos 3 e 3 maiores durationMs, índices únicos; SHA-256 do log integral local; não é série completa |
| pico-historico.json | Leitura dos artefatos antigos, máximo6.165,86ms, causa indeterminada |
| qualidade-candidata.txt / coverage-candidata-banco-reutilizado.json | 58 testes com test-db já inicializado, 97,68%/95,02% |
| qualidade-candidata-fresh.txt / coverage-candidata.json | Test-db novo/tmpfs, 58 testes, 98,06%/95,47%; inclui primeira migration |
| readme-powershell.json / verificar-readme.ps1 | Script executado e HTTP real: fluxo/manual/restart/erros/cache/RED |
| persistencia-encerramento.json / encerrar-reproducao.py | Recriação app/SQL/recibo/encerramento com volume preservado; script usa caminhos deste ambiente |
| guard.json | Recusa do runner na instalação original antes de Docker/mutação |
| k6-inspect-falha-sem-env.txt / k6-inspect.txt | Inspeção falhou sem BASE_URL, depois passou configurada; não é carga HTTP |
| diagnostico-k6-teste.json / verificar-diagnostico-k6.mjs | VM sintética, headers string/array/log >500ms/sem payload; 600ms artificial não é benchmark |
| manifesto.json | Origens e SHA-256 original/versionado; só UTF-8/BOM/LF/whitespace final normalizados |
| revisao-candidata.json | Escopo/segredos/links antes do commit, não substitui CI |

Scripts suplementares registram o procedimento; alguns caminhos pertencem a este computador. Professor deve seguir README/scripts oficiais da raiz. Logs integrais, `.env`, node_modules e coverage completo ficam ignorados em tmp. As evidências antigas da pasta-mãe continuam históricas. `reproducao/k6-baseline.json` e `reproducao/k6-optimized.json` são o par correto inicial; k6-summary genérico foi sobrescrito pela matriz e não foi copiado.

Trace de pagamento coletado no ciclo inicial. Sem requisição >500ms na matriz, não há slow trace novo alegado. Nenhuma CI nova é apresentada antes de autorização/publicação. Não foram fabricados dados para preencher ausências.
