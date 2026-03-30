const jwt = require('jsonwebtoken');

const JWT_SEGREDO = process.env.JWT_SEGREDO || 'pdv-open-source-segredo-temporario-2024';
const JWT_EXPIRACAO = '12h';

/**
 * Middleware: Verificar token JWT
 * Adiciona req.usuario com { id, login, nome, perfil }
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
  }

  const partes = authHeader.split(' ');
  if (partes.length !== 2 || partes[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Formato de token inválido. Use: Bearer <token>' });
  }

  const token = partes[1];

  try {
    const decodificado = jwt.verify(token, JWT_SEGREDO);
    req.usuario = {
      id: decodificado.id,
      login: decodificado.login,
      nome: decodificado.nome,
      perfil: decodificado.perfil,
    };
    next();
  } catch (erro) {
    if (erro.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

/**
 * Middleware: Apenas gerentes
 */
function apenasGerente(req, res, next) {
  if (!req.usuario || req.usuario.perfil !== 'gerente') {
    return res.status(403).json({ erro: 'Acesso negado. Apenas gerentes podem acessar esta funcionalidade.' });
  }
  next();
}

/**
 * Gerar token JWT
 */
function gerarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      login: usuario.login,
      nome: usuario.nome,
      perfil: usuario.perfil,
    },
    JWT_SEGREDO,
    { expiresIn: JWT_EXPIRACAO }
  );
}

module.exports = { verificarToken, apenasGerente, gerarToken };
