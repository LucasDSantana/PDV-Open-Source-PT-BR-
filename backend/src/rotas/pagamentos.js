const express = require('express');
const { validationResult, body, query } = require('express-validator');
const abacatepay = require('../servicos/abacatepay');
const tef = require('../servicos/tef');

const router = express.Router();

function tratarErrosValidacao(req, res, next) {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    return res.status(400).json({ erro: 'Dados inválidos', detalhes: erros.array() });
  }
  next();
}

// ══════════════════════════════════════════════════════════
// GET /api/pagamentos/status — Status geral dos provedores
// ══════════════════════════════════════════════════════════
router.get('/status', (req, res) => {
  res.json({
    abacatepay: {
      configurado: abacatepay.estaConfigurado(),
      metodos: ['PIX'],
    },
    tef: tef.obterInfo(),
    taxa_percentual: parseFloat(process.env.TAXA_SERVICO_PERCENTUAL || '0'),
  });
});

// ══════════════════════════════════════════════════════════
//  PIX — AbacatePay (primário) / TEF (fallback)
// ══════════════════════════════════════════════════════════

// POST /api/pagamentos/pix — Gerar QR Code PIX
router.post('/pix', [
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que R$ 0,01'),
  body('descricao').optional().isString().isLength({ max: 140 }),
  body('cliente.nome').optional().isString(),
  body('cliente.email').optional().isEmail(),
  body('cliente.celular').optional().isString(),
  body('cliente.cpfCnpj').optional().isString(),
], tratarErrosValidacao, async (req, res) => {
  try {
    let { valor, descricao, cliente } = req.body;
    const taxaPercentual = parseFloat(process.env.TAXA_SERVICO_PERCENTUAL || '0');

    // Aplicar taxa de serviço (split)
    if (taxaPercentual > 0) {
      valor = valor + valor * (taxaPercentual / 100);
    }

    // ── Tentar AbacatePay primeiro ──
    if (abacatepay.estaConfigurado()) {
      const resultado = await abacatepay.criarPixQRCode({
        valor: parseFloat(valor),
        descricao: descricao || `Pagamento PDV - R$ ${parseFloat(valor).toFixed(2)}`,
        cliente: cliente || null,
      });

      if (resultado.sucesso) {
        return res.status(201).json({
          provedor: 'abacatepay',
          id: resultado.dados.id,
          valor: resultado.dados.amount / 100,
          status: resultado.dados.status,
          qrcode: resultado.dados.brCode,
          qrcode_imagem: resultado.dados.brCodeBase64,
          expira_em: resultado.dados.expiresAt,
          dev_mode: resultado.dados.devMode,
        });
      }

      console.warn('[Pagamentos] AbacatePay falhou, tentando fallback TEF para PIX...');
    }

    // ── Fallback: TEF/PINPAD para PIX ──
    if (tef.estaConfigurado()) {
      const resultado = await tef.iniciarTransacao({
        valor: parseFloat(valor),
        tipo: 'debito', // PIX via PINPAD normalmente é tratado como débito
        descricao: descricao || 'Pagamento PIX via PINPAD',
      });

      if (resultado.sucesso) {
        return res.status(201).json({
          provedor: 'tef',
          id: resultado.transacao.id,
          valor: resultado.transacao.valor,
          status: resultado.transacao.status,
          mensagem: resultado.transacao.mensagem,
          dev_mode: resultado.transacao.dev_mode,
          // Sem QR Code no TEF — o PINPAD gera na tela da maquininha
          qrcode: null,
          qrcode_imagem: null,
        });
      }
    }

    return res.status(503).json({
      erro: 'Nenhum provedor de PIX disponível. Configure AbacatePay ou TEF no .env',
    });
  } catch (erro) {
    console.error('Erro ao gerar PIX:', erro);
    res.status(500).json({ erro: 'Erro interno ao gerar pagamento PIX' });
  }
});

// GET /api/pagamentos/pix/:id/status — Verificar status PIX
router.get('/pix/:id/status', async (req, res) => {
  try {
    const id = req.params.id;

    // Se começa com "tef_", é uma transação TEF
    if (id.startsWith('tef_')) {
      const resultado = tef.verificarStatus(id);
      if (!resultado.sucesso) {
        return res.status(404).json({ erro: resultado.erro });
      }
      // Mapear status TEF para o formato esperado pelo frontend
      const mapa = { APROVADO: 'PAID', RECUSADO: 'CANCELLED', CANCELADO: 'CANCELLED', TIMEOUT: 'EXPIRED' };
      return res.json({
        status: mapa[resultado.transacao.status] || resultado.transacao.status,
        mensagem: resultado.transacao.mensagem,
        provedor: 'tef',
      });
    }

    // Caso contrário, é AbacatePay
    if (!abacatepay.estaConfigurado()) {
      return res.status(503).json({ erro: 'AbacatePay não configurado' });
    }

    const resultado = await abacatepay.verificarStatusPix(id);
    if (!resultado.sucesso) {
      return res.status(resultado.status || 500).json({ erro: resultado.erro });
    }

    res.json({
      status: resultado.dados.status,
      expira_em: resultado.dados.expiresAt,
      provedor: 'abacatepay',
    });
  } catch (erro) {
    console.error('Erro ao verificar PIX:', erro);
    res.status(500).json({ erro: 'Erro interno ao verificar PIX' });
  }
});

