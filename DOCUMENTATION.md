# 📖 Documentação Técnica — PDV Open Source

## Arquitetura do Sistema

### Visão Geral

```
┌──────────────────┐     HTTP/JSON     ┌──────────────────┐     SQL      ┌─────────┐
│   Frontend       │ ◄──────────────► │   Backend        │ ◄──────────► │ SQLite  │
│   React + Vite   │   localhost:5173  │   Express.js     │  localhost   │ pdv.db  │
│                  │   ───────────►   │   :3001          │              │         │
└──────────────────┘                   └──────────────────┘              └─────────┘
```

**Arquitetura em 2 camadas** (Frontend SPA + Backend API REST) com banco SQLite embarcado. Decisão tomada para simplicidade de deploy e zero configuração de infraestrutura.

---

## Decisões Técnicas

### Por que SQLite?
- Zero configuração (arquivo único)
- Ideal para protótipos e sistemas de uso local
- Performance excelente para operações concorrentes simples
- `better-sqlite3` é síncrono = mais simples e rápido que drivers async

### Por que React + Vite (sem Next.js)?
- PDV é uma SPA (single-page application), não precisa de SSR
- Vite oferece HMR instantâneo e build rápido
- Menor complexidade para um sistema que roda localmente

### Por que Express?
- Maduro, estável e largamente adotado
- Ecossistema rico de middleware de segurança
- Simplicidade para APIs REST

### Por que CSS puro (sem Tailwind)?
- Controle total sobre o design system
- Sem dependência de build para CSS
- Variáveis CSS nativas para temas
- Menor bundle size

---

## Estrutura da API

### Base URL: `http://localhost:3001/api`

### Produtos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/produtos` | Lista com busca e paginação |
| `GET` | `/produtos/:id` | Detalhes de um produto |
| `GET` | `/produtos/busca/:termo` | Busca por nome ou código |
| `GET` | `/produtos/categorias` | Lista categorias únicas |
| `POST` | `/produtos` | Criar produto |
| `PUT` | `/produtos/:id` | Atualizar produto |
| `DELETE` | `/produtos/:id` | Remover (soft delete) |

**Parâmetros de listagem**: `?busca=`, `?categoria=`, `?pagina=`, `?limite=`

#### Corpo — Criar/Atualizar Produto
```json
{
  "nome": "Arroz 1kg",
  "preco": 8.99,
  "estoque": 100,
  "categoria": "Alimentos",
  "codigo_barras": "7891000100101"
}
```

### Vendas

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/vendas` | Registrar venda |
| `GET` | `/vendas` | Listar vendas |
| `GET` | `/vendas/:id` | Detalhes com itens |
| `GET` | `/vendas/relatorio/resumo` | Resumo com métricas |

**Parâmetros de filtro**: `?data_inicio=`, `?data_fim=`, `?pagina=`, `?limite=`

#### Corpo — Registrar Venda
```json
{
  "itens": [
    { "produto_id": "uuid-do-produto", "quantidade": 2 }
  ],
  "desconto": 5.00,
  "forma_pagamento": "pix"
}
```

**Formas de pagamento aceitas**: `dinheiro`, `cartao_debito`, `cartao_credito`, `pix`

#### Resposta — Relatório
```json
{
  "resumo": {
    "total_vendas": 15,
    "receita_total": 450.90,
    "ticket_medio": 30.06,
    "desconto_total": 10.00,
    "maior_venda": 89.90,
    "menor_venda": 5.50
  },
  "por_pagamento": [...],
  "top_produtos": [...]
}
```

---

## Modelos de Dados

### produtos
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | TEXT (UUID) | Chave primária |
| codigo_barras | TEXT | Código EAN (único) |
| nome | TEXT | Nome do produto (obrigatório) |
| preco | REAL | Preço unitário (≥ 0) |
| estoque | INTEGER | Quantidade em estoque (≥ 0) |
| categoria | TEXT | Categoria (default: "Geral") |
| ativo | INTEGER | Soft delete (1=ativo, 0=removido) |
| criado_em | TEXT | Timestamp de criação |
| atualizado_em | TEXT | Timestamp de atualização |

### vendas
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | TEXT (UUID) | Chave primária |
| data_venda | TEXT | Timestamp da venda |
| subtotal | REAL | Soma dos itens |
| desconto | REAL | Valor do desconto (≥ 0) |
| total | REAL | subtotal - desconto |
| forma_pagamento | TEXT | dinheiro/cartao_debito/cartao_credito/pix |
| status | TEXT | Status da venda |

### itens_venda
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | TEXT (UUID) | Chave primária |
| venda_id | TEXT | FK → vendas.id |
| produto_id | TEXT | FK → produtos.id |
| nome_produto | TEXT | Snapshot do nome (desnormalizado) |
| quantidade | INTEGER | Quantidade vendida (> 0) |
| preco_unitario | REAL | Preço no momento da venda |
| subtotal | REAL | quantidade × preco_unitario |

---

## Considerações de Segurança

### Backend
- **Helmet**: Headers HTTP de segurança (CSP, HSTS, etc.)
- **CORS**: Restrito a origens conhecidas (localhost:5173, localhost:3000)
- **Rate Limiting**: 100 requisições/minuto por IP
- **Validação**: express-validator em todos os endpoints
- **Sanitização**: escape() em campos de texto
- **Parametrized Queries**: SQLite prepared statements (previne SQL injection)
- **Soft Delete**: Dados nunca são removidos fisicamente
- **Transações**: Vendas usam `db.transaction()` para consistência

### Frontend
- **XSS**: React escapa output por padrão (JSX)
- **Sem dados sensíveis**: Nenhum secret/token no client
- **Validação dupla**: Frontend valida antes de enviar, backend valida novamente

### Boas Práticas Aplicadas
- Input validation em ambas as camadas
- Nunca confiar em dados do frontend
- UUIDs em vez de IDs sequenciais (previne enumeração)
- Limites de payload (1MB max no body parser)
- Error handling padronizado (sem stack traces em produção)
