/**
 * Serviço de Impressora Térmica ESC/POS
 * Suporta impressoras de rede via TCP e modo simulado para desenvolvimento
 */

const net = require('net');

const IMPRESSORA_HABILITADA = process.env.IMPRESSORA_HABILITADA === 'true';
const IMPRESSORA_IP = process.env.IMPRESSORA_IP || '192.168.1.100';
const IMPRESSORA_PORTA = parseInt(process.env.IMPRESSORA_PORTA || '9100');

// ── Comandos ESC/POS ──────────────────────────────────────
const ESC = '\x1B';
const GS = '\x1D';
const CMD = {
  INIT: `${ESC}@`,          // Inicializar impressora
  BOLD_ON: `${ESC}E\x01`,  // Negrito ON
  BOLD_OFF: `${ESC}E\x00`, // Negrito OFF
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  FONT_NORMAL: `${ESC}!\x00`,
  FONT_DOUBLE_H: `${ESC}!\x10`,       // Dobro da altura
  FONT_DOUBLE_WH: `${ESC}!\x30`,      // Dobro da largura e altura
  LINE_FEED: '\n',
  CUT: `${GS}V\x00`,       // Corte total
  PARTIAL_CUT: `${GS}V\x01`, // Corte parcial
};

const LARGURA_LINHA = 48; // Caracteres por linha (80mm)

// ── Helpers de formatação ─────────────────────────────────
function linha(char = '-') {
  return char.repeat(LARGURA_LINHA);
}

function linhaComPreco(esquerda, direita) {
  const espacos = LARGURA_LINHA - esquerda.length - direita.length;
  return esquerda + ' '.repeat(Math.max(1, espacos)) + direita;
}

function formatarMoeda(valor) {
  return `R$ ${parseFloat(valor || 0).toFixed(2).replace('.', ',')}`;
}

function truncar(texto, maxLen) {
  if (texto.length > maxLen) return texto.substring(0, maxLen - 3) + '...';
  return texto;
}

// ── Gerar cupom ESC/POS ───────────────────────────────────
function gerarCupomESCPOS(venda, operador, caixa) {
  let cupom = '';
  cupom += CMD.INIT;

  // Cabeçalho
  cupom += CMD.ALIGN_CENTER;
  cupom += CMD.FONT_DOUBLE_H;
  cupom += CMD.BOLD_ON;
  cupom += 'PDV OPEN SOURCE\n';
  cupom += CMD.BOLD_OFF;
  cupom += CMD.FONT_NORMAL;
  cupom += 'COMPROVANTE DE VENDA\n';
  cupom += '(Documento não fiscal)\n';
  cupom += CMD.ALIGN_LEFT;
  cupom += linha() + '\n';

  // Dados da venda
  const dataVenda = venda.data_venda || new Date().toLocaleString('pt-BR');
  cupom += `Data: ${dataVenda}\n`;
  cupom += `Venda: ${(venda.id || '').substring(0, 8)}\n`;
  if (operador) cupom += `Operador: ${operador}\n`;
  if (caixa) cupom += `Caixa: ${caixa}\n`;

  const formas = {
    dinheiro: 'Dinheiro',
    cartao_debito: 'Cartão Débito',
    cartao_credito: 'Cartão Crédito',
    pix: 'PIX',
  };
  cupom += `Pgto: ${formas[venda.forma_pagamento] || venda.forma_pagamento}\n`;
  cupom += linha() + '\n';

  // Itens
  cupom += CMD.BOLD_ON;
  cupom += linhaComPreco('ITEM', 'TOTAL') + '\n';
  cupom += CMD.BOLD_OFF;

  if (venda.itens && venda.itens.length > 0) {
    for (const item of venda.itens) {
      cupom += truncar(item.nome_produto, LARGURA_LINHA) + '\n';
      const detalhe = `  ${item.quantidade}x ${formatarMoeda(item.preco_unitario)}`;
      cupom += linhaComPreco(detalhe, formatarMoeda(item.subtotal)) + '\n';
    }
  }

  cupom += linha() + '\n';

  // Totais
  cupom += CMD.BOLD_ON;
  cupom += linhaComPreco('SUBTOTAL:', formatarMoeda(venda.subtotal)) + '\n';

  if (venda.desconto > 0) {
    cupom += linhaComPreco('DESCONTO:', `-${formatarMoeda(venda.desconto)}`) + '\n';
  }

  cupom += CMD.FONT_DOUBLE_H;
  cupom += linhaComPreco('TOTAL:', formatarMoeda(venda.total)) + '\n';
  cupom += CMD.FONT_NORMAL;
  cupom += CMD.BOLD_OFF;

  // Troco
  if (venda.forma_pagamento === 'dinheiro' && venda.valor_recebido) {
    cupom += linha() + '\n';
    cupom += linhaComPreco('Valor Recebido:', formatarMoeda(venda.valor_recebido)) + '\n';
    cupom += CMD.BOLD_ON;
    cupom += CMD.FONT_DOUBLE_H;
    cupom += linhaComPreco('TROCO:', formatarMoeda(venda.troco || 0)) + '\n';
    cupom += CMD.FONT_NORMAL;
    cupom += CMD.BOLD_OFF;
  }

  cupom += linha() + '\n';

  // Rodapé
  cupom += CMD.ALIGN_CENTER;
  cupom += 'Obrigado pela preferência!\n';
  cupom += 'PDV Open Source v2.0\n';
  cupom += '\n\n\n';
  cupom += CMD.PARTIAL_CUT;

  return cupom;
}

