const express = require('express');
const { validationResult, body } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { executar, buscarUm, buscarTodos } = require('../database/esquema');
const { verificarToken, apenasGerente } = require('../middleware/autenticacao');

const router = express.Router();

function tratarErrosValidacao(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });
  }
  next();
}

// ══════════════════════════════════════════════════════════
// POST /api/caixas/abrir — Abrir caixa
// ══════════════════════════════════════════════════════════
router.post('/abrir', verificarToken, [
  body('numero').isInt({ min: 1, max: 10 }).withMessage('Número do caixa deve ser entre 1 e 10'),
  body('valor_abertura').isFloat({ min: 0 }).withMessage('Valor de abertura deve ser positivo'),
], tratarErrosValidacao, (req, res) => {
  try {
    const { numero, valor_abertura } = req.body;

    // Verificar se o caixa com este número já está aberto
    const caixaAberto = buscarUm(
      "SELECT * FROM caixas WHERE numero = ? AND status = 'aberto'",
      [numero]
    );
    if (caixaAberto) {
      return res.status(409).json({
        erro: `Caixa ${numero} já está aberto por ${caixaAberto.usuario_abertura_nome}`,
      });
    }

    // Verificar se o operador já tem um caixa aberto
    const caixaDoOperador = buscarUm(
      "SELECT * FROM caixas WHERE usuario_abertura_id = ? AND status = 'aberto'",
      [req.usuario.id]
    );
    if (caixaDoOperador) {
      return res.status(409).json({
        erro: `Você já possui o Caixa ${caixaDoOperador.numero} aberto. Feche-o antes de abrir outro.`,
      });
    }

    const id = uuidv4();
    const nome = `Caixa ${numero}`;

    executar(
      'INSERT INTO caixas (id, numero, nome, status, usuario_abertura_id, usuario_abertura_nome, valor_abertura) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, numero, nome, 'aberto', req.usuario.id, req.usuario.nome, parseFloat(valor_abertura)]
    );

    const caixa = buscarUm('SELECT * FROM caixas WHERE id = ?', [id]);
    res.status(201).json(caixa);
  } catch (erro) {
    console.error('Erro ao abrir caixa:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/caixas/:id/fechar — Fechar caixa
// ══════════════════════════════════════════════════════════
router.post('/:id/fechar', verificarToken, [
  body('valor_fechamento').isFloat({ min: 0 }).withMessage('Valor de fechamento deve ser positivo'),
  body('observacao').optional().isString(),
], tratarErrosValidacao, (req, res) => {
  try {
    const { id } = req.params;
    const { valor_fechamento, observacao } = req.body;

    const caixa = buscarUm("SELECT * FROM caixas WHERE id = ? AND status = 'aberto'", [id]);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado ou já está fechado' });
    }

    // Calcular o valor esperado no sistema
    const vendasDinheiro = buscarUm(
      "SELECT COALESCE(SUM(total), 0) as total FROM vendas WHERE caixa_id = ? AND forma_pagamento = 'dinheiro' AND status = 'finalizada'",
      [id]
    );
    const sangrias = buscarUm(
      "SELECT COALESCE(SUM(valor), 0) as total FROM movimentacoes_caixa WHERE caixa_id = ? AND tipo = 'sangria'",
      [id]
    );
    const suprimentos = buscarUm(
      "SELECT COALESCE(SUM(valor), 0) as total FROM movimentacoes_caixa WHERE caixa_id = ? AND tipo = 'suprimento'",
      [id]
    );

    const valorSistema = caixa.valor_abertura
      + (vendasDinheiro?.total || 0)
      + (suprimentos?.total || 0)
      - (sangrias?.total || 0);

    const diferenca = parseFloat(valor_fechamento) - valorSistema;

    executar(
      `UPDATE caixas SET 
        status = 'fechado',
        valor_fechamento = ?,
        valor_sistema = ?,
        diferenca = ?,
        data_fechamento = datetime('now', 'localtime'),
        observacao_fechamento = ?
      WHERE id = ?`,
      [parseFloat(valor_fechamento), valorSistema, diferenca, observacao || '', id]
    );

    const caixaFechado = buscarUm('SELECT * FROM caixas WHERE id = ?', [id]);
    res.json(caixaFechado);
  } catch (erro) {
    console.error('Erro ao fechar caixa:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/caixas — Listar caixas
// ══════════════════════════════════════════════════════════
router.get('/', verificarToken, (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM caixas';
    const params = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY data_abertura DESC LIMIT 50';
    const caixas = buscarTodos(sql, params);
    res.json(caixas);
  } catch (erro) {
    console.error('Erro ao listar caixas:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/caixas/meu — Caixa aberto do operador logado
// ══════════════════════════════════════════════════════════
router.get('/meu', verificarToken, (req, res) => {
  try {
    const caixa = buscarUm(
      "SELECT * FROM caixas WHERE usuario_abertura_id = ? AND status = 'aberto'",
      [req.usuario.id]
    );
    res.json(caixa || null);
  } catch (erro) {
    console.error('Erro ao buscar caixa do operador:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/caixas/:id — Detalhes do caixa
// ══════════════════════════════════════════════════════════
router.get('/:id', verificarToken, (req, res) => {
  try {
    const caixa = buscarUm('SELECT * FROM caixas WHERE id = ?', [req.params.id]);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    const movimentacoes = buscarTodos(
      'SELECT * FROM movimentacoes_caixa WHERE caixa_id = ? ORDER BY criado_em DESC',
      [req.params.id]
    );

    const vendas = buscarTodos(
      "SELECT id, data_venda, total, forma_pagamento, valor_recebido, troco FROM vendas WHERE caixa_id = ? AND status = 'finalizada' ORDER BY data_venda DESC",
      [req.params.id]
    );

    res.json({ ...caixa, movimentacoes, vendas });
  } catch (erro) {
    console.error('Erro ao buscar caixa:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/caixas/:id/resumo — Resumo financeiro do caixa
// ══════════════════════════════════════════════════════════
router.get('/:id/resumo', verificarToken, (req, res) => {
  try {
    const caixa = buscarUm('SELECT * FROM caixas WHERE id = ?', [req.params.id]);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado' });
    }

    const totalVendas = buscarUm(
      "SELECT COUNT(*) as quantidade, COALESCE(SUM(total), 0) as valor FROM vendas WHERE caixa_id = ? AND status = 'finalizada'",
      [req.params.id]
    );

    const porFormaPagamento = buscarTodos(
      "SELECT forma_pagamento, COUNT(*) as quantidade, COALESCE(SUM(total), 0) as valor FROM vendas WHERE caixa_id = ? AND status = 'finalizada' GROUP BY forma_pagamento",
      [req.params.id]
    );

    const sangrias = buscarUm(
      "SELECT COUNT(*) as quantidade, COALESCE(SUM(valor), 0) as valor FROM movimentacoes_caixa WHERE caixa_id = ? AND tipo = 'sangria'",
      [req.params.id]
    );

    const suprimentos = buscarUm(
      "SELECT COUNT(*) as quantidade, COALESCE(SUM(valor), 0) as valor FROM movimentacoes_caixa WHERE caixa_id = ? AND tipo = 'suprimento'",
      [req.params.id]
    );

    const dinheiroCaixa = buscarUm(
      "SELECT COALESCE(SUM(total), 0) as valor FROM vendas WHERE caixa_id = ? AND forma_pagamento = 'dinheiro' AND status = 'finalizada'",
      [req.params.id]
    );

    const saldoEsperado = caixa.valor_abertura
      + (dinheiroCaixa?.valor || 0)
      + (suprimentos?.valor || 0)
      - (sangrias?.valor || 0);

    res.json({
      caixa,
      total_vendas: totalVendas,
      por_forma_pagamento: porFormaPagamento,
      sangrias,
      suprimentos,
      saldo_esperado: saldoEsperado,
    });
  } catch (erro) {
    console.error('Erro ao gerar resumo:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/caixas/:id/sangria — Retirada de dinheiro
// ══════════════════════════════════════════════════════════
router.post('/:id/sangria', verificarToken, [
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser positivo'),
  body('observacao').optional().isString(),
], tratarErrosValidacao, (req, res) => {
  try {
    const caixa = buscarUm("SELECT * FROM caixas WHERE id = ? AND status = 'aberto'", [req.params.id]);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado ou fechado' });
    }

    const id = uuidv4();
    executar(
      'INSERT INTO movimentacoes_caixa (id, caixa_id, tipo, valor, observacao, usuario_id, usuario_nome) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.id, 'sangria', parseFloat(req.body.valor), req.body.observacao || '', req.usuario.id, req.usuario.nome]
    );

    const movimentacao = buscarUm('SELECT * FROM movimentacoes_caixa WHERE id = ?', [id]);
    res.status(201).json(movimentacao);
  } catch (erro) {
    console.error('Erro na sangria:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/caixas/:id/suprimento — Adição de dinheiro
// ══════════════════════════════════════════════════════════
router.post('/:id/suprimento', verificarToken, [
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser positivo'),
  body('observacao').optional().isString(),
], tratarErrosValidacao, (req, res) => {
  try {
    const caixa = buscarUm("SELECT * FROM caixas WHERE id = ? AND status = 'aberto'", [req.params.id]);
    if (!caixa) {
      return res.status(404).json({ erro: 'Caixa não encontrado ou fechado' });
    }

    const id = uuidv4();
    executar(
      'INSERT INTO movimentacoes_caixa (id, caixa_id, tipo, valor, observacao, usuario_id, usuario_nome) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.id, 'suprimento', parseFloat(req.body.valor), req.body.observacao || '', req.usuario.id, req.usuario.nome]
    );

    const movimentacao = buscarUm('SELECT * FROM movimentacoes_caixa WHERE id = ?', [id]);
    res.status(201).json(movimentacao);
  } catch (erro) {
    console.error('Erro no suprimento:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;
