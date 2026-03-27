const { body, param, query } = require('express-validator');

// Validação para criação/atualização de produto
const validarProduto = [
  body('nome')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ min: 2, max: 200 }).withMessage('Nome deve ter entre 2 e 200 caracteres')
    .escape(),
  body('preco')
    .notEmpty().withMessage('Preço é obrigatório')
    .isFloat({ min: 0 }).withMessage('Preço deve ser um valor positivo'),
  body('estoque')
    .optional()
    .isInt({ min: 0 }).withMessage('Estoque deve ser um número inteiro positivo'),
  body('categoria')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Categoria deve ter no máximo 100 caracteres')
    .escape(),
  body('codigo_barras')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Código de barras deve ter no máximo 50 caracteres')
    .escape(),
];

// Validação para criação de venda
const validarVenda = [
  body('itens')
    .isArray({ min: 1 }).withMessage('Venda deve ter pelo menos 1 item'),
  body('itens.*.produto_id')
    .notEmpty().withMessage('ID do produto é obrigatório'),
  body('itens.*.quantidade')
    .isInt({ min: 1 }).withMessage('Quantidade deve ser pelo menos 1'),
  body('desconto')
    .optional()
    .isFloat({ min: 0 }).withMessage('Desconto deve ser um valor positivo'),
  body('forma_pagamento')
    .notEmpty().withMessage('Forma de pagamento é obrigatória')
    .isIn(['dinheiro', 'cartao_debito', 'cartao_credito', 'pix'])
    .withMessage('Forma de pagamento inválida'),
];

// Validação de parâmetro ID
const validarId = [
  param('id')
    .trim()
    .notEmpty().withMessage('ID é obrigatório'),
];

// Validação de filtro de data
const validarFiltroData = [
  query('data_inicio')
    .optional()
    .isISO8601().withMessage('Data de início inválida'),
  query('data_fim')
    .optional()
    .isISO8601().withMessage('Data de fim inválida'),
];

module.exports = {
  validarProduto,
  validarVenda,
  validarId,
  validarFiltroData,
};
