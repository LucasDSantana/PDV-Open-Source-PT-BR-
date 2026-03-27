const API_URL = 'http://localhost:3002/api';

// Wrapper de fetch com tratamento de erro padronizado
async function requisitar(caminho, opcoes = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
  };

  const resposta = await fetch(`${API_URL}${caminho}`, config);

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({ erro: 'Erro desconhecido' }));
    throw new Error(erro.erro || erro.detalhes?.[0]?.msg || `Erro HTTP ${resposta.status}`);
  }

  return resposta.json();
}

// ── Produtos ──────────────────────────────────────────
export const produtosAPI = {
  listar: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return requisitar(`/produtos${query ? '?' + query : ''}`);
  },

  buscar: (termo) => requisitar(`/produtos/busca/${encodeURIComponent(termo)}`),

  obter: (id) => requisitar(`/produtos/${id}`),

  criar: (dados) => requisitar('/produtos', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  atualizar: (id, dados) => requisitar(`/produtos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  }),

  remover: (id) => requisitar(`/produtos/${id}`, { method: 'DELETE' }),

  categorias: () => requisitar('/produtos/categorias'),
};

// ── Vendas ────────────────────────────────────────────
export const vendasAPI = {
  registrar: (dados) => requisitar('/vendas', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  listar: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return requisitar(`/vendas${query ? '?' + query : ''}`);
  },

  obter: (id) => requisitar(`/vendas/${id}`),

  relatorio: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return requisitar(`/vendas/relatorio/resumo${query ? '?' + query : ''}`);
  },
};

// ── Pagamentos ────────────────────────────────────────
export const pagamentosAPI = {
  // Status geral dos provedores
  status: () => requisitar('/pagamentos/status'),

  // ── PIX (AbacatePay ou fallback TEF) ──
  pix: (dados) => requisitar('/pagamentos/pix', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  statusPix: (id) => requisitar(`/pagamentos/pix/${id}/status`),

  simularPix: (id) => requisitar(`/pagamentos/pix/${id}/simular`, {
    method: 'POST',
  }),

  // ── TEF/PINPAD (Cartão Crédito/Débito) ──
  tefIniciar: (dados) => requisitar('/pagamentos/tef/iniciar', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  tefStatus: (id) => requisitar(`/pagamentos/tef/${id}/status`),

  tefCancelar: (id) => requisitar(`/pagamentos/tef/${id}/cancelar`, {
    method: 'POST',
  }),

  tefSimularAprovacao: (id) => requisitar(`/pagamentos/tef/${id}/simular-aprovacao`, {
    method: 'POST',
  }),

  tefSimularRecusa: (id) => requisitar(`/pagamentos/tef/${id}/simular-recusa`, {
    method: 'POST',
  }),
};
