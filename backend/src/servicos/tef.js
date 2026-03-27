/**
 * Serviço de integração TEF / PINPAD
 * 
 * Interface genérica para comunicação com terminais de pagamento físicos.
 * Suporta provedores: simulado (dev), sitef, paygo, stone
 * 
 * No modo "simulado", todas as transações são aprovadas automaticamente
 * após um delay configurável, permitindo desenvolvimento sem hardware.
 * 
 * Para produção, substitua o provedor por um SDK real (SiTef, PayGo, Stone TEF)
 * e implemente os métodos correspondentes.
 */

const PROVEDOR = process.env.TEF_PROVEDOR || 'simulado';
const ENDERECO_IP = process.env.TEF_ENDERECO_IP || '127.0.0.1';
const PORTA = process.env.TEF_PORTA || '60906';
const LOJA_ID = process.env.TEF_LOJA_ID || 'PDV001';
const HABILITADO = process.env.TEF_HABILITADO === 'true';

// Armazena transações em memória (em produção, usar banco de dados)
const transacoes = new Map();

// ── Status possíveis ─────────────────────────────────────
const STATUS = {
  CONECTANDO: 'CONECTANDO',
  AGUARDANDO_CARTAO: 'AGUARDANDO_CARTAO',
  PROCESSANDO: 'PROCESSANDO',
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
  CANCELADO: 'CANCELADO',
  ERRO: 'ERRO',
  TIMEOUT: 'TIMEOUT',
};

// ── Gerar ID de transação ────────────────────────────────
function gerarIdTransacao() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `tef_${ts}_${rand}`;
}

