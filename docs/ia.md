# Assistência de IA - A

Data: 08/11/2026. Assistente: Codex. Não registrar tokens, credenciais, e-mail pessoal ou dados sensíveis.

## Instruções decisivas

- Seguir o briefing e os slides conferidos; B e A são alternativas de entrega, implementadas separadamente por escolha do aluno.
- Preservar B aprovado e só iniciar A após a frase literal. O aluno enviou “APROVO O PROJETO B; INICIAR O A”.
- A exige monólito modular de três módulos, 100 mil pedidos sintéticos, testes/contrato, observabilidade, cache/fila e desempenho antes/depois, sem recursos alheios à rubrica.
- Não inventar saídas, cobertura, traces, CI, medições, commits, capturas ou deployments. Concluir hoje se possível, sem esperas artificiais até a entrega em 13/11.
- Auditoria comparativa e PDFs definitivos só após aprovação dos dois projetos, conforme próximo gate.

## Decisões humanas confirmadas

Trabalho individual; identidade Git existente confirmada; domínio e B aprovados; início do A autorizado; meta de concluir em 08/11 e apresentação em 13/11. O aluno criou um repositório separado para A e forneceu seu link. Após a validação local e revisão dos arquivos, o aluno respondeu: “Autorizo publicar o Projeto A e executar o CI”. Publicação realizada pelo conector da conta correta, sem usar a credencial de outra conta no terminal. Essa autorização não aprova ainda o A nem inicia auditoria/apresentações.

## Trabalho e propostas da IA

Propôs Repository e APIs públicas por módulo, Strategy para simulação, fila PostgreSQL com recibo/idempotência, cache TTL no processo e Jaeger para trace real. Gerou implementação, testes, OpenAPI, C4, CI e scripts e executou verificações reais. A documentação diferencia implementação, operação local executada e procedimentos somente propostos.

Foram executados HTTP e SQL reais, testes de crash após efeito, recuperação idempotente, trace com worker e comparação k6 no mesmo conjunto. Diagramas foram gerados a partir do código/arquitetura e inspecionados; não são screenshots de deploy. Ajustes de layout não alteram os dados de evidência.

## Publicação e execução remota

[CI success](https://github.com/jairo-fermon/fullcycle-projeto-a-marketplace-/actions/runs/42497720872) em `b6ca03b`, com 58 testes, cobertura 98,06% linhas e 95,47% branches. A árvore publicada foi conferida contra a candidata local `32fa2a1`. Históricos locais preservados; hashes remotos diferem por bootstrap/data de publicação via API, com mapeamento em evidencias/ci-github.json. Um PNG incompleto na primeira transferência foi reenviado e conferido por blob/árvore antes de declarar igualdade. O .env e o log integral local não foram enviados.

## Revisão humana pendente

O aluno ainda precisa revisar ADR/fronteiras, explicar entrega pelo menos uma vez, preço sem cache, p95, trace e limitações do deploy local. Não há declaração de ensaio ou aprendizado concluído. Aprovação do A e autorização de auditoria/apresentações devem ser registradas separadamente.

## Hardening A autorizado em 08/11/2026

Após concluir e aprovar o hardening do B, o aluno enviou `APROVO O HARDENING DO B; INICIAR O A`. Escopo atual somente A, preservando B, sem publicação presumida. A IA propôs melhorar reprodutibilidade e coleta do benchmark, sem alterar regras de negócio: p99/máximo/amostras, logs lentos com IDs, matriz de índice/cache em ambiente isolado e restauração obrigatória. O pico histórico permanece sem causa comprovada. Medições reais, tentativas, limitações e controles são registrados no relatório específico. Aprendizado, ensaio e Moodle continuam sem comprovação.

## Gate de auditoria confirmado

O aluno aprovou literalmente o B e o A, encerrando os gates de implementação, e autorizou auditoria/apresentações. A pré-auditoria repetiu o ciclo em checkout limpo, registrou as novas medições e corrigiu textos históricos de estado. Os resultados não constituem avaliação independente. Ensaio, aprendizado, tempo real de fala e Moodle não estão comprovados. A assistência continua declarada.

## Resultado local do hardening A

Reprodução GitHub ca2ade9 isolada, seed100mil repetida, fluxo/trace real, ambientes/flag/config rollback, qualidade candidata58 testes e matriz4configurações×2rodadas em ordem inversa executados. Scripts medidos com SHA-256 no matrix.json. Negócio/testes/dependências/infra preservados. Sem causa comprovada para pico antigo; não atribuído a GC/CPU/cache/worker. Coberturas de banco test inicializado e novo preservadas. Tempos sintéticos do teste de log não são medição HTTP. B intacto. Nova publicação/CI A requer autorização específica; fechamento global exige novo gate literal. Sem nota oficial, ensaio concluído ou Moodle enviado.

## Publicação do hardening A autorizada

O aluno respondeu “Autorizo publicar o hardening do A e executar o CI”. Candidata040d9d2 publicada4e59721 com árvore9946461adebf1dd1c46301cf68c91cff5acfe746 igual; CI42514607401 success,58 testes98,06%linhas95,47%branches. Este fechamento documental exige CI própria, conferida no certificado externo de SHA final. Não houve envio de .env/log integral, nem nova autorização para fechamento global/apresentações. Próximo gate: APROVO O HARDENING DO A; INICIAR FECHAMENTO E APRESENTAÇÕES.