// ── Enviar para impressora ────────────────────────────────
function enviarParaImpressora(dados) {
  return new Promise((resolve, reject) => {
    if (!IMPRESSORA_HABILITADA) {
      // Modo simulado: log no console
      console.log('\n📃 ═══ IMPRESSÃO SIMULADA ═══════════════════');
      // Remove comandos ESC/POS para exibir texto limpo
      const textoLimpo = dados.replace(/[\x1B\x1D][^\x20-\x7E]*/g, '');
      console.log(textoLimpo);
      console.log('═══════════════════════════════════════════\n');
      return resolve({ sucesso: true, simulado: true });
    }

    const client = new net.Socket();
    let conectou = false;

    client.setTimeout(5000);

    client.connect(IMPRESSORA_PORTA, IMPRESSORA_IP, () => {
      conectou = true;
      client.write(Buffer.from(dados, 'binary'), () => {
        client.end();
        resolve({ sucesso: true, simulado: false });
      });
    });

    client.on('timeout', () => {
      client.destroy();
      if (!conectou) {
        reject(new Error(`Timeout ao conectar na impressora ${IMPRESSORA_IP}:${IMPRESSORA_PORTA}`));
      }
    });

    client.on('error', (err) => {
      reject(new Error(`Erro na impressora: ${err.message}`));
    });
  });
}

// ── Verificar se impressora está online ───────────────────
function verificarImpressora() {
  return new Promise((resolve) => {
    if (!IMPRESSORA_HABILITADA) {
      return resolve({ online: true, simulado: true, ip: 'simulado', porta: 0 });
    }

    const client = new net.Socket();
    client.setTimeout(3000);

    client.connect(IMPRESSORA_PORTA, IMPRESSORA_IP, () => {
      client.destroy();
      resolve({ online: true, simulado: false, ip: IMPRESSORA_IP, porta: IMPRESSORA_PORTA });
    });

    client.on('timeout', () => {
      client.destroy();
      resolve({ online: false, simulado: false, ip: IMPRESSORA_IP, porta: IMPRESSORA_PORTA });
    });

    client.on('error', () => {
      client.destroy();
      resolve({ online: false, simulado: false, ip: IMPRESSORA_IP, porta: IMPRESSORA_PORTA });
    });
  });
}

// ── Imprimir página de teste ──────────────────────────────
function gerarPaginaTeste() {
  let dados = CMD.INIT;
  dados += CMD.ALIGN_CENTER;
  dados += CMD.FONT_DOUBLE_WH;
  dados += CMD.BOLD_ON;
  dados += 'TESTE DE IMPRESSAO\n';
  dados += CMD.BOLD_OFF;
  dados += CMD.FONT_NORMAL;
  dados += linha() + '\n';
  dados += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
  dados += 'PDV Open Source v2.0\n';
  dados += 'Impressora funcionando!\n';
  dados += linha() + '\n';
  dados += '\n\n\n';
  dados += CMD.PARTIAL_CUT;
  return dados;
}

function estaHabilitada() {
  return IMPRESSORA_HABILITADA;
}

function obterInfo() {
  return {
    habilitada: IMPRESSORA_HABILITADA,
    ip: IMPRESSORA_HABILITADA ? IMPRESSORA_IP : 'simulado',
    porta: IMPRESSORA_HABILITADA ? IMPRESSORA_PORTA : 0,
  };
}

module.exports = {
  gerarCupomESCPOS,
  enviarParaImpressora,
  verificarImpressora,
  gerarPaginaTeste,
  estaHabilitada,
  obterInfo,
};
