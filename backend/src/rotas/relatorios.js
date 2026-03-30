const express = require('express');
const ExcelJS = require('exceljs');
const { buscarTodos } = require('../database/esquema');
const { verificarToken } = require('../middleware/autenticacao');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────
function aplicarFiltroData(sql, params, query) {
  const { data_inicio, data_fim } = query;
  if (data_inicio) { sql += ' AND data_venda >= ?'; params.push(data_inicio); }
  if (data_fim) { sql += ' AND data_venda <= ?'; params.push(data_fim + ' 23:59:59'); }
  return sql;
}

function formatarMoedaCSV(valor) {
  return parseFloat(valor || 0).toFixed(2);
}

const FORMAS_PAGAMENTO = {
  dinheiro: 'Dinheiro',
  cartao_debito: 'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  pix: 'PIX',
};

// ══════════════════════════════════════════════════════════
// GET /api/relatorios/vendas/excel
// ══════════════════════════════════════════════════════════
router.get('/vendas/excel', verificarToken, async (req, res) => {
  try {
    let sql = "SELECT * FROM vendas WHERE status = 'finalizada'";
    const params = [];
    sql = aplicarFiltroData(sql, params, req.query);
    sql += ' ORDER BY data_venda DESC';

    const vendas = buscarTodos(sql, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PDV Open Source';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Vendas', {
      headerFooter: { firstHeader: 'Relatório de Vendas - PDV Open Source' },
    });

    // Cabeçalho
    ws.columns = [
      { header: 'ID', key: 'id', width: 12 },
      { header: 'Data/Hora', key: 'data_venda', width: 20 },
      { header: 'Forma Pagamento', key: 'forma_pagamento', width: 18 },
      { header: 'Subtotal', key: 'subtotal', width: 14 },
      { header: 'Desconto', key: 'desconto', width: 14 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Valor Recebido', key: 'valor_recebido', width: 16 },
      { header: 'Troco', key: 'troco', width: 14 },
    ];

    // Estilizar cabeçalho
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A7CFF' } };

    // Dados
    for (const v of vendas) {
      ws.addRow({
        id: v.id.substring(0, 8),
        data_venda: v.data_venda,
        forma_pagamento: FORMAS_PAGAMENTO[v.forma_pagamento] || v.forma_pagamento,
        subtotal: parseFloat(v.subtotal),
        desconto: parseFloat(v.desconto),
        total: parseFloat(v.total),
        valor_recebido: v.valor_recebido ? parseFloat(v.valor_recebido) : null,
        troco: v.troco ? parseFloat(v.troco) : null,
      });
    }

    // Formatar colunas de moeda
    ['D', 'E', 'F', 'G', 'H'].forEach(col => {
      ws.getColumn(col).numFmt = '#,##0.00';
    });

    // Total geral
    const linhaTotal = ws.rowCount + 2;
    ws.getCell(`E${linhaTotal}`).value = 'TOTAL GERAL:';
    ws.getCell(`E${linhaTotal}`).font = { bold: true };
    ws.getCell(`F${linhaTotal}`).value = { formula: `SUM(F2:F${ws.rowCount})` };
    ws.getCell(`F${linhaTotal}`).font = { bold: true };

    const nomeArquivo = `vendas-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (erro) {
    console.error('Erro ao exportar vendas Excel:', erro);
    res.status(500).json({ erro: 'Erro ao exportar relatório' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/relatorios/vendas/csv
// ══════════════════════════════════════════════════════════
router.get('/vendas/csv', verificarToken, (req, res) => {
  try {
    let sql = "SELECT * FROM vendas WHERE status = 'finalizada'";
    const params = [];
    sql = aplicarFiltroData(sql, params, req.query);
    sql += ' ORDER BY data_venda DESC';

    const vendas = buscarTodos(sql, params);

    let csv = 'ID;Data/Hora;Forma Pagamento;Subtotal;Desconto;Total;Valor Recebido;Troco\n';

    for (const v of vendas) {
      csv += `${v.id.substring(0, 8)};${v.data_venda};${FORMAS_PAGAMENTO[v.forma_pagamento] || v.forma_pagamento};${formatarMoedaCSV(v.subtotal)};${formatarMoedaCSV(v.desconto)};${formatarMoedaCSV(v.total)};${v.valor_recebido ? formatarMoedaCSV(v.valor_recebido) : ''};${v.troco ? formatarMoedaCSV(v.troco) : ''}\n`;
    }

    const nomeArquivo = `vendas-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send('\uFEFF' + csv); // BOM para Excel abrir com encoding correto
  } catch (erro) {
    console.error('Erro ao exportar vendas CSV:', erro);
    res.status(500).json({ erro: 'Erro ao exportar relatório' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/relatorios/produtos/excel
// ══════════════════════════════════════════════════════════
router.get('/produtos/excel', verificarToken, async (req, res) => {
  try {
    const produtos = buscarTodos('SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome ASC');

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Produtos');

    ws.columns = [
      { header: 'Código Barras', key: 'codigo_barras', width: 16 },
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'Categoria', key: 'categoria', width: 16 },
      { header: 'Preço', key: 'preco', width: 12 },
      { header: 'Estoque', key: 'estoque', width: 10 },
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34D399' } };

    for (const p of produtos) {
      ws.addRow({
        codigo_barras: p.codigo_barras || '-',
        nome: p.nome,
        categoria: p.categoria,
        preco: parseFloat(p.preco),
        estoque: p.estoque,
      });
    }

    ws.getColumn('D').numFmt = '#,##0.00';

    const nomeArquivo = `produtos-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (erro) {
    console.error('Erro ao exportar produtos Excel:', erro);
    res.status(500).json({ erro: 'Erro ao exportar relatório' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/relatorios/produtos/csv
// ══════════════════════════════════════════════════════════
router.get('/produtos/csv', verificarToken, (req, res) => {
  try {
    const produtos = buscarTodos('SELECT * FROM produtos WHERE ativo = 1 ORDER BY nome ASC');

    let csv = 'Código Barras;Nome;Categoria;Preço;Estoque\n';

    for (const p of produtos) {
      csv += `${p.codigo_barras || '-'};${p.nome};${p.categoria};${formatarMoedaCSV(p.preco)};${p.estoque}\n`;
    }

    const nomeArquivo = `produtos-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.send('\uFEFF' + csv);
  } catch (erro) {
    console.error('Erro ao exportar produtos CSV:', erro);
    res.status(500).json({ erro: 'Erro ao exportar relatório' });
  }
});

module.exports = router;
