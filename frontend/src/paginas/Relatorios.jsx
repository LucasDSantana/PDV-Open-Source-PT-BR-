import { useState, useEffect, useCallback } from 'react';
import { vendasAPI } from '../servicos/api';
import { formatarMoeda, formatarDataHora, FORMAS_PAGAMENTO, hojeISO } from '../utils/formatadores';

export default function Relatorios() {
  const [resumo, setResumo] = useState(null);
  const [porPagamento, setPorPagamento] = useState([]);
  const [topProdutos, setTopProdutos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [aba, setAba] = useState('resumo');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = {};
      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;

      const [relatorio, listaVendas] = await Promise.all([
        vendasAPI.relatorio(params),
        vendasAPI.listar({ ...params, limite: 50 }),
      ]);

      setResumo(relatorio.resumo);
      setPorPagamento(relatorio.por_pagamento);
      setTopProdutos(relatorio.top_produtos);
      setVendas(listaVendas.vendas);
    } catch (erro) {
      console.error('Erro ao carregar relatório:', erro);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="flex-col" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="cabecalho">
        <span className="cabecalho-titulo">📊 Relatórios</span>
      </div>

      {/* Filtros */}
      <div style={{ padding: 'var(--espaco-lg)', display: 'flex', gap: 'var(--espaco-md)', alignItems: 'flex-end' }}>
        <div className="campo">
          <label>Data Início</label>
          <input
            type="date"
            className="input"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="campo">
          <label>Data Fim</label>
          <input
            type="date"
            className="input"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
        <button className="btn btn-primario" onClick={carregar} disabled={carregando}>
          {carregando ? '⏳' : '🔄'} Atualizar
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <button
            className={`btn ${aba === 'resumo' ? 'btn-primario' : 'btn-secundario'}`}
            onClick={() => setAba('resumo')}
          >
            Resumo
          </button>
          <button
            className={`btn ${aba === 'vendas' ? 'btn-primario' : 'btn-secundario'}`}
            onClick={() => setAba('vendas')}
          >
            Vendas
          </button>
        </div>
      </div>

      {aba === 'resumo' ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 var(--espaco-lg) var(--espaco-lg)' }}>
          {/* Cards de resumo */}
          {resumo && (
            <div className="relatorio-grid">
              <div className="card">
                <div className="card-titulo">Total de Vendas</div>
                <div className="card-valor">{resumo.total_vendas}</div>
              </div>
              <div className="card">
                <div className="card-titulo">Receita Total</div>
                <div className="card-valor text-sucesso">{formatarMoeda(resumo.receita_total)}</div>
              </div>
              <div className="card">
                <div className="card-titulo">Ticket Médio</div>
                <div className="card-valor">{formatarMoeda(resumo.ticket_medio)}</div>
              </div>
              <div className="card">
                <div className="card-titulo">Descontos</div>
                <div className="card-valor text-perigo">{formatarMoeda(resumo.desconto_total)}</div>
              </div>
              <div className="card">
                <div className="card-titulo">Maior Venda</div>
                <div className="card-valor">{formatarMoeda(resumo.maior_venda)}</div>
              </div>
              <div className="card">
                <div className="card-titulo">Menor Venda</div>
                <div className="card-valor">{formatarMoeda(resumo.menor_venda)}</div>
              </div>
            </div>
          )}

          {/* Vendas por forma de pagamento */}
          {porPagamento.length > 0 && (
            <div style={{ marginTop: 'var(--espaco-xl)' }}>
              <h3 style={{ marginBottom: 'var(--espaco-md)', fontSize: 'var(--tamanho-lg)' }}>
                💳 Por Forma de Pagamento
              </h3>
              <div className="relatorio-grid">
                {porPagamento.map(fp => {
                  const info = FORMAS_PAGAMENTO[fp.forma_pagamento] || { nome: fp.forma_pagamento, icone: '💰' };
                  return (
                    <div key={fp.forma_pagamento} className="card">
                      <div className="card-titulo">{info.icone} {info.nome}</div>
                      <div className="card-valor" style={{ fontSize: 'var(--tamanho-xl)' }}>
                        {formatarMoeda(fp.total)}
                      </div>
                      <div className="text-sm text-muted mt-md">{fp.quantidade} vendas</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top produtos */}
          {topProdutos.length > 0 && (
            <div style={{ marginTop: 'var(--espaco-xl)' }}>
              <h3 style={{ marginBottom: 'var(--espaco-md)', fontSize: 'var(--tamanho-lg)' }}>
                🏆 Produtos Mais Vendidos
              </h3>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produto</th>
                    <th style={{ textAlign: 'right' }}>Qtd Vendida</th>
                    <th style={{ textAlign: 'right' }}>Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {topProdutos.map((prod, i) => (
                    <tr key={prod.nome_produto}>
                      <td style={{ fontWeight: 600 }}>{i + 1}º</td>
                      <td>{prod.nome_produto}</td>
                      <td className="text-right text-mono">{prod.total_quantidade}</td>
                      <td className="text-right text-mono text-sucesso">{formatarMoeda(prod.total_valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!resumo && !carregando && (
            <div className="vazio">
              <span style={{ fontSize: '2rem' }}>📊</span>
              <span>Nenhum dado encontrado para o período selecionado</span>
            </div>
          )}
        </div>
      ) : (
        <div className="tabela-container" style={{ flex: 1 }}>
          <table className="tabela">
            <thead>
              <tr>
                <th>ID</th>
                <th>Data/Hora</th>
                <th>Pagamento</th>
                <th style={{ textAlign: 'right' }}>Subtotal</th>
                <th style={{ textAlign: 'right' }}>Desconto</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {vendas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted" style={{ padding: '32px' }}>
                    Nenhuma venda encontrada
                  </td>
                </tr>
              ) : (
                vendas.map(venda => {
                  const info = FORMAS_PAGAMENTO[venda.forma_pagamento] || { nome: venda.forma_pagamento, icone: '💰' };
                  return (
                    <tr key={venda.id}>
                      <td className="text-mono text-sm">{venda.id.substring(0, 8)}</td>
                      <td>{formatarDataHora(venda.data_venda)}</td>
                      <td>{info.icone} {info.nome}</td>
                      <td className="text-right text-mono">{formatarMoeda(venda.subtotal)}</td>
                      <td className="text-right text-mono text-perigo">
                        {venda.desconto > 0 ? `-${formatarMoeda(venda.desconto)}` : '-'}
                      </td>
                      <td className="text-right text-mono fw-bold text-sucesso">
                        {formatarMoeda(venda.total)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
