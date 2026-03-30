import { useState, useRef, useEffect, useCallback } from 'react';
import { produtosAPI, vendasAPI, pagamentosAPI, impressoraAPI } from '../servicos/api';
import { formatarMoeda, FORMAS_PAGAMENTO } from '../utils/formatadores';
import { useAtalhos } from '../hooks/useAtalhos';
import { gerarComprovante } from '../componentes/Comprovante';
import ModalAjuda from '../componentes/ModalAjuda';

export default function PDV({ usuario, caixaAtivo }) {
  // ── Estado ──────────────────────────────────────────
  const [termoBusca, setTermoBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(-1);
  const [indiceBuscaFocado, setIndiceBuscaFocado] = useState(-1);
  const [desconto, setDesconto] = useState(0);
  const [mostrarPagamento, setMostrarPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [mostrarAjuda, setMostrarAjuda] = useState(false);
  const [mostrarDesconto, setMostrarDesconto] = useState(false);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Controle de Troco
  const [valorRecebido, setValorRecebido] = useState('');
  const trocoPendente = useRef(null);
  
  // Integração de Pagamentos
  const [pixGerado, setPixGerado] = useState(null);
  const [tefTransacao, setTefTransacao] = useState(null);
  const pollingRef = useRef(null);
  const tefPollingRef = useRef(null);

  // Refs para evitar stale closures nos callbacks assíncronos (polling TEF/PIX)
  const carrinhoRef = useRef(carrinho);
  const descontoRef = useRef(desconto);
  const formaPagamentoRef = useRef(formaPagamento);

  useEffect(() => { carrinhoRef.current = carrinho; }, [carrinho]);
  useEffect(() => { descontoRef.current = desconto; }, [desconto]);
  useEffect(() => { formaPagamentoRef.current = formaPagamento; }, [formaPagamento]);

  // Produto manual
  const [produtoManual, setProdutoManual] = useState({ nome: '', preco: '', quantidade: 1 });

  const inputBuscaRef = useRef(null);
  const inputDescontoRef = useRef(null);

  // ── Cálculos ────────────────────────────────────────
  const subtotal = carrinho.reduce((acc, item) => acc + item.subtotal, 0);
  const total = Math.max(0, subtotal - desconto);
  const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);

  // ── Mensagem temporária ─────────────────────────────
  const mostrarMensagem = useCallback((texto, tipo = 'info') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  }, []);

  // ── Busca de produtos ───────────────────────────────
  useEffect(() => {
    if (termoBusca.length < 1) {
      setResultados([]);
      setIndiceBuscaFocado(-1);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const dados = await produtosAPI.buscar(termoBusca);
        setResultados(dados);
        setIndiceBuscaFocado(dados.length > 0 ? 0 : -1);
      } catch (erro) {
        console.error('Erro na busca:', erro);
        setResultados([]);
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [termoBusca]);

  // ── Adicionar ao carrinho ───────────────────────────
  const adicionarAoCarrinho = useCallback((produto) => {
    setCarrinho(prev => {
      const existente = prev.find(item => item.produto_id === produto.id);
      if (existente) {
        return prev.map(item =>
          item.produto_id === produto.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
                subtotal: (item.quantidade + 1) * item.preco_unitario,
              }
            : item
        );
      }
      return [...prev, {
        produto_id: produto.id,
        nome: produto.nome,
        preco_unitario: produto.preco,
        quantidade: 1,
        subtotal: produto.preco,
      }];
    });
    setTermoBusca('');
    setResultados([]);
    setIndiceBuscaFocado(-1);
    inputBuscaRef.current?.focus();
    mostrarMensagem(`✓ ${produto.nome} adicionado`, 'sucesso');
  }, [mostrarMensagem]);

  // ── Alterar quantidade ──────────────────────────────
  const alterarQuantidade = useCallback((indice, delta) => {
    setCarrinho(prev => {
      const novo = [...prev];
      const item = novo[indice];
      const novaQtd = item.quantidade + delta;
      if (novaQtd <= 0) {
        novo.splice(indice, 1);
        if (itemSelecionado >= novo.length) setItemSelecionado(novo.length - 1);
      } else {
        novo[indice] = { ...item, quantidade: novaQtd, subtotal: novaQtd * item.preco_unitario };
      }
      return novo;
    });
  }, [itemSelecionado]);

  // ── Remover item ────────────────────────────────────
  const removerItem = useCallback(() => {
    if (itemSelecionado >= 0 && itemSelecionado < carrinho.length) {
      const nome = carrinho[itemSelecionado].nome;
      setCarrinho(prev => prev.filter((_, i) => i !== itemSelecionado));
      setItemSelecionado(prev => Math.min(prev, carrinho.length - 2));
      mostrarMensagem(`✕ ${nome} removido`, 'perigo');
    }
  }, [itemSelecionado, carrinho, mostrarMensagem]);

  const cancelarVenda = useCallback(() => {
    if (carrinho.length === 0) return;
    setCarrinho([]);
    setDesconto(0);
    setItemSelecionado(-1);
    setMostrarPagamento(false);
    setPixGerado(null);
    setTefTransacao(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (tefPollingRef.current) clearInterval(tefPollingRef.current);
    inputBuscaRef.current?.focus();
    mostrarMensagem('Venda cancelada', 'perigo');
  }, [carrinho.length, mostrarMensagem]);

  // ── Finalizar venda (Salvar no banco local e fechar a tela) ──
  const processarVendaLocal = async () => {
    try {
      // Usar refs para obter estado atualizado (evita stale closures)
      const carrinhoAtual = carrinhoRef.current;
      const descontoAtual = descontoRef.current;
      const formaPagamentoAtual = formaPagamentoRef.current;

      if (!carrinhoAtual || carrinhoAtual.length === 0) {
        mostrarMensagem('Erro: carrinho vazio ao finalizar', 'perigo');
        return;
      }

      const dados = {
        itens: carrinhoAtual.map(item => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
        })),
        desconto: descontoAtual,
        forma_pagamento: formaPagamentoAtual,
        operador_id: usuario?.id || null,
        caixa_id: caixaAtivo?.id || null,
      };

      // Troco para dinheiro
      if (formaPagamentoAtual === 'dinheiro' && trocoPendente.current) {
        dados.valor_recebido = trocoPendente.current.valor_recebido;
        dados.troco = trocoPendente.current.troco;
      }

      const venda = await vendasAPI.registrar(dados);

      // Gerar comprovante com dados extras
      gerarComprovante({
        ...venda,
        operador_nome: usuario?.nome,
        caixa_nome: caixaAtivo?.nome,
      });

      // Imprimir na térmica (silencioso - não bloqueia)
      impressoraAPI.imprimirCupom({
        venda,
        operador: usuario?.nome,
        caixa: caixaAtivo?.nome,
      }).catch(() => {});

      // Mostrar troco se pagamento em dinheiro
      const trocoInfo = trocoPendente.current;

      setCarrinho([]);
      setDesconto(0);
      setItemSelecionado(-1);
      setMostrarPagamento(false);
      setPixGerado(null);
      setTefTransacao(null);
      setValorRecebido('');
      trocoPendente.current = null;
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (tefPollingRef.current) clearInterval(tefPollingRef.current);
      setFormaPagamento('dinheiro');
      inputBuscaRef.current?.focus();

      if (trocoInfo && trocoInfo.troco > 0) {
        mostrarMensagem(`✓ Venda finalizada! Total: ${formatarMoeda(venda.total)} · 💵 TROCO: ${formatarMoeda(trocoInfo.troco)}`, 'sucesso');
      } else {
        mostrarMensagem(`✓ Venda finalizada! Total: ${formatarMoeda(venda.total)}`, 'sucesso');
      }
    } catch (erro) {
      mostrarMensagem(`Erro ao salvar venda: ${erro.message}`, 'perigo');
    } finally {
      setProcessando(false);
    }
  };

  // ── Iniciar Pagamento ───────────────────────────────
  const finalizarVenda = useCallback(async () => {
    if (carrinho.length === 0) {
      mostrarMensagem('Carrinho vazio', 'aviso');
      return;
    }

    setProcessando(true);

    if (formaPagamento === 'dinheiro') {
      const recebido = parseFloat(valorRecebido);
      if (!recebido || recebido < total) {
        mostrarMensagem('Valor recebido deve ser maior ou igual ao total', 'aviso');
        setProcessando(false);
        return;
      }
      trocoPendente.current = {
        valor_recebido: recebido,
        troco: recebido - total,
      };
      await processarVendaLocal();
      return;
    }

    // ── PIX (AbacatePay primário, TEF fallback) ──
    if (formaPagamento === 'pix') {
      try {
        const resultado = await pagamentosAPI.pix({
          valor: total,
          descricao: `Venda PDV - ${totalItens} itens`,
        });

        // Se o provedor for TEF (fallback), tratar como transação TEF
        if (resultado.provedor === 'tef') {
          setTefTransacao(resultado);
          iniciarPollingTef(resultado.id);
          setProcessando(false);
          return;
        }

        // Provedor AbacatePay normal com QR Code
        setPixGerado(resultado);
        
        // Polling para verificar status do PIX
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = setInterval(async () => {
          try {
            const statusPix = await pagamentosAPI.statusPix(resultado.id);
            if (statusPix.status === 'PAID') {
              clearInterval(pollingRef.current);
              mostrarMensagem('✓ Pagamento PIX confirmado!', 'sucesso');
              await processarVendaLocal();
            } else if (statusPix.status === 'EXPIRED' || statusPix.status === 'CANCELLED') {
              clearInterval(pollingRef.current);
              mostrarMensagem('✕ Pagamento PIX expirado/cancelado', 'perigo');
              setPixGerado(null);
              setProcessando(false);
            }
          } catch (e) {
            console.error('Erro no polling do PIX', e);
          }
        }, 3000);
      } catch (erro) {
        mostrarMensagem(`Erro ao gerar PIX: ${erro.message}`, 'perigo');
        setProcessando(false);
      }
      return;
    }

    // ── Cartão Crédito / Débito (TEF/PINPAD) ──
    if (formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito') {
      try {
        const tipo = formaPagamento === 'cartao_credito' ? 'credito' : 'debito';
        const resultado = await pagamentosAPI.tefIniciar({
          valor: total,
          tipo,
          parcelas: 1,
          descricao: `Venda PDV - ${totalItens} itens`,
        });

        setTefTransacao(resultado);
        iniciarPollingTef(resultado.id);
      } catch (erro) {
        mostrarMensagem(`Erro TEF: ${erro.message}`, 'perigo');
      } finally {
        setProcessando(false);
      }
      return;
    }
  }, [carrinho, desconto, formaPagamento, total, totalItens, mostrarMensagem]);

  // ── Polling TEF (verifica status a cada 2s) ────────
  const iniciarPollingTef = useCallback((tefId) => {
    if (tefPollingRef.current) clearInterval(tefPollingRef.current);
    tefPollingRef.current = setInterval(async () => {
      try {
        const status = await pagamentosAPI.tefStatus(tefId);
        setTefTransacao(prev => ({ ...prev, ...status }));

        if (status.status === 'APROVADO') {
          clearInterval(tefPollingRef.current);
          mostrarMensagem('✓ Transação aprovada na maquininha!', 'sucesso');
          setTimeout(() => processarVendaLocal(), 1500);
        } else if (status.status === 'RECUSADO' || status.status === 'CANCELADO' || status.status === 'TIMEOUT') {
          clearInterval(tefPollingRef.current);
          mostrarMensagem(`✕ Transação ${status.status.toLowerCase()}: ${status.mensagem}`, 'perigo');
          setTimeout(() => setTefTransacao(null), 2500);
        }
      } catch (e) {
        console.error('Erro no polling TEF:', e);
      }
    }, 2000);
  }, [mostrarMensagem]);

  // Limpar polling ao desmontar
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (tefPollingRef.current) clearInterval(tefPollingRef.current);
    };
  }, []);

  // ── Adicionar produto manual ────────────────────────
  const adicionarManual = useCallback(() => {
    const { nome, preco, quantidade } = produtoManual;
    if (!nome || !preco || preco <= 0) {
      mostrarMensagem('Preencha nome e preço', 'aviso');
      return;
    }
    const precoNum = parseFloat(preco);
    const qtdNum = parseInt(quantidade) || 1;
    setCarrinho(prev => [...prev, {
      produto_id: `manual-${Date.now()}`,
      nome,
      preco_unitario: precoNum,
      quantidade: qtdNum,
      subtotal: precoNum * qtdNum,
    }]);
    setProdutoManual({ nome: '', preco: '', quantidade: 1 });
    setMostrarManual(false);
    inputBuscaRef.current?.focus();
    mostrarMensagem(`✓ ${nome} adicionado manualmente`, 'sucesso');
  }, [produtoManual, mostrarMensagem]);

  // ── Atalhos de teclado ──────────────────────────────
  useAtalhos({
    'F1': () => setMostrarAjuda(true),
    'F2': () => { setMostrarPagamento(false); setMostrarDesconto(false); setMostrarManual(false); inputBuscaRef.current?.focus(); },
    'F3': () => { setMostrarPagamento(false); setMostrarDesconto(false); setMostrarManual(true); },
    'F4': () => { if (carrinho.length > 0) { setMostrarDesconto(false); setMostrarManual(false); setMostrarPagamento(true); } },
    'F5': () => { setTermoBusca(''); setResultados([]); inputBuscaRef.current?.focus(); mostrarMensagem('Tela atualizada', 'info'); },
    'F6': () => { if (carrinho.length > 0) { setMostrarPagamento(false); setMostrarManual(false); setMostrarDesconto(true); setTimeout(() => inputDescontoRef.current?.focus(), 50); } },
    'F7': () => removerItem(),
    'F8': () => cancelarVenda(),
    'F9': () => { if (mostrarPagamento) finalizarVenda(); else if (carrinho.length > 0) setMostrarPagamento(true); },
    'Escape': () => {
      if (mostrarAjuda) { setMostrarAjuda(false); return; }
      if (mostrarPagamento) { setMostrarPagamento(false); return; }
      if (mostrarDesconto) { setMostrarDesconto(false); return; }
      if (mostrarManual) { setMostrarManual(false); return; }
      if (resultados.length > 0) { setResultados([]); setTermoBusca(''); return; }
    },
  }, [carrinho, mostrarPagamento, mostrarAjuda, mostrarDesconto, mostrarManual, resultados, itemSelecionado, formaPagamento, desconto, removerItem, cancelarVenda, finalizarVenda]);

  // ── Navegação com teclado na busca ──────────────────
  const handleBuscaKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceBuscaFocado(prev => Math.min(prev + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceBuscaFocado(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && resultados.length > 0 && indiceBuscaFocado >= 0) {
      e.preventDefault();
      adicionarAoCarrinho(resultados[indiceBuscaFocado]);
    }
  };

  // ── Auto-focus ──────────────────────────────────────
  useEffect(() => {
    inputBuscaRef.current?.focus();
  }, []);

  // ── Render ──────────────────────────────────────────
  return (
    <div className="flex-col" style={{ flex: 1, overflow: 'hidden' }}>
      {/* Cabeçalho */}
      <div className="cabecalho">
        <span className="cabecalho-titulo">🛒 Ponto de Venda</span>
        <div className="cabecalho-atalhos">
          <span><span className="tecla">F1</span> Ajuda</span>
          <span><span className="tecla">F2</span> Busca</span>
          <span><span className="tecla">F4</span> Pagar</span>
          <span><span className="tecla">F8</span> Cancelar</span>
          <span><span className="tecla">F9</span> Finalizar</span>
        </div>
      </div>

      {/* Mensagem */}
      {mensagem && (
        <div style={{
          padding: '8px 16px',
          background: mensagem.tipo === 'sucesso' ? 'var(--cor-sucesso-fundo)' : mensagem.tipo === 'perigo' ? 'var(--cor-perigo-fundo)' : 'var(--cor-fundo-3)',
          color: mensagem.tipo === 'sucesso' ? 'var(--cor-sucesso)' : mensagem.tipo === 'perigo' ? 'var(--cor-perigo)' : 'var(--cor-texto)',
          textAlign: 'center',
          fontSize: 'var(--tamanho-sm)',
          fontWeight: 500,
        }}>
          {mensagem.texto}
        </div>
      )}

      {/* Layout principal */}
      <div className="pdv-layout">
        {/* Lado esquerdo - Busca e lista de produtos */}
        <div className="pdv-esquerda">
          <div className="pdv-busca">
            <input
              ref={inputBuscaRef}
              type="text"
              className="input input-grande"
              placeholder="🔍 Buscar produto ou ler código de barras..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              onKeyDown={handleBuscaKeyDown}
              autoComplete="off"
            />
            {resultados.length > 0 && (
              <div className="resultados-busca">
                {resultados.map((produto, i) => (
                  <div
                    key={produto.id}
                    className={`resultado-item ${i === indiceBuscaFocado ? 'focado' : ''}`}
                    onClick={() => adicionarAoCarrinho(produto)}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{produto.nome}</div>
                      <div className="text-sm text-muted">
                        {produto.codigo_barras || 'Sem código'} · Estoque: {produto.estoque}
                      </div>
                    </div>
                    <div className="text-mono fw-bold" style={{ color: 'var(--cor-sucesso)' }}>
                      {formatarMoeda(produto.preco)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrinho */}
          <div className="pdv-carrinho">
            {carrinho.length === 0 ? (
              <div className="vazio">
                <span style={{ fontSize: '2rem' }}>🛒</span>
                <span>Carrinho vazio</span>
                <span className="text-sm">Use <span className="tecla">F2</span> para buscar produtos</span>
              </div>
            ) : (
              carrinho.map((item, i) => (
                <div
                  key={item.produto_id}
                  className={`carrinho-item ${i === itemSelecionado ? 'selecionado' : ''}`}
                  onClick={() => setItemSelecionado(i)}
                >
                  <div className="carrinho-item-info">
                    <div className="carrinho-item-nome">{item.nome}</div>
                    <div className="carrinho-item-detalhes">
                      {formatarMoeda(item.preco_unitario)} / un
                    </div>
                  </div>
                  <div className="carrinho-item-qtd">
                    <button
                      className="btn btn-secundario btn-icone"
                      onClick={(e) => { e.stopPropagation(); alterarQuantidade(i, -1); }}
                      title="Diminuir"
                    >−</button>
                    <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 600 }}>
                      {item.quantidade}
                    </span>
                    <button
                      className="btn btn-secundario btn-icone"
                      onClick={(e) => { e.stopPropagation(); alterarQuantidade(i, 1); }}
                      title="Aumentar"
                    >+</button>
                  </div>
                  <div className="carrinho-item-subtotal">
                    {formatarMoeda(item.subtotal)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Lado direito - Totais e ações */}
        <div className="pdv-direita">
          <div style={{ padding: 'var(--espaco-xl)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="text-sm text-muted mb-md">{totalItens} {totalItens === 1 ? 'item' : 'itens'} no carrinho</div>

            <div className="pdv-totais" style={{ border: 'none', padding: 0 }}>
              <div className="pdv-total-linha">
                <span className="text-muted">Subtotal</span>
                <span className="text-mono">{formatarMoeda(subtotal)}</span>
              </div>
              {desconto > 0 && (
                <div className="pdv-total-linha">
                  <span className="text-muted">Desconto</span>
                  <span className="text-mono text-perigo">-{formatarMoeda(desconto)}</span>
                </div>
              )}
              <div className="pdv-total-linha pdv-total-final">
                <span>TOTAL</span>
                <span>{formatarMoeda(total)}</span>
              </div>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--espaco-md)' }}>
              <button
                className="btn btn-primario btn-grande btn-bloco"
                onClick={() => carrinho.length > 0 && setMostrarPagamento(true)}
                disabled={carrinho.length === 0}
              >
                💳 Pagamento <span className="tecla">F4</span>
              </button>
              <div style={{ display: 'flex', gap: 'var(--espaco-md)' }}>
                <button
                  className="btn btn-secundario btn-bloco"
                  onClick={() => carrinho.length > 0 && setMostrarDesconto(true)}
                  disabled={carrinho.length === 0}
                >
                  🏷️ Desconto <span className="tecla">F6</span>
                </button>
                <button
                  className="btn btn-perigo btn-bloco"
                  onClick={cancelarVenda}
                  disabled={carrinho.length === 0}
                >
                  ✕ Cancelar <span className="tecla">F8</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de atalhos */}
      <div className="barra-atalhos">
        <span className="atalho-item"><span className="tecla">F1</span> Ajuda</span>
        <span className="atalho-item"><span className="tecla">F2</span> Busca</span>
        <span className="atalho-item"><span className="tecla">F3</span> Manual</span>
        <span className="atalho-item"><span className="tecla">F4</span> Pagar</span>
        <span className="atalho-item"><span className="tecla">F6</span> Desconto</span>
        <span className="atalho-item"><span className="tecla">F7</span> Remover</span>
        <span className="atalho-item"><span className="tecla">F8</span> Cancelar</span>
        <span className="atalho-item"><span className="tecla">F9</span> Finalizar</span>
      </div>

      {/* ── Modais ──────────────────────────────────── */}
      <ModalAjuda aberto={mostrarAjuda} aoFechar={() => setMostrarAjuda(false)} />

      {/* Modal de Pagamento */}
      {mostrarPagamento && (
        <div className="modal-overlay" onClick={() => setMostrarPagamento(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-titulo">
              <span>💳 Finalizar Pagamento</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarPagamento(false)}>✕</button>
            </div>

            <div className="mb-lg">
              <div className="pdv-total-linha pdv-total-final" style={{ borderTop: 'none', paddingTop: 0 }}>
                <span>TOTAL</span>
                <span>{formatarMoeda(total)}</span>
              </div>
            </div>

            {/* Controle de Troco (Dinheiro) */}
            {formaPagamento === 'dinheiro' && !pixGerado && !tefTransacao && (
              <div className="troco-container">
                <div className="campo">
                  <label>💵 Valor Recebido (R$)</label>
                  <input
                    type="number"
                    className="input input-grande troco-input"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') finalizarVenda(); }}
                  />
                </div>
                {valorRecebido && parseFloat(valorRecebido) >= total && (
                  <div className="troco-resultado">
                    <span className="troco-label">TROCO</span>
                    <span className="troco-valor">
                      {formatarMoeda(parseFloat(valorRecebido) - total)}
                    </span>
                  </div>
                )}
                {valorRecebido && parseFloat(valorRecebido) < total && (
                  <div className="troco-resultado troco-insuficiente">
                    <span className="troco-label">⚠️ FALTAM</span>
                    <span className="troco-valor">
                      {formatarMoeda(total - parseFloat(valorRecebido))}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: 'var(--espaco-sm)' }}>
                  {[2, 5, 10, 20, 50, 100, 200].map(v => (
                    <button
                      key={v}
                      className="btn btn-secundario"
                      style={{ flex: '1 1 auto', minWidth: '50px', fontSize: 'var(--tamanho-sm)' }}
                      onClick={() => setValorRecebido(String(v))}
                    >
                      R$ {v}
                    </button>
                  ))}
                  <button
                    className="btn btn-sucesso"
                    style={{ flex: '1 1 auto', minWidth: '60px', fontSize: 'var(--tamanho-sm)' }}
                    onClick={() => setValorRecebido(String(total))}
                  >
                    Exato
                  </button>
                </div>
              </div>
            )}

            <div className="mb-lg">
              <label className="text-sm text-muted mb-md" style={{ display: 'block' }}>Forma de pagamento:</label>
              <div className="grid-pagamento">
                {Object.entries(FORMAS_PAGAMENTO).map(([chave, info]) => (
                  <button
                    key={chave}
                    disabled={pixGerado != null || tefTransacao != null}
                    className={`btn-pagamento ${formaPagamento === chave ? 'selecionado' : ''}`}
                    onClick={() => setFormaPagamento(chave)}
                  >
                    <span className="icone">{info.icone}</span>
                    <span>{info.nome}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* View do PIX Gerado */}
            {pixGerado && (
              <div className="text-center mb-lg">
                <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', display: 'inline-block' }}>
                  <img src={pixGerado.qrcode_imagem} alt="QR Code PIX" width="200" height="200" />
                </div>
                <div className="mt-md text-sm text-muted">Aguardando pagamento PIX via AbacatePay...</div>
                {pixGerado.dev_mode && (
                  <button
                    className="btn btn-secundario btn-pequeno mt-md"
                    onClick={async () => {
                      try {
                        await pagamentosAPI.simularPix(pixGerado.id);
                        mostrarMensagem('Pagamento simulado enviado', 'info');
                      } catch (e) {
                        mostrarMensagem('Erro na simulação', 'perigo');
                      }
                    }}
                  >
                    Simular Pagamento (DEV MODE)
                  </button>
                )}
              </div>
            )}

            {/* View TEF/PINPAD (Maquininha) */}
            {tefTransacao && (
              <div className="text-center mb-lg">
                <div style={{ background: 'var(--cor-fundo-3)', padding: '24px', borderRadius: '8px', border: '1px solid var(--cor-borda)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📠</div>
                  {tefTransacao.status === 'CONECTANDO' && (
                    <>
                      <h3 className="mb-sm">Conectando ao Terminal...</h3>
                      <p className="text-muted text-sm">Estabelecendo comunicação com o PINPAD</p>
                    </>
                  )}
                  {tefTransacao.status === 'AGUARDANDO_CARTAO' && (
                    <>
                      <h3 className="mb-sm">Aguardando Cartão</h3>
                      <p className="text-muted text-sm mb-md">Insira, aproxime ou passe o cartão na maquininha.</p>
                      <p className="text-mono" style={{ fontSize: 'var(--tamanho-lg)', color: 'var(--cor-primaria)' }}>
                        {formatarMoeda(tefTransacao.valor)}
                      </p>
                      {tefTransacao.dev_mode && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                          <button
                            className="btn btn-sucesso btn-pequeno"
                            onClick={async () => {
                              try {
                                await pagamentosAPI.tefSimularAprovacao(tefTransacao.id);
                              } catch (e) {
                                mostrarMensagem('Erro na simulação', 'perigo');
                              }
                            }}
                          >Simular Aprovação (DEV)</button>
                          <button
                            className="btn btn-perigo btn-pequeno"
                            onClick={async () => {
                              try {
                                await pagamentosAPI.tefSimularRecusa(tefTransacao.id);
                              } catch (e) {
                                mostrarMensagem('Erro na simulação', 'perigo');
                              }
                            }}
                          >Simular Recusa (DEV)</button>
                        </div>
                      )}
                    </>
                  )}
                  {tefTransacao.status === 'PROCESSANDO' && (
                    <>
                      <h3 className="mb-sm">Processando Transação...</h3>
                      <p className="text-muted text-sm">Comunicando com a adquirente</p>
                    </>
                  )}
                  {tefTransacao.status === 'APROVADO' && (
                    <>
                      <h3 className="mb-sm text-sucesso">Transação Aprovada! ✅</h3>
                      <p className="text-muted text-sm">NSU: {tefTransacao.nsu} · {tefTransacao.bandeira}</p>
                      <p className="text-muted text-sm">Finalizando venda...</p>
                    </>
                  )}
                  {(tefTransacao.status === 'RECUSADO' || tefTransacao.status === 'CANCELADO') && (
                    <>
                      <h3 className="mb-sm text-perigo">Transação {tefTransacao.status === 'RECUSADO' ? 'Recusada' : 'Cancelada'} ❌</h3>
                      <p className="text-muted text-sm">{tefTransacao.mensagem}</p>
                    </>
                  )}
                  {tefTransacao.status === 'ERRO' && (
                    <>
                      <h3 className="mb-sm text-perigo">Erro no Terminal ⚠️</h3>
                      <p className="text-muted text-sm">{tefTransacao.mensagem}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="modal-acoes">
              <button 
                className="btn btn-secundario" 
                onClick={() => { 
                  setMostrarPagamento(false); 
                  setPixGerado(null);
                  if (tefTransacao && (tefTransacao.status === 'CONECTANDO' || tefTransacao.status === 'AGUARDANDO_CARTAO')) {
                    pagamentosAPI.tefCancelar(tefTransacao.id).catch(() => {});
                  }
                  setTefTransacao(null);
                  if (pollingRef.current) clearInterval(pollingRef.current);
                  if (tefPollingRef.current) clearInterval(tefPollingRef.current);
                }}
              >
                Voltar <span className="tecla">ESC</span>
              </button>
              {!pixGerado && !tefTransacao && (
                <button
                  className="btn btn-sucesso btn-grande"
                  onClick={finalizarVenda}
                  disabled={processando || !formaPagamento || (formaPagamento === 'dinheiro' && (!valorRecebido || parseFloat(valorRecebido) < total))}
                >
                  {processando ? '⏳ Processando...' : formaPagamento === 'dinheiro' ? `💵 Receber ${valorRecebido ? formatarMoeda(parseFloat(valorRecebido)) : ''}` : '💰 Confirmar Transação'}
                  <span className="tecla">F9</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Desconto */}
      {mostrarDesconto && (
        <div className="modal-overlay" onClick={() => setMostrarDesconto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <div className="modal-titulo">
              <span>🏷️ Aplicar Desconto</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarDesconto(false)}>✕</button>
            </div>
            <div className="campo">
              <label>Valor do desconto (R$)</label>
              <input
                ref={inputDescontoRef}
                type="number"
                className="input input-grande"
                value={desconto || ''}
                onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                placeholder="0,00"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setMostrarDesconto(false); }
                }}
              />
            </div>
            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => { setDesconto(0); setMostrarDesconto(false); }}>
                Remover
              </button>
              <button className="btn btn-primario" onClick={() => setMostrarDesconto(false)}>
                Aplicar <span className="tecla">Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Produto Manual */}
      {mostrarManual && (
        <div className="modal-overlay" onClick={() => setMostrarManual(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-titulo">
              <span>📝 Adicionar Produto Manual</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarManual(false)}>✕</button>
            </div>
            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Nome do produto</label>
                <input
                  type="text"
                  className="input"
                  value={produtoManual.nome}
                  onChange={(e) => setProdutoManual(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Produto avulso"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') adicionarManual(); }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--espaco-lg)' }}>
                <div className="campo" style={{ flex: 1 }}>
                  <label>Preço (R$)</label>
                  <input
                    type="number"
                    className="input"
                    value={produtoManual.preco}
                    onChange={(e) => setProdutoManual(prev => ({ ...prev, preco: e.target.value }))}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    onKeyDown={(e) => { if (e.key === 'Enter') adicionarManual(); }}
                  />
                </div>
                <div className="campo" style={{ width: '100px' }}>
                  <label>Qtd</label>
                  <input
                    type="number"
                    className="input"
                    value={produtoManual.quantidade}
                    onChange={(e) => setProdutoManual(prev => ({ ...prev, quantidade: e.target.value }))}
                    min="1"
                    onKeyDown={(e) => { if (e.key === 'Enter') adicionarManual(); }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarManual(false)}>
                Cancelar <span className="tecla">ESC</span>
              </button>
              <button className="btn btn-primario" onClick={adicionarManual}>
                Adicionar <span className="tecla">Enter</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
