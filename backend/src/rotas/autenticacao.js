const express = require('express');
const { validationResult, body } = require('express-validator');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { executar, buscarUm, buscarTodos } = require('../database/esquema');
const { verificarToken, apenasGerente, gerarToken } = require('../middleware/autenticacao');

const router = express.Router();

function tratarErrosValidacao(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });
  }
  next();
}

// ══════════════════════════════════════════════════════════
// POST /api/auth/login — Login
// ══════════════════════════════════════════════════════════
router.post('/login', [
  body('login').trim().notEmpty().withMessage('Login é obrigatório'),
  body('senha').notEmpty().withMessage('Senha é obrigatória'),
], tratarErrosValidacao, (req, res) => {
  try {
    const { login, senha } = req.body;

    const usuario = buscarUm('SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]);
    if (!usuario) {
      return res.status(401).json({ erro: 'Login ou senha inválidos' });
    }

    const senhaCorreta = bcrypt.compareSync(senha, usuario.senha_hash);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Login ou senha inválidos' });
    }

    const token = gerarToken(usuario);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        perfil: usuario.perfil,
      },
    });
  } catch (erro) {
    console.error('Erro no login:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/auth/eu — Dados do usuário autenticado
// ══════════════════════════════════════════════════════════
router.get('/eu', verificarToken, (req, res) => {
  try {
    const usuario = buscarUm('SELECT id, nome, login, perfil, ativo, criado_em FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    res.json(usuario);
  } catch (erro) {
    console.error('Erro ao buscar usuário:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/auth/usuarios — Listar usuários (gerente)
// ══════════════════════════════════════════════════════════
router.get('/usuarios', verificarToken, apenasGerente, (req, res) => {
  try {
    const usuarios = buscarTodos(
      'SELECT id, nome, login, perfil, ativo, criado_em, atualizado_em FROM usuarios ORDER BY nome ASC'
    );
    res.json(usuarios);
  } catch (erro) {
    console.error('Erro ao listar usuários:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/auth/usuarios — Criar usuário (gerente)
// ══════════════════════════════════════════════════════════
router.post('/usuarios', verificarToken, apenasGerente, [
  body('nome').trim().notEmpty().withMessage('Nome é obrigatório').isLength({ min: 2, max: 100 }),
  body('login').trim().notEmpty().withMessage('Login é obrigatório').isLength({ min: 3, max: 50 }),
  body('senha').notEmpty().withMessage('Senha é obrigatória').isLength({ min: 4 }).withMessage('Senha deve ter pelo menos 4 caracteres'),
  body('perfil').isIn(['operador', 'gerente']).withMessage('Perfil deve ser operador ou gerente'),
], tratarErrosValidacao, (req, res) => {
  try {
    const { nome, login, senha, perfil } = req.body;

    const existente = buscarUm('SELECT id FROM usuarios WHERE login = ?', [login]);
    if (existente) {
      return res.status(409).json({ erro: 'Login já está em uso' });
    }

    const id = uuidv4();
    const senhaHash = bcrypt.hashSync(senha, 10);

    executar(
      'INSERT INTO usuarios (id, nome, login, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)',
      [id, nome, login, senhaHash, perfil]
    );

    const usuario = buscarUm('SELECT id, nome, login, perfil, ativo, criado_em FROM usuarios WHERE id = ?', [id]);
    res.status(201).json(usuario);
  } catch (erro) {
    console.error('Erro ao criar usuário:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// PUT /api/auth/usuarios/:id — Editar usuário (gerente)
// ══════════════════════════════════════════════════════════
router.put('/usuarios/:id', verificarToken, apenasGerente, [
  body('nome').optional().trim().isLength({ min: 2, max: 100 }),
  body('login').optional().trim().isLength({ min: 3, max: 50 }),
  body('senha').optional().isLength({ min: 4 }),
  body('perfil').optional().isIn(['operador', 'gerente']),
  body('ativo').optional().isBoolean(),
], tratarErrosValidacao, (req, res) => {
  try {
    const { id } = req.params;
    const existente = buscarUm('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!existente) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    const { nome, login, senha, perfil, ativo } = req.body;

    if (login && login !== existente.login) {
      const duplicado = buscarUm('SELECT id FROM usuarios WHERE login = ? AND id != ?', [login, id]);
      if (duplicado) {
        return res.status(409).json({ erro: 'Login já está em uso' });
      }
    }

    const novoNome = nome || existente.nome;
    const novoLogin = login || existente.login;
    const novoPerfil = perfil || existente.perfil;
    const novoAtivo = ativo !== undefined ? (ativo ? 1 : 0) : existente.ativo;
    const novaSenha = senha ? bcrypt.hashSync(senha, 10) : existente.senha_hash;

    executar(
      `UPDATE usuarios SET nome = ?, login = ?, senha_hash = ?, perfil = ?, ativo = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
      [novoNome, novoLogin, novaSenha, novoPerfil, novoAtivo, id]
    );

    const atualizado = buscarUm('SELECT id, nome, login, perfil, ativo, criado_em, atualizado_em FROM usuarios WHERE id = ?', [id]);
    res.json(atualizado);
  } catch (erro) {
    console.error('Erro ao editar usuário:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// ══════════════════════════════════════════════════════════
// DELETE /api/auth/usuarios/:id — Desativar usuário (gerente)
// ══════════════════════════════════════════════════════════
router.delete('/usuarios/:id', verificarToken, apenasGerente, (req, res) => {
  try {
    const { id } = req.params;
    const existente = buscarUm('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!existente) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    // Não permite desativar o último gerente ativo
    if (existente.perfil === 'gerente') {
      const qtdGerentes = buscarUm("SELECT COUNT(*) as total FROM usuarios WHERE perfil = 'gerente' AND ativo = 1");
      if (qtdGerentes.total <= 1) {
        return res.status(400).json({ erro: 'Não é possível desativar o último gerente ativo' });
      }
    }

    executar(
      `UPDATE usuarios SET ativo = 0, atualizado_em = datetime('now', 'localtime') WHERE id = ?`,
      [id]
    );

    res.json({ mensagem: 'Usuário desativado com sucesso' });
  } catch (erro) {
    console.error('Erro ao desativar usuário:', erro);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

module.exports = router;
