import { useState, useEffect, useCallback } from 'react';
import { caixasAPI } from '../servicos/api';
import { formatarMoeda, formatarDataHora, FORMAS_PAGAMENTO } from '../utils/formatadores';

export default function Caixas({ usuario, caixaAtivo, aoAtualizarCaixa }) {
  const [caixas, setCaixas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState(null);
  const [aba, setAba] = useState('ativo');

  // Modal states
  const [mostrarAbrir, setMostrarAbrir] = useState(false);
  const [mostrarFechar, setMostrarFechar] = useState(false);
  const [mostrarSangria, setMostrarSangria] = useState(false);
  const [mostrarSuprimento, setMostrarSuprimento] = useState(false);
  const [resumoCaixa, setResumoCaixa] = useState(null);

  // Form states
  const [numeroCaixa, setNumeroCaixa] = useState(1);
  const [valorAbertura, setValorAbertura] = useState('');
  const [valorFechamento, setValorFechamento] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');
  const [valorMovimentacao, setValorMovimentacao] = useState('');
  const [observacaoMovimentacao, setObservacaoMovimentacao] = useState('');

  const mostrar = (texto, tipo = 'info') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  };

  // ── Carregar caixas ──
  const carregarCaixas = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await caixasAPI.listar();
      setCaixas(lista);
    } catch (erro) {
      console.error('Erro ao carregar caixas:', erro);
    } finally {
      setCarregando(false);
    }
  }, []);

  const carregarResumo = useCallback(async () => {
    if (!caixaAtivo) return;
    try {
      const r = await caixasAPI.resumo(caixaAtivo.id);
      setResumoCaixa(r);
    } catch (erro) {
      console.error('Erro ao carregar resumo:', erro);
    }
  }, [caixaAtivo]);

  useEffect(() => { carregarCaixas(); }, [carregarCaixas]);
  useEffect(() => { carregarResumo(); }, [carregarResumo]);

  // ── Abrir Caixa ──
  const abrirCaixa = async () => {
    if (!valorAbertura && valorAbertura !== '0') {
      mostrar('Informe o valor de abertura', 'aviso');
      return;
    }
    try {
      const caixa = await caixasAPI.abrir({
        numero: numeroCaixa,
        valor_abertura: parseFloat(valorAbertura) || 0,
      });
      mostrar(`✓ ${caixa.nome} aberto com sucesso!`, 'sucesso');
      setMostrarAbrir(false);
      setValorAbertura('');
      aoAtualizarCaixa(caixa);
      carregarCaixas();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  // ── Fechar Caixa ──
  const fecharCaixa = async () => {
    if (!caixaAtivo) return;
    if (!valorFechamento && valorFechamento !== '0') {
      mostrar('Informe o valor de fechamento (conferência)', 'aviso');
      return;
    }
    try {
      await caixasAPI.fechar(caixaAtivo.id, {
        valor_fechamento: parseFloat(valorFechamento) || 0,
        observacao: observacaoFechamento,
      });
      mostrar('✓ Caixa fechado com sucesso!', 'sucesso');
      setMostrarFechar(false);
      setValorFechamento('');
      setObservacaoFechamento('');
      aoAtualizarCaixa(null);
      carregarCaixas();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  // ── Sangria ──
  const fazerSangria = async () => {
    if (!caixaAtivo || !valorMovimentacao) return;
    try {
      await caixasAPI.sangria(caixaAtivo.id, {
        valor: parseFloat(valorMovimentacao),
        observacao: observacaoMovimentacao,
      });
      mostrar('✓ Sangria registrada!', 'sucesso');
      setMostrarSangria(false);
      setValorMovimentacao('');
      setObservacaoMovimentacao('');
      carregarResumo();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  // ── Suprimento ──
  const fazerSuprimento = async () => {
    if (!caixaAtivo || !valorMovimentacao) return;
    try {
      await caixasAPI.suprimento(caixaAtivo.id, {
        valor: parseFloat(valorMovimentacao),
        observacao: observacaoMovimentacao,
      });
      mostrar('✓ Suprimento registrado!', 'sucesso');
      setMostrarSuprimento(false);
      setValorMovimentacao('');
      setObservacaoMovimentacao('');
      carregarResumo();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  return (
    <div className="flex-col" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="cabecalho">
        <span className="cabecalho-titulo">💼 Gestão de Caixas</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!caixaAtivo && (
            <button className="btn btn-sucesso" onClick={() => setMostrarAbrir(true)}>
              ➕ Abrir Caixa
            </button>
          )}
          {caixaAtivo && (
            <>
              <button className="btn btn-secundario" onClick={() => { setMostrarSangria(true); setValorMovimentacao(''); setObservacaoMovimentacao(''); }}>
                📤 Sangria
              </button>
              <button className="btn btn-secundario" onClick={() => { setMostrarSuprimento(true); setValorMovimentacao(''); setObservacaoMovimentacao(''); }}>
                📥 Suprimento
              </button>
              <button className="btn btn-perigo" onClick={() => { setMostrarFechar(true); setValorFechamento(''); carregarResumo(); }}>
                🔒 Fechar Caixa
              </button>
            </>
          )}
        </div>
      </div>

      {mensagem && (
        <div style={{
          padding: '8px 16px',
          background: mensagem.tipo === 'sucesso' ? 'var(--cor-sucesso-fundo)' : mensagem.tipo === 'perigo' ? 'var(--cor-perigo-fundo)' : 'var(--cor-fundo-3)',
          color: mensagem.tipo === 'sucesso' ? 'var(--cor-sucesso)' : mensagem.tipo === 'perigo' ? 'var(--cor-perigo)' : 'var(--cor-texto)',
          textAlign: 'center', fontSize: 'var(--tamanho-sm)', fontWeight: 500,
        }}>
          {mensagem.texto}
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: 'var(--espaco-lg)', display: 'flex', gap: '4px' }}>
        <button className={`btn ${aba === 'ativo' ? 'btn-primario' : 'btn-secundario'}`} onClick={() => setAba('ativo')}>
          Caixa Ativo
        </button>
        <button className={`btn ${aba === 'historico' ? 'btn-primario' : 'btn-secundario'}`} onClick={() => { setAba('historico'); carregarCaixas(); }}>
          Histórico
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 var(--espaco-lg) var(--espaco-lg)' }}>
        {aba === 'ativo' ? (
          <>
            {!caixaAtivo ? (
              <div className="vazio">
                <span style={{ fontSize: '3rem' }}>💼</span>
                <span style={{ fontSize: 'var(--tamanho-lg)', fontWeight: 600 }}>Nenhum caixa aberto</span>
                <span>Clique em "Abrir Caixa" para começar a operar</span>
              </div>
            ) : (
              <>
                {/* Info do caixa */}
                <div className="caixa-info-card">
                  <div className="caixa-info-header">
                    <h2>🟢 {caixaAtivo.nome}</h2>
                    <span className="badge badge-sucesso">ABERTO</span>
                  </div>
                  <div className="caixa-info-grid">
                    <div><span className="text-muted">Operador:</span> {caixaAtivo.usuario_abertura_nome}</div>
                    <div><span className="text-muted">Abertura:</span> {formatarDataHora(caixaAtivo.data_abertura)}</div>
                    <div><span className="text-muted">Valor Abertura:</span> <span className="text-mono">{formatarMoeda(caixaAtivo.valor_abertura)}</span></div>
                  </div>
                </div>

                {/* Resumo financeiro */}
                {resumoCaixa && (
                  <>
                    <div className="relatorio-grid" style={{ padding: 'var(--espaco-lg) 0' }}>
                      <div className="card">
                        <div className="card-titulo">Total Vendas</div>
                        <div className="card-valor">{resumoCaixa.total_vendas?.quantidade || 0}</div>
                        <div className="text-sm text-muted mt-md">{formatarMoeda(resumoCaixa.total_vendas?.valor)}</div>
                      </div>
                      <div className="card">
                        <div className="card-titulo">Sangrias</div>
                        <div className="card-valor text-perigo">{formatarMoeda(resumoCaixa.sangrias?.valor)}</div>
                        <div className="text-sm text-muted mt-md">{resumoCaixa.sangrias?.quantidade || 0} retiradas</div>
                      </div>
                      <div className="card">
                        <div className="card-titulo">Suprimentos</div>
                        <div className="card-valor text-sucesso">{formatarMoeda(resumoCaixa.suprimentos?.valor)}</div>
                        <div className="text-sm text-muted mt-md">{resumoCaixa.suprimentos?.quantidade || 0} adições</div>
                      </div>
                      <div className="card">
                        <div className="card-titulo">💰 Saldo Esperado</div>
                        <div className="card-valor text-sucesso">{formatarMoeda(resumoCaixa.saldo_esperado)}</div>
                        <div className="text-sm text-muted mt-md">em dinheiro no caixa</div>
                      </div>
                    </div>

                    {/* Por forma de pagamento */}
                    {resumoCaixa.por_forma_pagamento?.length > 0 && (
                      <div style={{ marginTop: 'var(--espaco-md)' }}>
                        <h3 style={{ marginBottom: 'var(--espaco-md)' }}>Por Forma de Pagamento</h3>
                        <div className="relatorio-grid" style={{ padding: 0 }}>
                          {resumoCaixa.por_forma_pagamento.map(fp => {
                            const info = FORMAS_PAGAMENTO[fp.forma_pagamento] || { nome: fp.forma_pagamento, icone: '💰' };
                            return (
                              <div key={fp.forma_pagamento} className="card">
                                <div className="card-titulo">{info.icone} {info.nome}</div>
                                <div className="card-valor" style={{ fontSize: 'var(--tamanho-xl)' }}>{formatarMoeda(fp.valor)}</div>
                                <div className="text-sm text-muted mt-md">{fp.quantidade} vendas</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        ) : (
          /* Histórico */
          <div className="tabela-container">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Caixa</th>
                  <th>Operador</th>
                  <th>Abertura</th>
                  <th>Fechamento</th>
                  <th style={{ textAlign: 'right' }}>Valor Abertura</th>
                  <th style={{ textAlign: 'right' }}>Valor Sistema</th>
                  <th style={{ textAlign: 'right' }}>Valor Fechamento</th>
                  <th style={{ textAlign: 'right' }}>Diferença</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {caixas.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center text-muted" style={{ padding: '32px' }}>
                      {carregando ? '⏳ Carregando...' : 'Nenhum caixa encontrado'}
                    </td>
                  </tr>
                ) : (
                  caixas.map(cx => (
                    <tr key={cx.id}>
                      <td style={{ fontWeight: 600 }}>{cx.nome}</td>
                      <td>{cx.usuario_abertura_nome}</td>
                      <td className="text-sm">{formatarDataHora(cx.data_abertura)}</td>
                      <td className="text-sm">{cx.data_fechamento ? formatarDataHora(cx.data_fechamento) : '-'}</td>
                      <td className="text-right text-mono">{formatarMoeda(cx.valor_abertura)}</td>
                      <td className="text-right text-mono">{cx.valor_sistema != null ? formatarMoeda(cx.valor_sistema) : '-'}</td>
                      <td className="text-right text-mono">{cx.valor_fechamento != null ? formatarMoeda(cx.valor_fechamento) : '-'}</td>
                      <td className="text-right text-mono">
                        {cx.diferenca != null ? (
                          <span className={cx.diferenca >= 0 ? 'text-sucesso' : 'text-perigo'}>
                            {cx.diferenca >= 0 ? '+' : ''}{formatarMoeda(cx.diferenca)}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        <span className={`badge ${cx.status === 'aberto' ? 'badge-sucesso' : 'badge-aviso'}`}>
                          {cx.status === 'aberto' ? '🟢 Aberto' : '🔒 Fechado'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal Abrir Caixa ── */}
      {mostrarAbrir && (
        <div className="modal-overlay" onClick={() => setMostrarAbrir(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-titulo">
              <span>➕ Abrir Caixa</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarAbrir(false)}>✕</button>
            </div>
            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Número do Caixa</label>
                <select className="input" value={numeroCaixa} onChange={(e) => setNumeroCaixa(parseInt(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>Caixa {n}</option>
                  ))}
                </select>
              </div>
              <div className="campo">
                <label>Valor de Abertura (R$)</label>
                <input
                  type="number"
                  className="input input-grande"
                  value={valorAbertura}
                  onChange={(e) => setValorAbertura(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') abrirCaixa(); }}
                />
                <span className="text-sm text-muted">Valor em dinheiro disponível no início do turno</span>
              </div>
            </div>
            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarAbrir(false)}>Cancelar</button>
              <button className="btn btn-sucesso" onClick={abrirCaixa}>✓ Abrir Caixa</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Fechar Caixa ── */}
      {mostrarFechar && (
        <div className="modal-overlay" onClick={() => setMostrarFechar(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-titulo">
              <span>🔒 Fechar {caixaAtivo?.nome}</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarFechar(false)}>✕</button>
            </div>

            {resumoCaixa && (
              <div style={{ background: 'var(--cor-fundo-3)', padding: 'var(--espaco-lg)', borderRadius: 'var(--raio-md)', marginBottom: 'var(--espaco-lg)' }}>
                <div className="pdv-total-linha">
                  <span className="text-muted">Valor Abertura:</span>
                  <span className="text-mono">{formatarMoeda(caixaAtivo?.valor_abertura)}</span>
                </div>
                <div className="pdv-total-linha">
                  <span className="text-muted">+ Vendas (dinheiro):</span>
                  <span className="text-mono text-sucesso">{formatarMoeda(resumoCaixa.por_forma_pagamento?.find(f => f.forma_pagamento === 'dinheiro')?.valor || 0)}</span>
                </div>
                <div className="pdv-total-linha">
                  <span className="text-muted">+ Suprimentos:</span>
                  <span className="text-mono text-sucesso">{formatarMoeda(resumoCaixa.suprimentos?.valor)}</span>
                </div>
                <div className="pdv-total-linha">
                  <span className="text-muted">- Sangrias:</span>
                  <span className="text-mono text-perigo">{formatarMoeda(resumoCaixa.sangrias?.valor)}</span>
                </div>
                <div className="pdv-total-linha pdv-total-final">
                  <span>Saldo Esperado:</span>
                  <span>{formatarMoeda(resumoCaixa.saldo_esperado)}</span>
                </div>
              </div>
            )}

            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Valor Conferido (R$ em dinheiro no caixa)</label>
                <input
                  type="number"
                  className="input input-grande"
                  value={valorFechamento}
                  onChange={(e) => setValorFechamento(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') fecharCaixa(); }}
                />
              </div>
              {valorFechamento && resumoCaixa && (
                <div style={{ textAlign: 'center', padding: 'var(--espaco-md)', background: 'var(--cor-fundo-3)', borderRadius: 'var(--raio-md)' }}>
                  <span className="text-sm text-muted">Diferença: </span>
                  <span className={`text-mono fw-bold ${(parseFloat(valorFechamento) - resumoCaixa.saldo_esperado) >= 0 ? 'text-sucesso' : 'text-perigo'}`}>
                    {(parseFloat(valorFechamento) - resumoCaixa.saldo_esperado) >= 0 ? '+' : ''}
                    {formatarMoeda(parseFloat(valorFechamento) - resumoCaixa.saldo_esperado)}
                  </span>
                </div>
              )}
              <div className="campo">
                <label>Observação (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={observacaoFechamento}
                  onChange={(e) => setObservacaoFechamento(e.target.value)}
                  placeholder="Observações do fechamento..."
                />
              </div>
            </div>
            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarFechar(false)}>Cancelar</button>
              <button className="btn btn-perigo" onClick={fecharCaixa}>🔒 Confirmar Fechamento</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Sangria ── */}
      {mostrarSangria && (
        <div className="modal-overlay" onClick={() => setMostrarSangria(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-titulo">
              <span>📤 Sangria (Retirada)</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarSangria(false)}>✕</button>
            </div>
            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Valor da retirada (R$)</label>
                <input
                  type="number"
                  className="input input-grande"
                  value={valorMovimentacao}
                  onChange={(e) => setValorMovimentacao(e.target.value)}
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') fazerSangria(); }}
                />
              </div>
              <div className="campo">
                <label>Motivo (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={observacaoMovimentacao}
                  onChange={(e) => setObservacaoMovimentacao(e.target.value)}
                  placeholder="Ex: Pagamento de fornecedor"
                />
              </div>
            </div>
            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarSangria(false)}>Cancelar</button>
              <button className="btn btn-perigo" onClick={fazerSangria}>📤 Registrar Sangria</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Suprimento ── */}
      {mostrarSuprimento && (
        <div className="modal-overlay" onClick={() => setMostrarSuprimento(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <div className="modal-titulo">
              <span>📥 Suprimento (Adição)</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarSuprimento(false)}>✕</button>
            </div>
            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Valor a adicionar (R$)</label>
                <input
                  type="number"
                  className="input input-grande"
                  value={valorMovimentacao}
                  onChange={(e) => setValorMovimentacao(e.target.value)}
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') fazerSuprimento(); }}
                />
              </div>
              <div className="campo">
                <label>Motivo (opcional)</label>
                <input
                  type="text"
                  className="input"
                  value={observacaoMovimentacao}
                  onChange={(e) => setObservacaoMovimentacao(e.target.value)}
                  placeholder="Ex: Troco adicional"
                />
              </div>
            </div>
            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarSuprimento(false)}>Cancelar</button>
              <button className="btn btn-sucesso" onClick={fazerSuprimento}>📥 Registrar Suprimento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
