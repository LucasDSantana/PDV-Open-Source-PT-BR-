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

  // Índices
  try { db.run('CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo_barras)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda)'); } catch(e) {}
  try { db.run('CREATE INDEX IF NOT EXISTS idx_itens_venda_venda ON itens_venda(venda_id)'); } catch(e) {}
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
