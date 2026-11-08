# C4 - Contexto

Escopo: o marketplace é um único sistema. Pagamento é simulado internamente; não existe gateway externo nem cobrança. O operador usa uma API REST, sem frontend no projeto.

```mermaid
---
title: C4 - Contexto do Marketplace
---
flowchart LR
  operator(["Operador ou avaliador<br/>Pessoa<br/>Cadastra produtos, cria pedidos<br/>e consulta pagamentos simulados"])
  marketplace["Marketplace<br/>Sistema de software<br/>Catálogo, Pedidos e Pagamento<br/>em um monólito modular"]
  operator -->|API REST - HTTP e JSON| marketplace
  classDef person fill:#123C69,color:#fff,stroke:#123C69
  classDef system fill:#1769AA,color:#fff,stroke:#0F4C81
  class operator person
  class marketplace system
```

Fonte renderizável correspondente: contexto.mmd. [PNG renderizado e inspecionado](contexto.png), sem cortes ou sobreposição de rótulos. O diagrama usa formas Mermaid flowchart para expressar o nível C4 Contexto; não representa implantação. Metadados de geração em ../evidencias/c4-render.json.
