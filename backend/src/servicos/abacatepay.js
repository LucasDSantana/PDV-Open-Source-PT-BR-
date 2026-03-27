/**
 * Serviço de integração com a API da AbacatePay
 * Documentação: https://docs.abacatepay.com
 * 
 * Endpoints utilizados:
 * - POST /v1/customer/create    → Criar cliente
 * - POST /v1/billing/create     → Criar cobrança (checkout)
 * - GET  /v1/billing/get?id=    → Buscar cobrança
 * - GET  /v1/billing/list       → Listar cobranças
 * - POST /v1/pixQrCode/create   → Gerar QR Code PIX
 * - GET  /v1/pixQrCode/check    → Verificar status do PIX
 */

const API_URL = process.env.ABACATEPAY_API_URL || 'https://api.abacatepay.com/v1';
const API_KEY = process.env.ABACATEPAY_API_KEY;

function obterHeaders() {
  if (!API_KEY || API_KEY === 'sua_chave_api_aqui') {
    throw new Error('ABACATEPAY_API_KEY não configurada. Configure no arquivo .env');
  }
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function requisitarAPI(endpoint, opcoes = {}) {
  const url = `${API_URL}${endpoint}`;

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      headers: obterHeaders(),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error(`[AbacatePay] Erro ${resposta.status}:`, dados);
      return { sucesso: false, erro: dados.error || 'Erro na API AbacatePay', status: resposta.status };
    }

    return { sucesso: true, dados: dados.data, erro: null };
  } catch (erro) {
    console.error('[AbacatePay] Erro de conexão:', erro.message);
    return { sucesso: false, erro: 'Falha na conexão com AbacatePay', status: 500 };
  }
}

// ── Clientes ─────────────────────────────────────────────

async function criarCliente({ nome, celular, email, cpfCnpj }) {
  return requisitarAPI('/customer/create', {
    method: 'POST',
    body: JSON.stringify({
      name: nome,
      cellphone: celular,
      email: email,
      taxId: cpfCnpj,
    }),
  });
}

async function listarClientes() {
  return requisitarAPI('/customer/list', { method: 'GET' });
}

// ── Cobranças ────────────────────────────────────────────

async function criarCobranca({ produtos, clienteId = null, cliente = null, metodosAceitos = ['PIX'] }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5174';

  const body = {
    frequency: 'ONE_TIME',
    methods: metodosAceitos,
    products: produtos.map(p => ({
      externalId: p.id,
      name: p.nome,
      description: p.descricao || p.nome,
      quantity: p.quantidade,
      price: Math.round(p.preco * 100), // Converter para centavos
    })),
    returnUrl: `${appUrl}`,
    completionUrl: `${appUrl}`,
  };

  if (clienteId) {
    body.customerId = clienteId;
  } else {
    body.customer = {
      name: cliente?.nome || 'Cliente Avulso PDV',
      cellphone: cliente?.celular || '(00) 0000-0000',
      email: cliente?.email || 'cliente@pdv.local',
      taxId: cliente?.cpfCnpj || '000.000.000-00',
    };
  }

  return requisitarAPI('/billing/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function buscarCobranca(cobrancaId) {
  return requisitarAPI(`/billing/get?id=${cobrancaId}`, { method: 'GET' });
}

async function listarCobrancas() {
  return requisitarAPI('/billing/list', { method: 'GET' });
}

// ── PIX QR Code ──────────────────────────────────────────

async function criarPixQRCode({ valor, descricao = 'Pagamento PDV', expiraEm = 3600, cliente = null }) {
  const body = {
    amount: Math.round(valor * 100), // Converter para centavos
    expiresIn: expiraEm,
    description: descricao.substring(0, 140), // Máximo 140 caracteres
  };

  body.customer = {
    name: cliente?.nome || 'Cliente Avulso PDV',
    cellphone: cliente?.celular || '(00) 0000-0000',
    email: cliente?.email || 'cliente@pdv.local',
    taxId: cliente?.cpfCnpj || '000.000.000-00',
  };

  return requisitarAPI('/pixQrCode/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function verificarStatusPix(pixId) {
  return requisitarAPI(`/pixQrCode/check?id=${pixId}`, { method: 'GET' });
}

async function simularPagamentoPix(pixId) {
  return requisitarAPI(`/pixQrCode/simulate-payment?id=${pixId}`, {
    method: 'POST',
    body: JSON.stringify({ metadata: {} }),
  });
}

// ── Verificação de Configuração ──────────────────────────

function estaConfigurado() {
  return API_KEY && API_KEY !== 'sua_chave_api_aqui';
}

module.exports = {
  criarCliente,
  listarClientes,
  criarCobranca,
  buscarCobranca,
  listarCobrancas,
  criarPixQRCode,
  verificarStatusPix,
  simularPagamentoPix,
  estaConfigurado,
};
