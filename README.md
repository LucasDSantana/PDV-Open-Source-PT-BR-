# 🛒 PDV Open Source

Sistema de Ponto de Venda (POS) completo, moderno e open-source, desenvolvido em **PT-BR** para fins de portfólio.

---

## 📋 Visão Geral

O PDV Open Source é um sistema de caixa registradora projetado para simular operações reais de PDV. Possui interface escura otimizada para uso prolongado, operação completa via teclado e suporte a leitor de código de barras.

---

## ✨ Funcionalidades

### Núcleo
- **Cadastro de Produtos** — CRUD completo com código de barras, categoria, estoque
- **Tela de Vendas (PDV)** — Checkout rápido com busca instantânea
- **Carrinho de Compras** — Adicionar, remover, alterar quantidade
- **Finalização de Pagamento** — Dinheiro, Cartão Débito, Cartão Crédito, PIX (mockado)
- **Comprovante de Venda** — Geração automática de PDF (formato cupom 80mm)
- **Relatórios** — Resumo de vendas, ticket médio, top produtos, vendas por pagamento

### Operação
- 🎹 **Atalhos de teclado** completos (estilo PDV real)
- 📷 **Leitor de código de barras** (entrada via teclado)
- ⚡ **Interface ultra-rápida** com mínimo de cliques
- 🌙 **Tema escuro** otimizado para uso prolongado

---

## ⌨️ Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `F1` | Abrir ajuda |
| `F2` | Focar na busca de produtos |
| `F3` | Adicionar produto manualmente |
| `F4` | Ir para pagamento |
| `F5` | Atualizar tela |
| `F6` | Aplicar desconto |
| `F7` | Remover item selecionado |
| `F8` | Cancelar venda |
| `F9` | Finalizar venda |
| `ESC` | Voltar / Fechar modal |
| `ENTER` | Confirmar ação |
| `↑ / ↓` | Navegar nos resultados |

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite |
| Backend | Node.js + Express |
| Banco de Dados | SQLite (better-sqlite3) |
| PDF | jsPDF |
| Segurança | Helmet, CORS, Rate Limiting, express-validator |

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- **Node.js** 18+ instalado
- **npm** 9+

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/seu-usuario/pdv-open-source.git
cd pdv-open-source

# Instalar todas as dependências
npm run install:all

# Popular o banco com dados de exemplo
cd backend && npm run seed && cd ..

# Rodar frontend e backend simultaneamente
npm run dev
```

### Acessar
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api

---

## 📁 Estrutura do Projeto

```
PDV Open Source/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   ├── esquema.js        # Schema SQLite + conexão
│   │   │   └── seed.js           # Dados iniciais
│   │   ├── middleware/
│   │   │   └── validacao.js      # Regras de validação
│   │   ├── rotas/
│   │   │   ├── produtos.js       # API de produtos
│   │   │   └── vendas.js         # API de vendas
│   │   └── server.js             # Entry point Express
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── componentes/
│   │   │   ├── Comprovante.js    # Geração de PDF
│   │   │   └── ModalAjuda.jsx    # Modal de atalhos
│   │   ├── hooks/
│   │   │   └── useAtalhos.js     # Hook de atalhos
│   │   ├── paginas/
│   │   │   ├── PDV.jsx           # Tela principal de vendas
│   │   │   ├── Produtos.jsx      # CRUD de produtos
│   │   │   └── Relatorios.jsx    # Dashboard de relatórios
│   │   ├── servicos/
│   │   │   └── api.js            # Camada de comunicação HTTP
│   │   ├── utils/
│   │   │   └── formatadores.js   # Formatação de moeda/data
│   │   ├── App.jsx               # Componente raiz + navegação
│   │   ├── main.jsx              # Entry point React
│   │   └── index.css             # Design system completo
│   └── package.json
├── README.md                     # Este arquivo
├── DOCUMENTATION.md              # Documentação técnica
├── package.json                  # Scripts raiz
└── .gitignore
```

---

## 📸 Interface

### Tela de Vendas (PDV)
- Campo de busca com suporte a código de barras no topo
- Carrinho de compras à esquerda com controles de quantidade
- Painel de totais e ações à direita
- Barra de atalhos no rodapé

### Cadastro de Produtos
- Tabela com todos os produtos cadastrados
- Filtro por nome ou código de barras
- Modal de criação/edição

### Relatórios
- Cards de resumo (total vendas, receita, ticket médio)
- Gráfico de vendas por forma de pagamento
- Ranking de produtos mais vendidos
- Lista de todas as vendas com detalhes

---

## 🔮 Melhorias Futuras

- [ ] Autenticação e controle de acesso (operador/gerente)
- [ ] Múltiplos caixas simultâneos
- [ ] Integração com impressora térmica real
- [ ] Controle de troco para pagamento em dinheiro
- [ ] Dashboard em tempo real
- [ ] Exportação de relatórios (CSV/Excel)
- [ ] Sistema de promoções e descontos automáticos
- [ ] Sincronização com sistemas ERP
- [ ] Aplicativo móvel para consultas
- [ ] Testes automatizados (unitários + E2E)

---

## 📄 Licença

Este projeto é open-source e está disponível sob a licença [MIT](LICENSE).

---

> Desenvolvido com ⚡ para fins de portfólio e aprendizado.
