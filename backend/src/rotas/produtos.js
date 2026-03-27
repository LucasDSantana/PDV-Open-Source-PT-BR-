const express = require('express');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { executar, buscarUm, buscarTodos } = require('../database/esquema');
const { validarProduto, validarId } = require('../middleware/validacao');

const router = express.Router();

function tratarErrosValidacao(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });
  }
  next();
}

// GET /api/produtos - Listar produtos com busca e paginação
router.get('/', (req, res) => {
  try {
    const { busca, categoria, pagina = 1, limite = 50 } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    let sql = 'SELECT * FROM produtos WHERE ativo = 1';
    const params = [];

    if (busca) {
      sql += ' AND (nome LIKE ? OR codigo_barras LIKE ?)';
      params.push(`%${busca}%`, `%${busca}%`);
    }
    if (categoria) {
      sql += ' AND categoria = ?';
      params.push(categoria);
    }

    sql += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limite), offset);

    const produtos = buscarTodos(sql, params);

    let sqlTotal = 'SELECT COUNT(*) as total FROM produtos WHERE ativo = 1';
    const paramsTotal = [];
    if (busca) {
      sqlTotal += ' AND (nome LIKE ? OR codigo_barras LIKE ?)';
      paramsTotal.push(`%${busca}%`, `%${busca}%`);
    }
    if (categoria) {
      sqlTotal += ' AND categoria = ?';
      paramsTotal.push(categoria);
    }
    const totalObj = buscarUm(sqlTotal, paramsTotal);

    res.json({ produtos, total: totalObj?.total || 0, pagina: parseInt(pagina), limite: parseInt(limite) });
  } catch (erro) {
    console.error('Erro ao listar produtos:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/produtos/busca/:termo
router.get('/busca/:termo', (req, res) => {
  try {
    const termo = req.params.termo;
    const produtos = buscarTodos(
      'SELECT * FROM produtos WHERE ativo = 1 AND (nome LIKE ? OR codigo_barras = ?) ORDER BY nome ASC LIMIT 20',
      [`%${termo}%`, termo]
    );
    res.json(produtos);
  } catch (erro) {
    console.error('Erro na busca:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/produtos/categorias
router.get('/categorias', (req, res) => {
  try {
    const categorias = buscarTodos('SELECT DISTINCT categoria FROM produtos WHERE ativo = 1 ORDER BY categoria ASC');
    res.json(categorias.map(c => c.categoria));
  } catch (erro) {
    console.error('Erro ao listar categorias:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// GET /api/produtos/:id
router.get('/:id', validarId, tratarErrosValidacao, (req, res) => {
  try {
    const produto = buscarUm('SELECT * FROM produtos WHERE id = ? AND ativo = 1', [req.params.id]);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json(produto);
  } catch (erro) {
    console.error('Erro ao buscar produto:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// POST /api/produtos
router.post('/', validarProduto, tratarErrosValidacao, (req, res) => {
  try {
    const { nome, preco, estoque = 0, categoria = 'Geral', codigo_barras = null } = req.body;
    const id = uuidv4();

    if (codigo_barras) {
      const existente = buscarUm('SELECT id FROM produtos WHERE codigo_barras = ?', [codigo_barras]);
      if (existente) return res.status(409).json({ erro: 'Código de barras já cadastrado' });
    }

    executar(
      'INSERT INTO produtos (id, codigo_barras, nome, preco, estoque, categoria) VALUES (?, ?, ?, ?, ?, ?)',
      [id, codigo_barras, nome, parseFloat(preco), parseInt(estoque), categoria]
    );

    const produto = buscarUm('SELECT * FROM produtos WHERE id = ?', [id]);
    res.status(201).json(produto);
  } catch (erro) {
    console.error('Erro ao criar produto:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// PUT /api/produtos/:id
router.put('/:id', [...validarId, ...validarProduto], tratarErrosValidacao, (req, res) => {
  try {
    const { nome, preco, estoque, categoria, codigo_barras } = req.body;

    const existente = buscarUm('SELECT * FROM produtos WHERE id = ? AND ativo = 1', [req.params.id]);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    if (codigo_barras) {
      const duplicado = buscarUm('SELECT id FROM produtos WHERE codigo_barras = ? AND id != ?', [codigo_barras, req.params.id]);
      if (duplicado) return res.status(409).json({ erro: 'Código de barras já cadastrado' });
    }

    executar(
      `UPDATE produtos SET nome = ?, preco = ?, estoque = ?, categoria = ?, codigo_barras = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
      [nome, parseFloat(preco), parseInt(estoque), categoria || 'Geral', codigo_barras || null, req.params.id]
    );

    const produto = buscarUm('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
    res.json(produto);
  } catch (erro) {
    console.error('Erro ao atualizar produto:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// DELETE /api/produtos/:id (soft delete)
router.delete('/:id', validarId, tratarErrosValidacao, (req, res) => {
  try {
    const existente = buscarUm('SELECT * FROM produtos WHERE id = ? AND ativo = 1', [req.params.id]);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });

    executar("UPDATE produtos SET ativo = 0, atualizado_em = datetime('now', 'localtime') WHERE id = ?", [req.params.id]);
    res.json({ mensagem: 'Produto removido com sucesso' });
  } catch (erro) {
    console.error('Erro ao remover produto:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;
