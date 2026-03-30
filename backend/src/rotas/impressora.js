const express = require('express');
const { body } = require('express-validator');
const impressora = require('../servicos/impressora');
const { verificarToken } = require('../middleware/autenticacao');

const router = express.Router();

// GET /api/impressora/status
router.get('/status', verificarToken, async (req, res) => {
  try {
    const status = await impressora.verificarImpressora();
    res.json(status);
  } catch (erro) {
    console.error('Erro ao verificar impressora:', erro);
    res.status(500).json({ erro: 'Erro ao verificar impressora' });
  }
});

// POST /api/impressora/imprimir-cupom
router.post('/imprimir-cupom', verificarToken, (req, res) => {
  try {
    const { venda, operador, caixa } = req.body;

    if (!venda) {
      return res.status(400).json({ erro: 'Dados da venda são obrigatórios' });
    }

    const cupom = impressora.gerarCupomESCPOS(venda, operador, caixa);

    impressora.enviarParaImpressora(cupom)
      .then(resultado => {
        res.json({ sucesso: true, ...resultado });
      })
      .catch(erro => {
        console.error('Erro ao imprimir:', erro);
        res.status(500).json({ erro: erro.message });
      });
  } catch (erro) {
    console.error('Erro ao gerar cupom:', erro);
    res.status(500).json({ erro: 'Erro ao gerar cupom' });
  }
});

// POST /api/impressora/testar
router.post('/testar', verificarToken, async (req, res) => {
  try {
    const dados = impressora.gerarPaginaTeste();
    const resultado = await impressora.enviarParaImpressora(dados);
    res.json({ sucesso: true, ...resultado });
  } catch (erro) {
    console.error('Erro no teste de impressão:', erro);
    res.status(500).json({ erro: erro.message });
  }
});

module.exports = router;