// ── Provedor Simulado (para desenvolvimento) ─────────────
const provedorSimulado = {
  async iniciar(transacao) {
    console.log(`[TEF Simulado] Transação ${transacao.id} iniciada - ${transacao.tipo} R$ ${transacao.valor.toFixed(2)}`);
    
    // Simula conexão com o terminal (1.5s)
    setTimeout(() => {
      if (transacoes.has(transacao.id)) {
        const t = transacoes.get(transacao.id);
        if (t.status === STATUS.CONECTANDO) {
          t.status = STATUS.AGUARDANDO_CARTAO;
          t.mensagem = 'Insira ou aproxime o cartão na maquininha';
          transacoes.set(transacao.id, t);
          console.log(`[TEF Simulado] ${transacao.id} → AGUARDANDO_CARTAO`);
        }
      }
    }, 1500);

    // Simula inserção do cartão + aprovação automática (8s total)
    setTimeout(() => {
      if (transacoes.has(transacao.id)) {
        const t = transacoes.get(transacao.id);
        if (t.status === STATUS.AGUARDANDO_CARTAO) {
          t.status = STATUS.PROCESSANDO;
          t.mensagem = 'Comunicando com a adquirente...';
          transacoes.set(transacao.id, t);
          console.log(`[TEF Simulado] ${transacao.id} → PROCESSANDO`);

          // Aprovação após mais 2s
          setTimeout(() => {
            if (transacoes.has(transacao.id)) {
              const t2 = transacoes.get(transacao.id);
              if (t2.status === STATUS.PROCESSANDO) {
                t2.status = STATUS.APROVADO;
                t2.mensagem = 'Transação aprovada';
                t2.nsu = `SIM${Date.now()}`;
                t2.autorizacao = `AUT${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;
                t2.bandeira = transacao.tipo === 'debito' ? 'VISA ELECTRON' : 'MASTERCARD';
                t2.finalizadoEm = new Date().toISOString();
                transacoes.set(transacao.id, t2);
                console.log(`[TEF Simulado] ${transacao.id} → APROVADO (NSU: ${t2.nsu})`);
              }
            }
          }, 2000);
        }
      }
    }, 6000);

    return { sucesso: true };
  },

  async cancelar(transacaoId) {
    if (transacoes.has(transacaoId)) {
      const t = transacoes.get(transacaoId);
      t.status = STATUS.CANCELADO;
      t.mensagem = 'Transação cancelada pelo operador';
      t.finalizadoEm = new Date().toISOString();
      transacoes.set(transacaoId, t);
      console.log(`[TEF Simulado] ${transacaoId} → CANCELADO`);
      return { sucesso: true };
    }
    return { sucesso: false, erro: 'Transação não encontrada' };
  },
};

// ── Provedor Real (placeholder para SDK) ─────────────────
const provedorReal = {
  async iniciar(transacao) {
    // TODO: Integrar com SDK real do SiTef / PayGo / Stone
    // Exemplo com SiTef:
    // const sitef = require('sitef-sdk');
    // const resultado = await sitef.iniciarTransacao({
    //   ip: ENDERECO_IP,
    //   porta: PORTA,
    //   loja: LOJA_ID,
    //   valor: Math.round(transacao.valor * 100),
    //   tipo: transacao.tipo === 'credito' ? 1 : 2,
    // });
    console.error(`[TEF] Provedor "${PROVEDOR}" não tem SDK implementado. Use "simulado" para testes.`);
    return { sucesso: false, erro: `Provedor "${PROVEDOR}" não implementado` };
  },

  async cancelar(transacaoId) {
    console.error(`[TEF] Cancelamento não implementado para provedor "${PROVEDOR}"`);
    return { sucesso: false, erro: 'Não implementado' };
  },
};

// ── Selecionar provedor ──────────────────────────────────
function obterProvedor() {
  if (PROVEDOR === 'simulado') return provedorSimulado;
  return provedorReal;
}

// ── Funções Públicas ─────────────────────────────────────

/**
 * Inicia uma transação TEF/PINPAD
 * @param {Object} opcoes
 * @param {number} opcoes.valor - Valor em reais
 * @param {string} opcoes.tipo - 'credito' | 'debito'
 * @param {number} opcoes.parcelas - Número de parcelas (apenas crédito)
 * @param {string} opcoes.descricao - Descrição da venda
 * @returns {Object} { sucesso, transacao, erro }
 */
async function iniciarTransacao({ valor, tipo = 'credito', parcelas = 1, descricao = '' }) {
  if (!HABILITADO) {
    return { sucesso: false, erro: 'TEF/PINPAD não está habilitado. Configure TEF_HABILITADO=true no .env' };
  }

  if (valor < 0.01) {
    return { sucesso: false, erro: 'Valor mínimo para transação é R$ 0,01' };
  }

  const id = gerarIdTransacao();
  const transacao = {
    id,
    valor,
    tipo,
    parcelas: tipo === 'credito' ? parcelas : 1,
    descricao,
    status: STATUS.CONECTANDO,
    mensagem: 'Conectando ao terminal...',
    provedor: PROVEDOR,
    terminalIp: ENDERECO_IP,
    terminalPorta: PORTA,
    lojaId: LOJA_ID,
    nsu: null,
    autorizacao: null,
    bandeira: null,
    criadoEm: new Date().toISOString(),
    finalizadoEm: null,
    dev_mode: PROVEDOR === 'simulado',
  };

  transacoes.set(id, transacao);

  const provedor = obterProvedor();
  const resultado = await provedor.iniciar(transacao);

  if (!resultado.sucesso) {
    transacao.status = STATUS.ERRO;
    transacao.mensagem = resultado.erro;
    transacoes.set(id, transacao);
    return { sucesso: false, erro: resultado.erro };
  }

  return { sucesso: true, transacao: { ...transacao } };
}

/**
 * Verifica o status atual de uma transação TEF
 * @param {string} transacaoId
 * @returns {Object} { sucesso, transacao, erro }
 */
function verificarStatus(transacaoId) {
  if (!transacoes.has(transacaoId)) {
    return { sucesso: false, erro: 'Transação não encontrada' };
  }

  const transacao = transacoes.get(transacaoId);
  return { sucesso: true, transacao: { ...transacao } };
}

/**
 * Cancela uma transação TEF pendente
 * @param {string} transacaoId
 * @returns {Object} { sucesso, erro }
 */
async function cancelarTransacao(transacaoId) {
  if (!transacoes.has(transacaoId)) {
    return { sucesso: false, erro: 'Transação não encontrada' };
  }

  const transacao = transacoes.get(transacaoId);
  if (transacao.status === STATUS.APROVADO || transacao.status === STATUS.CANCELADO) {
    return { sucesso: false, erro: `Transação já está ${transacao.status}` };
  }

  const provedor = obterProvedor();
  return provedor.cancelar(transacaoId);
}

/**
 * Simula aprovação manual (apenas em modo simulado, para DEV MODE)
 * @param {string} transacaoId
 * @returns {Object} { sucesso, transacao, erro }
 */
function simularAprovacao(transacaoId) {
  if (PROVEDOR !== 'simulado') {
    return { sucesso: false, erro: 'Simulação disponível apenas no modo simulado' };
  }

  if (!transacoes.has(transacaoId)) {
    return { sucesso: false, erro: 'Transação não encontrada' };
  }

  const t = transacoes.get(transacaoId);
  t.status = STATUS.APROVADO;
  t.mensagem = 'Transação aprovada (simulação manual)';
  t.nsu = `SIM${Date.now()}`;
  t.autorizacao = `AUT${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;
  t.bandeira = t.tipo === 'debito' ? 'VISA ELECTRON' : 'MASTERCARD';
  t.finalizadoEm = new Date().toISOString();
  transacoes.set(transacaoId, t);

  return { sucesso: true, transacao: { ...t } };
}

/**
 * Simula recusa manual (apenas em modo simulado, para DEV MODE)
 */
function simularRecusa(transacaoId) {
  if (PROVEDOR !== 'simulado') {
    return { sucesso: false, erro: 'Simulação disponível apenas no modo simulado' };
  }

  if (!transacoes.has(transacaoId)) {
    return { sucesso: false, erro: 'Transação não encontrada' };
  }

  const t = transacoes.get(transacaoId);
  t.status = STATUS.RECUSADO;
  t.mensagem = 'Transação recusada (simulação manual)';
  t.finalizadoEm = new Date().toISOString();
  transacoes.set(transacaoId, t);

  return { sucesso: true, transacao: { ...t } };
}

/**
 * Verifica se o TEF está configurado e habilitado
 */
function estaConfigurado() {
  return HABILITADO;
}

/**
 * Retorna informações de configuração (sem dados sensíveis)
 */
function obterInfo() {
  return {
    habilitado: HABILITADO,
    provedor: PROVEDOR,
    dev_mode: PROVEDOR === 'simulado',
    terminal: HABILITADO ? `${ENDERECO_IP}:${PORTA}` : null,
    loja: LOJA_ID,
  };
}

module.exports = {
  iniciarTransacao,
  verificarStatus,
  cancelarTransacao,
  simularAprovacao,
  simularRecusa,
  estaConfigurado,
  obterInfo,
  STATUS,
};
