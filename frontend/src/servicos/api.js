const API_URL = 'http://localhost:3002/api';

// ── Token Management ──────────────────────────────────────
function getToken() {
  return localStorage.getItem('pdv_token');
}

// Wrapper de fetch com tratamento de erro padronizado
async function requisitar(caminho, opcoes = {}) {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    ...opcoes,
  };

  const resposta = await fetch(`${API_URL}${caminho}`, config);

  // Se token expirou, redirecionar para login
  if (resposta.status === 401) {
    localStorage.removeItem('pdv_token');
    localStorage.removeItem('pdv_usuario');
    window.location.reload();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!resposta.ok) {
    const erro = await resposta.json().catch(() => ({ erro: 'Erro desconhecido' }));
    throw new Error(erro.erro || erro.detalhes?.[0]?.msg || `Erro HTTP ${resposta.status}`);
  }

  // Para downloads (Content-Disposition presente)
  const contentDisposition = resposta.headers.get('Content-Disposition');
  if (contentDisposition && contentDisposition.includes('attachment')) {
    const blob = await resposta.blob();
    const nomeArquivoMatch = contentDisposition.match(/filename="(.+)"/);
    const nomeArquivo = nomeArquivoMatch ? nomeArquivoMatch[1] : 'download';
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    return { sucesso: true, arquivo: nomeArquivo };
  }

  return resposta.json();
}

// ── Auth ──────────────────────────────────────────────────
export const authAPI = {
  login: (dados) => requisitar('/auth/login', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  eu: () => requisitar('/auth/eu'),

  listarUsuarios: () => requisitar('/auth/usuarios'),

  criarUsuario: (dados) => requisitar('/auth/usuarios', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  editarUsuario: (id, dados) => requisitar(`/auth/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  }),

  removerUsuario: (id) => requisitar(`/auth/usuarios/${id}`, { method: 'DELETE' }),
};

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

// ── Caixas ────────────────────────────────────────────
export const caixasAPI = {
  abrir: (dados) => requisitar('/caixas/abrir', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  fechar: (id, dados) => requisitar(`/caixas/${id}/fechar`, {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  listar: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return requisitar(`/caixas${query ? '?' + query : ''}`);
  },

  meu: () => requisitar('/caixas/meu'),

  obter: (id) => requisitar(`/caixas/${id}`),

  resumo: (id) => requisitar(`/caixas/${id}/resumo`),

  sangria: (id, dados) => requisitar(`/caixas/${id}/sangria`, {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  suprimento: (id, dados) => requisitar(`/caixas/${id}/suprimento`, {
    method: 'POST',
    body: JSON.stringify(dados),
  }),
};

// ── Impressora ────────────────────────────────────────
export const impressoraAPI = {
  status: () => requisitar('/impressora/status'),

  imprimirCupom: (dados) => requisitar('/impressora/imprimir-cupom', {
    method: 'POST',
    body: JSON.stringify(dados),
  }),

  testar: () => requisitar('/impressora/testar', { method: 'POST' }),
};

// ── Relatórios (Downloads) ────────────────────────────
export const relatoriosAPI = {
  vendasExcel: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return requisitar(`/relatorios/vendas/excel${query ? '?' + query : ''}`);
  },

  vendasCSV: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return requisitar(`/relatorios/vendas/csv${query ? '?' + query : ''}`);
  },

  produtosExcel: () => requisitar('/relatorios/produtos/excel'),

  produtosCSV: () => requisitar('/relatorios/produtos/csv'),
};
