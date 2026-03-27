require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { conectar } = require('./database/esquema');

const app = express();
const PORTA = process.env.PORT || 3002;

// ── Segurança ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

const limitador = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { erro: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limitador);

// ── Body Parser ──────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rotas ────────────────────────────────────────────────
const rotasProdutos = require('./rotas/produtos');
const rotasVendas = require('./rotas/vendas');
const rotasPagamentos = require('./rotas/pagamentos');

app.use('/api/produtos', rotasProdutos);
app.use('/api/vendas', rotasVendas);
app.use('/api/pagamentos', rotasPagamentos);

app.get('/api/saude', (req, res) => {
  const abacatepay = require('./servicos/abacatepay');
  const tef = require('./servicos/tef');
  res.json({
    status: 'ok',
    versao: '1.0.0',
    timestamp: new Date().toISOString(),
    abacatepay: abacatepay.estaConfigurado() ? 'configurado' : 'não configurado',
    tef: tef.obterInfo(),
  });
});

// ── Tratamento de erros ──────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((erro, req, res, next) => {
  console.error('Erro não tratado:', erro);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// ── Iniciar ──────────────────────────────────────────────
async function iniciar() {
  await conectar();
  app.listen(PORTA, () => {
    console.log(`\n🟢 PDV Backend rodando em http://localhost:${PORTA}`);
    console.log(`   API disponível em http://localhost:${PORTA}/api`);
    const abacatepay = require('./servicos/abacatepay');
    const tef = require('./servicos/tef');
    if (abacatepay.estaConfigurado()) {
      console.log('   🥑 AbacatePay (PIX): Integração ATIVA');
    } else {
      console.log('   ⚠️  AbacatePay (PIX): Não configurado');
    }
    if (tef.estaConfigurado()) {
      const info = tef.obterInfo();
      console.log(`   📠 TEF/PINPAD (Cartão): ${info.provedor.toUpperCase()} → ${info.terminal}`);
    } else {
      console.log('   ⚠️  TEF/PINPAD (Cartão): Não habilitado');
    }
    console.log('');
  });
}

iniciar().catch(console.error);

module.exports = app;
