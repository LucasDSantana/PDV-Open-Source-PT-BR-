const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'pdv.db');

let db = null;
let inicializado = false;

async function conectar() {
  if (db && inicializado) return db;

  const SQL = await initSqlJs();

  // Carregar banco existente ou criar novo
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  criarTabelas();
  inicializado = true;
  return db;
}

function criarTabelas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      codigo_barras TEXT UNIQUE,
      nome TEXT NOT NULL,
      preco REAL NOT NULL CHECK(preco >= 0),
      estoque INTEGER NOT NULL DEFAULT 0 CHECK(estoque >= 0),
      categoria TEXT DEFAULT 'Geral',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vendas (
      id TEXT PRIMARY KEY,
      data_venda TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      subtotal REAL NOT NULL DEFAULT 0,
      desconto REAL NOT NULL DEFAULT 0 CHECK(desconto >= 0),
      total REAL NOT NULL DEFAULT 0,
      forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
      status TEXT NOT NULL DEFAULT 'finalizada',
      operador_id TEXT DEFAULT NULL,
      caixa_id TEXT DEFAULT NULL,
      valor_recebido REAL DEFAULT NULL,
      troco REAL DEFAULT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS itens_venda (
      id TEXT PRIMARY KEY,
      venda_id TEXT NOT NULL,
      produto_id TEXT NOT NULL,
      nome_produto TEXT NOT NULL,
      quantidade INTEGER NOT NULL CHECK(quantidade > 0),
      preco_unitario REAL NOT NULL CHECK(preco_unitario >= 0),
      subtotal REAL NOT NULL CHECK(subtotal >= 0),
      FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )
  `);

  // ── Tabela de Usuários ──
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'operador' CHECK(perfil IN ('operador', 'gerente')),
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // ── Tabela de Caixas ──
  db.run(`
    CREATE TABLE IF NOT EXISTS caixas (
      id TEXT PRIMARY KEY,
      numero INTEGER NOT NULL,
      nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberto' CHECK(status IN ('aberto', 'fechado')),
      usuario_abertura_id TEXT NOT NULL,
      usuario_abertura_nome TEXT NOT NULL,
      valor_abertura REAL NOT NULL DEFAULT 0,
      valor_fechamento REAL DEFAULT NULL,
      valor_sistema REAL DEFAULT NULL,
      diferenca REAL DEFAULT NULL,
      data_abertura TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      data_fechamento TEXT DEFAULT NULL,
      observacao_fechamento TEXT DEFAULT NULL
    )
  `);

  // ── Tabela de Movimentações de Caixa ──
  db.run(`
    CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
      id TEXT PRIMARY KEY,
      caixa_id TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('sangria', 'suprimento')),
      valor REAL NOT NULL CHECK(valor > 0),
      observacao TEXT DEFAULT '',
      usuario_id TEXT NOT NULL,
      usuario_nome TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (caixa_id) REFERENCES caixas(id)
    )
  `);

  // ── Migração: adicionar colunas novas em vendas existentes ──
  const colunas = buscarTodos("PRAGMA table_info(vendas)");
  const nomes = colunas.map(c => c.name);
  if (!nomes.includes('operador_id')) {
    try { db.run("ALTER TABLE vendas ADD COLUMN operador_id TEXT DEFAULT NULL"); } catch(e) {}
  }
  if (!nomes.includes('caixa_id')) {
    try { db.run("ALTER TABLE vendas ADD COLUMN caixa_id TEXT DEFAULT NULL"); } catch(e) {}
  }
  if (!nomes.includes('valor_recebido')) {
    try { db.run("ALTER TABLE vendas ADD COLUMN valor_recebido REAL DEFAULT NULL"); } catch(e) {}
  }
  if (!nomes.includes('troco')) {
    try { db.run("ALTER TABLE vendas ADD COLUMN troco REAL DEFAULT NULL"); } catch(e) {}
  }

  // Índices
  try { db.run('CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo_barras)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_itens_venda_venda ON itens_venda(venda_id)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_caixas_status ON caixas(status)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_movimentacoes_caixa ON movimentacoes_caixa(caixa_id)'); } catch(e) {}
}

function salvarNoDisco() {
  if (!db) return;
  const dados = db.export();
  const buffer = Buffer.from(dados);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helpers para consultas (simula API do better-sqlite3)
function executar(sql, params = []) {
  db.run(sql, params);
  salvarNoDisco();
}

function buscarUm(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const colunas = stmt.getColumnNames();
    const valores = stmt.get();
    stmt.free();
    const obj = {};
    colunas.forEach((col, i) => obj[col] = valores[i]);
    return obj;
  }
  stmt.free();
  return null;
}

function buscarTodos(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const resultado = [];
  const colunas = stmt.getColumnNames();
  while (stmt.step()) {
    const valores = stmt.get();
    const obj = {};
    colunas.forEach((col, i) => obj[col] = valores[i]);
    resultado.push(obj);
  }
  stmt.free();
  return resultado;
}

module.exports = { conectar, executar, buscarUm, buscarTodos, salvarNoDisco };