// POST /api/pagamentos/pix/:id/simular — Simular pagamento PIX (DEV MODE)
router.post('/pix/:id/simular', async (req, res) => {
  try {
    const id = req.params.id;

    // Se é transação TEF
    if (id.startsWith('tef_')) {
      const resultado = tef.simularAprovacao(id);
      if (!resultado.sucesso) {
        return res.status(400).json({ erro: resultado.erro });
      }
      return res.json({
        id: resultado.transacao.id,
        status: 'PAID',
        mensagem: 'Pagamento simulado com sucesso (TEF)',
      });
    }

    // AbacatePay
    if (!abacatepay.estaConfigurado()) {
      return res.status(503).json({ erro: 'AbacatePay não configurado' });
    }

    const resultado = await abacatepay.simularPagamentoPix(id);
    if (!resultado.sucesso) {
      return res.status(resultado.status || 500).json({ erro: resultado.erro });
    }

    res.json({
      id: resultado.dados.id,
      status: resultado.dados.status,
      mensagem: 'Pagamento simulado com sucesso',
    });
  } catch (erro) {
    console.error('Erro ao simular PIX:', erro);
    res.status(500).json({ erro: 'Erro interno ao simular pagamento' });
  }
});

// ══════════════════════════════════════════════════════════
//  TEF/PINPAD — Cartão Crédito/Débito
// ══════════════════════════════════════════════════════════

// POST /api/pagamentos/tef/iniciar — Iniciar transação no terminal
router.post('/tef/iniciar', [
  body('valor').isFloat({ min: 0.01 }).withMessage('Valor deve ser maior que R$ 0,01'),
  body('tipo').isIn(['credito', 'debito']).withMessage('Tipo deve ser "credito" ou "debito"'),
  body('parcelas').optional().isInt({ min: 1, max: 12 }),
  body('descricao').optional().isString(),
], tratarErrosValidacao, async (req, res) => {
  try {
    let { valor, tipo, parcelas, descricao } = req.body;
    const taxaPercentual = parseFloat(process.env.TAXA_SERVICO_PERCENTUAL || '0');

    // Aplicar taxa de serviço
    if (taxaPercentual > 0) {
      valor = valor + valor * (taxaPercentual / 100);
    }

    if (!tef.estaConfigurado()) {
      return res.status(503).json({
        erro: 'TEF/PINPAD não configurado. Defina TEF_HABILITADO=true no .env',
      });
    }

    const resultado = await tef.iniciarTransacao({
      valor: parseFloat(valor),
      tipo,
      parcelas: parcelas || 1,
      descricao: descricao || `Venda PDV - ${tipo}`,
    });

    if (!resultado.sucesso) {
      return res.status(500).json({ erro: resultado.erro });
    }

    res.status(201).json({
      id: resultado.transacao.id,
      valor: resultado.transacao.valor,
      tipo: resultado.transacao.tipo,
      parcelas: resultado.transacao.parcelas,
      status: resultado.transacao.status,
      mensagem: resultado.transacao.mensagem,
      dev_mode: resultado.transacao.dev_mode,
    });
  } catch (erro) {
    console.error('Erro ao iniciar TEF:', erro);
    res.status(500).json({ erro: 'Erro interno ao iniciar transação TEF' });
  }
});

// GET /api/pagamentos/tef/:id/status — Consultar status da transação TEF
router.get('/tef/:id/status', (req, res) => {
  const resultado = tef.verificarStatus(req.params.id);

  if (!resultado.sucesso) {
    return res.status(404).json({ erro: resultado.erro });
  }

  res.json({
    id: resultado.transacao.id,
    status: resultado.transacao.status,
    mensagem: resultado.transacao.mensagem,
    nsu: resultado.transacao.nsu,
    autorizacao: resultado.transacao.autorizacao,
    bandeira: resultado.transacao.bandeira,
    dev_mode: resultado.transacao.dev_mode,
  });
});

// POST /api/pagamentos/tef/:id/cancelar — Cancelar transação TEF pendente
router.post('/tef/:id/cancelar', async (req, res) => {
  try {
    const resultado = await tef.cancelarTransacao(req.params.id);

    if (!resultado.sucesso) {
      return res.status(400).json({ erro: resultado.erro });
    }

    res.json({ mensagem: 'Transação cancelada' });
  } catch (erro) {
    console.error('Erro ao cancelar TEF:', erro);
    res.status(500).json({ erro: 'Erro interno ao cancelar transação' });
  }
});

// POST /api/pagamentos/tef/:id/simular-aprovacao — DEV MODE
router.post('/tef/:id/simular-aprovacao', (req, res) => {
  const resultado = tef.simularAprovacao(req.params.id);

  if (!resultado.sucesso) {
    return res.status(400).json({ erro: resultado.erro });
  }

  res.json({
    id: resultado.transacao.id,
    status: resultado.transacao.status,
    mensagem: resultado.transacao.mensagem,
    nsu: resultado.transacao.nsu,
    autorizacao: resultado.transacao.autorizacao,
    bandeira: resultado.transacao.bandeira,
  });
});

// POST /api/pagamentos/tef/:id/simular-recusa — DEV MODE
router.post('/tef/:id/simular-recusa', (req, res) => {
  const resultado = tef.simularRecusa(req.params.id);

  if (!resultado.sucesso) {
    return res.status(400).json({ erro: resultado.erro });
  }

  res.json({
    id: resultado.transacao.id,
    status: resultado.transacao.status,
    mensagem: resultado.transacao.mensagem,
  });
});

module.exports = router;
