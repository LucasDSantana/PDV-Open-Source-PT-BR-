const express = require('express');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { executar, buscarUm, buscarTodos, salvarNoDisco } = require('../database/esquema');
const { validarVenda, validarId, validarFiltroData } = require('../middleware/validacao');

const router = express.Router();

function tratarErrosValidacao(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });
  }
  next();
}

// POST /api/vendas - Registrar venda
router.post('/', validarVenda, tratarErrosValidacao, (req, res) => {
  try {
    const { itens, desconto = 0, forma_pagamento, operador_id, caixa_id, valor_recebido, troco } = req.body;
    const vendaId = uuidv4();

    let subtotal = 0;
    const itensProcessados = [];

    // Validar e calcular itens
    for (const item of itens) {
      const produto = buscarUm('SELECT * FROM produtos WHERE id = ? AND ativo = 1', [item.produto_id]);
      if (!produto) {
        return res.status(400).json({ erro: `Produto ${item.produto_id} não encontrado` });
      }
      if (produto.estoque < item.quantidade) {
        return res.status(400).json({ erro: `Estoque insuficiente para "${produto.nome}". Disponível: ${produto.estoque}` });
      }

      const itemSubtotal = produto.preco * item.quantidade;
      subtotal += itemSubtotal;

      itensProcessados.push({
        id: uuidv4(),
        venda_id: vendaId,
        produto_id: produto.id,
        nome_produto: produto.nome,
        quantidade: item.quantidade,
        preco_unitario: produto.preco,
        subtotal: itemSubtotal,
      });
    }

    const descontoValor = parseFloat(desconto) || 0;
    const total = Math.max(0, subtotal - descontoValor);

    // Inserir venda com campos novos
    executar(
      `INSERT INTO vendas (id, subtotal, desconto, total, forma_pagamento, status, operador_id, caixa_id, valor_recebido, troco) VALUES (?, ?, ?, ?, ?, 'finalizada', ?, ?, ?, ?)`,
      [
        vendaId, subtotal, descontoValor, total, forma_pagamento,
        operador_id || null,
        caixa_id || null,
        valor_recebido != null ? parseFloat(valor_recebido) : null,
        troco != null ? parseFloat(troco) : null,
      ]
    );

    // Inserir itens e atualizar estoque
    for (const item of itensProcessados) {
      executar(
        'INSERT INTO itens_venda (id, venda_id, produto_id, nome_produto, quantidade, preco_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.id, item.venda_id, item.produto_id, item.nome_produto, item.quantidade, item.preco_unitario, item.subtotal]
      );
      executar(
        "UPDATE produtos SET estoque = estoque - ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?",
        [item.quantidade, item.produto_id]
      );
    }

    salvarNoDisco();

    const venda = buscarUm('SELECT * FROM vendas WHERE id = ?', [vendaId]);
    const itensVenda = buscarTodos('SELECT * FROM itens_venda WHERE venda_id = ?', [vendaId]);

    res.status(201).json({ ...venda, itens: itensVenda });
  } catch (erro) {
    console.error('Erro ao registrar venda:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/vendas
router.get('/', validarFiltroData, tratarErrosValidacao, (req, res) => {
  try {
    const { data_inicio, data_fim, pagina = 1, limite = 20 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    let sql = 'SELECT * FROM vendas WHERE 1=1';
    const params = [];

    if (data_inicio) { sql += ' AND data_venda >= ?'; params.push(data_inicio); }
    if (data_fim) { sql += ' AND data_venda <= ?'; params.push(data_fim + ' 23:59:59'); }

    sql += ' ORDER BY data_venda DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limite), offset);

    const vendas = buscarTodos(sql, params);

    let sqlTotal = 'SELECT COUNT(*) as total FROM vendas WHERE 1=1';
    const paramsTotal = [];
    if (data_inicio) { sqlTotal += ' AND data_venda >= ?'; paramsTotal.push(data_inicio); }
    if (data_fim) { sqlTotal += ' AND data_venda <= ?'; paramsTotal.push(data_fim + ' 23:59:59'); }
    const totalObj = buscarUm(sqlTotal, paramsTotal);

    res.json({ vendas, total: totalObj?.total || 0, pagina: parseInt(pagina), limite: parseInt(limite) });
  } catch (erro) {
    console.error('Erro ao listar vendas:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/vendas/relatorio/resumo
router.get('/relatorio/resumo', (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;

    let sql = `SELECT 
      COUNT(*) as total_vendas,
      COALESCE(SUM(total), 0) as receita_total,
      COALESCE(AVG(total), 0) as ticket_medio,
      COALESCE(SUM(desconto), 0) as desconto_total,
      COALESCE(MAX(total), 0) as maior_venda,
      COALESCE(MIN(total), 0) as menor_venda
    FROM vendas WHERE status = 'finalizada'`;
    const params = [];

    if (data_inicio) { sql += ' AND data_venda >= ?'; params.push(data_inicio); }
    if (data_fim) { sql += ' AND data_venda <= ?'; params.push(data_fim + ' 23:59:59'); }

    const resumo = buscarUm(sql, params);

    // Por forma de pagamento
    let sqlPag = `SELECT forma_pagamento, COUNT(*) as quantidade, COALESCE(SUM(total), 0) as total 
      FROM vendas WHERE status = 'finalizada'`;
    const paramsPag = [];
    if (data_inicio) { sqlPag += ' AND data_venda >= ?'; paramsPag.push(data_inicio); }
    if (data_fim) { sqlPag += ' AND data_venda <= ?'; paramsPag.push(data_fim + ' 23:59:59'); }
    sqlPag += ' GROUP BY forma_pagamento';

    const porPagamento = buscarTodos(sqlPag, paramsPag);

    // Top produtos
    let sqlTop = `SELECT iv.nome_produto, SUM(iv.quantidade) as total_quantidade,
      SUM(iv.subtotal) as total_valor
      FROM itens_venda iv JOIN vendas v ON v.id = iv.venda_id
      WHERE v.status = 'finalizada'`;
    const paramsTop = [];
    if (data_inicio) { sqlTop += ' AND v.data_venda >= ?'; paramsTop.push(data_inicio); }
    if (data_fim) { sqlTop += ' AND v.data_venda <= ?'; paramsTop.push(data_fim + ' 23:59:59'); }
    sqlTop += ' GROUP BY iv.nome_produto ORDER BY total_quantidade DESC LIMIT 10';

    const topProdutos = buscarTodos(sqlTop, paramsTop);

    res.json({ resumo, por_pagamento: porPagamento, top_produtos: topProdutos });
  } catch (erro) {
    console.error('Erro ao gerar relatório:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/vendas/:id
router.get('/:id', validarId, tratarErrosValidacao, (req, res) => {
  try {
    const venda = buscarUm('SELECT * FROM vendas WHERE id = ?', [req.params.id]);
    if (!venda) return res.status(404).json({ erro: 'Venda não encontrada' });
    const itens = buscarTodos('SELECT * FROM itens_venda WHERE venda_id = ?', [req.params.id]);
    res.json({ ...venda, itens });
  } catch (erro) {
    console.error('Erro ao buscar venda:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;
