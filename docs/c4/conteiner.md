# C4 - Contêiner

Uma única aplicação Node executa os três módulos, cache local e worker. Os schemas catalog/orders/payments compartilham o PostgreSQL, com acesso exclusivo por módulo. A fila e os recibos de idempotência pertencem ao schema payments. Jaeger recebe traces; não processa negócio. Bancos de teste são ambientes de validação, não contêineres permanentes de produção neste desenho.

```mermaid
---
title: C4 - Contêineres do Marketplace
---
flowchart LR
  operator(["Operador ou avaliador<br/>Pessoa"])
  subgraph marketplace["Fronteira do sistema: Marketplace"]
    app["Aplicação e worker<br/>Contêiner: Node.js / Fastify<br/>Catálogo, Pedidos e Pagamento<br/>Cache TTL no mesmo processo"]
    db[("Banco de dados<br/>Contêiner: PostgreSQL<br/>Schemas catalog, orders e payments<br/>Fila e recibos duráveis")]
    jaeger["Observabilidade<br/>Contêiner: Jaeger<br/>Recebe e consulta traces reais"]
    app -->|SQL parametrizado| db
    app -->|Exportação OTLP HTTP| jaeger
  end
  operator -->|API REST - HTTP e JSON| app
  classDef person fill:#123C69,color:#fff,stroke:#123C69
  classDef container fill:#1769AA,color:#fff,stroke:#0F4C81
  class operator person
  class app,db,jaeger container
  style marketplace fill:#F5F8FC,stroke:#70869A,stroke-dasharray:5 5
```

Fonte correspondente: conteiner.mmd. [PNG renderizado e inspecionado](conteiner.png), com a fronteira do sistema, contêineres e protocolos legíveis. O diagrama usa formas Mermaid flowchart para expressar o nível C4 Contêiner. O deploy de demonstração mantém portas vinculadas a localhost. Memória do cache e armazenamento do Jaeger são transitórios; dados de negócio ficam no volume PostgreSQL. Não há Redis, microsserviços ou fila externa no código atual.
