# Fechamento da pré-auditoria interna - Projeto A

Data: 08/11/2026, America/Sao_Paulo. O aluno aprovou os dois projetos e enviou literalmente `APROVO O PROJETO A; INICIAR AUDITORIA E APRESENTAÇÕES`. Esse gate autoriza a etapa atual. Aprovação não comprova ensaio ou aprendizado.

Baseline aprovada preservada no Git: `8e9b5d4bca10da0c314825e9510746405deea354`. Checkout inicialmente limpo e banco/volume/portas próprios foram usados para repetir `node scripts/validate-local.mjs --clean`, sem apagar os dados da instância aprovada. Resultado **PASSOU**. Início UTC: 2026-11-08T16:09:14.549Z; fim UTC: 2026-11-08T16:12:13.422Z. Comandos e códigos de saída completos: [auditoria-checkout.json](evidencias/auditoria-checkout.json).

Cobertura repetida: 98.06% linhas e 95.47% branches. Os 58 testes passaram novamente. As medições anteriores permanecem preservadas e não foram substituídas pelas novas.

Repetição: 100 mil pedidos sintéticos, seed repetível, SQL coerente e trace real com worker. Na nova comparação, p95 de pedidos 144,58 -> 6,02 ms e catálogo 13,76 -> 3,16 ms, zero erros. A canônica anterior permanece 172,85 -> 4,30 ms e 18,41 -> 2,38 ms. Cada par tem mesmo cenário/dados/imagem nas duas fases; as repetições refletem variação local. Índice e cache foram alterados juntos, sem atribuição percentual isolada.

A revisão encontrou textos de status dos gates anteriores desatualizados. Estes foram corrigidos sem alterar src, tests, scripts ou configuração executável. A nova revisão apenas atualiza documentação e acrescenta evidência da auditoria. O CI correspondente ao novo commit será acompanhado e registrado no pacote final, evitando referência circular dentro desse mesmo commit.

A auditoria interna e os oito PDFs de apoio são produzidos em pacote separado `fullcycle-entrega-final`, preservando independência de execução de cada repositório. O pacote reúne pré-auditoria, matrizes, checklist Moodle, fontes e evidências, para avaliação independente em outra conversa. Ensaio com o aluno, medição do tempo real da defesa, escolha do único nível e envio ao Moodle seguem sem comprovante. Não existe nota oficial ou avaliação independente concluída.
