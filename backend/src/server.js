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
  origin: ['http://localhost:5174', 'http://localhost:5173', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
}));

const limitador = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { erro: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limitador);

// ── Body Parser ──────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rotas ────────────────────────────────────────────────
const rotasAutenticacao = require('./rotas/autenticacao');
const rotasProdutos = require('./rotas/produtos');
const rotasVendas = require('./rotas/vendas');
const rotasPagamentos = require('./rotas/pagamentos');
const rotasCaixas = require('./rotas/caixas');
const rotasImpressora = require('./rotas/impressora');
const rotasRelatorios = require('./rotas/relatorios');

// Auth é pública (login não precisa de token)
app.use('/api/auth', rotasAutenticacao);

// Rotas protegidas por token (o middleware verificarToken está dentro de cada rota)
app.use('/api/produtos', rotasProdutos);
app.use('/api/vendas', rotasVendas);
app.use('/api/pagamentos', rotasPagamentos);
app.use('/api/caixas', rotasCaixas);
app.use('/api/impressora', rotasImpressora);
app.use('/api/relatorios', rotasRelatorios);

app.get('/api/saude', (req, res) => {
  const abacatepay = require('./servicos/abacatepay');
  const tef = require('./servicos/tef');
  const impressoraServ = require('./servicos/impressora');
  res.json({
    status: 'ok',
    versao: '2.0.0',
    timestamp: new Date().toISOString(),
    abacatepay: abacatepay.estaConfigurado() ? 'configurado' : 'não configurado',
    tef: tef.obterInfo(),
    impressora: impressoraServ.obterInfo(),
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
    const impressoraServ = require('./servicos/impressora');
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
    const infoImpressora = impressoraServ.obterInfo();
    if (infoImpressora.habilitada) {
      console.log(`   🖨️  Impressora Térmica: ${infoImpressora.ip}:${infoImpressora.porta}`);
    } else {
      console.log('   🖨️  Impressora Térmica: Modo simulado');
    }
    console.log('   🔐 Autenticação: JWT ativa');
    console.log('   💼 Caixas: Multi-caixa habilitado (1-10)');
    console.log('   📊 Relatórios: Exportação Excel/CSV');
    console.log('');
  });
}

iniciar().catch(console.error);

module.exports = app;
