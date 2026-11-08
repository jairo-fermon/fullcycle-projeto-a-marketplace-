# Assistência de IA - A

Data: 08/11/2026. Assistente: Codex. Não registrar tokens, credenciais, e-mail pessoal ou dados sensíveis.

## Instruções decisivas

- Seguir o briefing e os slides conferidos; B e A são alternativas de entrega, implementadas separadamente por escolha do aluno.
- Preservar B aprovado e só iniciar A após a frase literal. O aluno enviou “APROVO O PROJETO B; INICIAR O A”.
- A exige monólito modular de três módulos, 100 mil pedidos sintéticos, testes/contrato, observabilidade, cache/fila e desempenho antes/depois, sem recursos alheios à rubrica.
- Não inventar saídas, cobertura, traces, CI, medições, commits, capturas ou deployments. Concluir hoje se possível, sem esperas artificiais até a entrega em 13/11.
- Auditoria comparativa e PDFs definitivos só após aprovação dos dois projetos, conforme próximo gate.

## Decisões humanas confirmadas

Trabalho individual; identidade Git existente confirmada; domínio e B aprovados; início do A autorizado; meta de concluir em 08/11 e apresentação em 13/11. O aluno criou um repositório separado para A e forneceu seu link. Publicação do A ainda depende de autorização específica após validação e revisão dos arquivos.

## Trabalho e propostas da IA

Propôs Repository e APIs públicas por módulo, Strategy para simulação, fila PostgreSQL com recibo/idempotência, cache TTL no processo e Jaeger para trace real. Gerou implementação, testes, OpenAPI, C4, CI e scripts e executou verificações reais. A documentação diferencia implementação, operação local executada e procedimentos somente propostos.

Foram executados HTTP e SQL reais, testes de crash após efeito, recuperação idempotente, trace com worker e comparação k6 no mesmo conjunto. Diagramas foram gerados a partir do código/arquitetura e inspecionados; não são screenshots de deploy. Ajustes de layout não alteram os dados de evidência.

## Revisão humana pendente

O aluno ainda precisa revisar ADR/fronteiras, explicar entrega pelo menos uma vez, preço sem cache, p95, trace e limitações do deploy local. Não há declaração de ensaio ou aprendizado concluído. Aprovação do A e autorização de auditoria/apresentações devem ser registradas separadamente.
