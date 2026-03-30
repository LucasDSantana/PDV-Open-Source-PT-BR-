import { jsPDF } from 'jspdf';
import { formatarMoeda, formatarDataHora, FORMAS_PAGAMENTO } from '../utils/formatadores';

/**
 * Gera e baixa um comprovante de venda em PDF
 */
export function gerarComprovante(venda) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 240], // Tamanho de cupom fiscal (80mm largura, mais alto para troco)
  });

  const margemEsq = 5;
  const largura = 70;
  let y = 10;

  // Configurações de fonte
  doc.setFont('courier', 'normal');

  // ── Cabeçalho ──
  doc.setFontSize(12);
  doc.setFont('courier', 'bold');
  doc.text('PDV OPEN SOURCE', 40, y, { align: 'center' });
  y += 5;
  doc.setFontSize(7);
  doc.setFont('courier', 'normal');
  doc.text('COMPROVANTE DE VENDA', 40, y, { align: 'center' });
  y += 3;
  doc.text('(Documento não fiscal)', 40, y, { align: 'center' });
  y += 5;

  // Linha separadora
  doc.text('-'.repeat(40), margemEsq, y);
  y += 5;

  // ── Dados da venda ──
  doc.setFontSize(7);
  doc.text(`Data: ${formatarDataHora(venda.data_venda)}`, margemEsq, y);
  y += 4;
  doc.text(`Venda: ${venda.id?.substring(0, 8) || 'N/A'}`, margemEsq, y);
  y += 4;

  // Operador e Caixa
  if (venda.operador_nome) {
    doc.text(`Operador: ${venda.operador_nome}`, margemEsq, y);
    y += 4;
  }
  if (venda.caixa_nome) {
    doc.text(`Caixa: ${venda.caixa_nome}`, margemEsq, y);
    y += 4;
  }

  const pagamento = FORMAS_PAGAMENTO[venda.forma_pagamento];
  doc.text(`Pgto: ${pagamento?.nome || venda.forma_pagamento}`, margemEsq, y);
  y += 5;

  // Linha separadora
  doc.text('-'.repeat(40), margemEsq, y);
  y += 5;

  // ── Itens ──
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.text('ITEM', margemEsq, y);
  doc.text('QTD', 45, y);
  doc.text('TOTAL', largura, y, { align: 'right' });
  y += 4;
  doc.setFont('courier', 'normal');

  if (venda.itens && venda.itens.length > 0) {
    for (const item of venda.itens) {
      // Nome do produto (truncar se necessário)
      const nome = item.nome_produto.length > 25
        ? item.nome_produto.substring(0, 25) + '...'
        : item.nome_produto;
      doc.text(nome, margemEsq, y);
      y += 3.5;

      // Quantidade e preço
      const qtdPreco = `${item.quantidade}x ${formatarMoeda(item.preco_unitario)}`;
      doc.text(qtdPreco, margemEsq + 2, y);
      doc.text(formatarMoeda(item.subtotal), largura, y, { align: 'right' });
      y += 5;
    }
  }

  // Linha separadora
  doc.text('-'.repeat(40), margemEsq, y);
  y += 5;

  // ── Totais ──
  doc.setFont('courier', 'bold');
  doc.text('SUBTOTAL:', margemEsq, y);
  doc.text(formatarMoeda(venda.subtotal), largura, y, { align: 'right' });
  y += 4;

  if (venda.desconto > 0) {
    doc.text('DESCONTO:', margemEsq, y);
    doc.text(`-${formatarMoeda(venda.desconto)}`, largura, y, { align: 'right' });
    y += 4;
  }

  doc.setFontSize(9);
  doc.text('TOTAL:', margemEsq, y);
  doc.text(formatarMoeda(venda.total), largura, y, { align: 'right' });
  y += 6;

  // ── Troco (pagamento em dinheiro) ──
  if (venda.forma_pagamento === 'dinheiro' && venda.valor_recebido) {
    doc.setFontSize(7);
    doc.text('-'.repeat(40), margemEsq, y);
    y += 5;

    doc.text('Valor Recebido:', margemEsq, y);
    doc.text(formatarMoeda(venda.valor_recebido), largura, y, { align: 'right' });
    y += 4;

    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    doc.text('TROCO:', margemEsq, y);
    doc.text(formatarMoeda(venda.troco || 0), largura, y, { align: 'right' });
    y += 6;
  }

  // Linha separadora
  doc.setFontSize(7);
  doc.setFont('courier', 'normal');
  doc.text('-'.repeat(40), margemEsq, y);
  y += 5;

  // ── Rodapé ──
  doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });
  y += 4;
  doc.text('PDV Open Source v2.0', 40, y, { align: 'center' });

  // Baixar PDF
  doc.save(`comprovante-${venda.id?.substring(0, 8) || 'venda'}.pdf`);
}
