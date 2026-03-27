import { useState, useEffect, useCallback } from 'react';
import { produtosAPI } from '../servicos/api';
import { formatarMoeda } from '../utils/formatadores';

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const formVazio = { nome: '', preco: '', estoque: '0', categoria: 'Geral', codigo_barras: '' };
  const [form, setForm] = useState(formVazio);

  // ── Carregar produtos ───────────────────────────────
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await produtosAPI.listar({ busca, limite: 100 });
      setProdutos(dados.produtos);
      setTotal(dados.total);
    } catch (erro) {
      console.error('Erro ao carregar produtos:', erro);
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  useEffect(() => {
    const timeout = setTimeout(carregar, 200);
    return () => clearTimeout(timeout);
  }, [carregar]);

  // ── Mensagem temporária ─────────────────────────────
  const mostrar = (texto, tipo = 'info') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  };

  // ── Abrir formulário ────────────────────────────────
  const abrirNovo = () => {
    setForm(formVazio);
    setEditando(null);
    setMostrarForm(true);
  };

  const abrirEdicao = (produto) => {
    setForm({
      nome: produto.nome,
      preco: produto.preco.toString(),
      estoque: produto.estoque.toString(),
      categoria: produto.categoria || 'Geral',
      codigo_barras: produto.codigo_barras || '',
    });
    setEditando(produto.id);
    setMostrarForm(true);
  };

  // ── Salvar ──────────────────────────────────────────
  const salvar = async () => {
    if (!form.nome || !form.preco) {
      mostrar('Preencha nome e preço', 'aviso');
      return;
    }

    try {
      const dados = {
        ...form,
        preco: parseFloat(form.preco),
        estoque: parseInt(form.estoque) || 0,
      };

      if (editando) {
        await produtosAPI.atualizar(editando, dados);
        mostrar('Produto atualizado!', 'sucesso');
      } else {
        await produtosAPI.criar(dados);
        mostrar('Produto criado!', 'sucesso');
      }

      setMostrarForm(false);
      setEditando(null);
      carregar();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  // ── Remover ─────────────────────────────────────────
  const remover = async (id, nome) => {
    if (!window.confirm(`Remover "${nome}"?`)) return;
    try {
      await produtosAPI.remover(id);
      mostrar('Produto removido!', 'sucesso');
      carregar();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  return (
    <div className="flex-col" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="cabecalho">
        <span className="cabecalho-titulo">📦 Cadastro de Produtos</span>
        <span className="text-sm text-muted">{total} produtos</span>
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

      <div style={{ padding: 'var(--espaco-lg)', display: 'flex', gap: 'var(--espaco-md)' }}>
        <input
          type="text"
          className="input"
          placeholder="🔍 Buscar por nome ou código..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primario" onClick={abrirNovo}>
          + Novo Produto
        </button>
      </div>

      <div className="tabela-container" style={{ flex: 1 }}>
        <table className="tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th style={{ textAlign: 'right' }}>Preço</th>
              <th style={{ textAlign: 'right' }}>Estoque</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-muted" style={{ padding: '32px' }}>
                  {carregando ? '⏳ Carregando...' : 'Nenhum produto encontrado'}
                </td>
              </tr>
            ) : (
              produtos.map(produto => (
                <tr key={produto.id}>
                  <td className="text-mono text-sm">{produto.codigo_barras || '-'}</td>
                  <td style={{ fontWeight: 500 }}>{produto.nome}</td>
                  <td><span className="badge badge-sucesso">{produto.categoria}</span></td>
                  <td className="text-right text-mono">{formatarMoeda(produto.preco)}</td>
                  <td className="text-right">
                    <span className={produto.estoque <= 10 ? 'text-perigo fw-bold' : ''}>
                      {produto.estoque}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button className="btn btn-fantasma btn-icone" onClick={() => abrirEdicao(produto)} title="Editar">
                        ✏️
                      </button>
                      <button className="btn btn-fantasma btn-icone" onClick={() => remover(produto.id, produto.nome)} title="Remover">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Formulário */}
      {mostrarForm && (
        <div className="modal-overlay" onClick={() => setMostrarForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-titulo">
              <span>{editando ? '✏️ Editar Produto' : '➕ Novo Produto'}</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarForm(false)}>✕</button>
            </div>

            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Nome *</label>
                <input
                  type="text"
                  className="input"
                  value={form.nome}
                  onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do produto"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
                />
              </div>

              <div className="form-grid">
                <div className="campo">
                  <label>Preço (R$) *</label>
                  <input
                    type="number"
                    className="input"
                    value={form.preco}
                    onChange={(e) => setForm(prev => ({ ...prev, preco: e.target.value }))}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
                  />
                </div>
                <div className="campo">
                  <label>Estoque</label>
                  <input
                    type="number"
                    className="input"
                    value={form.estoque}
                    onChange={(e) => setForm(prev => ({ ...prev, estoque: e.target.value }))}
                    min="0"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="campo">
                  <label>Categoria</label>
                  <input
                    type="text"
                    className="input"
                    value={form.categoria}
                    onChange={(e) => setForm(prev => ({ ...prev, categoria: e.target.value }))}
                    placeholder="Geral"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
                  />
                </div>
                <div className="campo">
                  <label>Código de Barras</label>
                  <input
                    type="text"
                    className="input"
                    value={form.codigo_barras}
                    onChange={(e) => setForm(prev => ({ ...prev, codigo_barras: e.target.value }))}
                    placeholder="Ex: 7891000100101"
                    onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarForm(false)}>
                Cancelar
              </button>
              <button className="btn btn-primario" onClick={salvar}>
                {editando ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
