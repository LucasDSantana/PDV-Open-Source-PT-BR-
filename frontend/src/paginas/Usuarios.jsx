import { useState, useEffect, useCallback } from 'react';
import { authAPI } from '../servicos/api';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [mensagem, setMensagem] = useState(null);

  const formVazio = { nome: '', login: '', senha: '', perfil: 'operador' };
  const [form, setForm] = useState(formVazio);

  const mostrar = (texto, tipo = 'info') => {
    setMensagem({ texto, tipo });
    setTimeout(() => setMensagem(null), 3000);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await authAPI.listarUsuarios();
      setUsuarios(lista);
    } catch (erro) {
      console.error('Erro ao carregar usuários:', erro);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirNovo = () => {
    setForm(formVazio);
    setEditando(null);
    setMostrarForm(true);
  };

  const abrirEdicao = (u) => {
    setForm({ nome: u.nome, login: u.login, senha: '', perfil: u.perfil });
    setEditando(u.id);
    setMostrarForm(true);
  };

  const salvar = async () => {
    if (!form.nome || !form.login) {
      mostrar('Preencha nome e login', 'aviso');
      return;
    }
    if (!editando && !form.senha) {
      mostrar('Informe a senha para novo usuário', 'aviso');
      return;
    }

    try {
      const dados = { ...form };
      if (!dados.senha) delete dados.senha; // Não altera senha se vazio

      if (editando) {
        await authAPI.editarUsuario(editando, dados);
        mostrar('✓ Usuário atualizado!', 'sucesso');
      } else {
        await authAPI.criarUsuario(dados);
        mostrar('✓ Usuário criado!', 'sucesso');
      }
      setMostrarForm(false);
      setEditando(null);
      carregar();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  const toggleAtivo = async (u) => {
    try {
      await authAPI.editarUsuario(u.id, { ativo: !u.ativo });
      mostrar(u.ativo ? 'Usuário desativado' : 'Usuário reativado', 'sucesso');
      carregar();
    } catch (erro) {
      mostrar(`Erro: ${erro.message}`, 'perigo');
    }
  };

  return (
    <div className="flex-col" style={{ flex: 1, overflow: 'hidden' }}>
      <div className="cabecalho">
        <span className="cabecalho-titulo">👥 Gestão de Usuários</span>
        <button className="btn btn-primario" onClick={abrirNovo}>+ Novo Usuário</button>
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

      <div className="tabela-container" style={{ flex: 1 }}>
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Login</th>
              <th>Perfil</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted" style={{ padding: '32px' }}>
                  {carregando ? '⏳ Carregando...' : 'Nenhum usuário encontrado'}
                </td>
              </tr>
            ) : (
              usuarios.map(u => (
                <tr key={u.id} style={{ opacity: u.ativo ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 500 }}>{u.nome}</td>
                  <td className="text-mono">{u.login}</td>
                  <td>
                    <span className={`badge ${u.perfil === 'gerente' ? 'badge-aviso' : 'badge-sucesso'}`}>
                      {u.perfil === 'gerente' ? '👑 Gerente' : '👤 Operador'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${u.ativo ? 'badge-sucesso' : 'badge-perigo'}`}>
                      {u.ativo ? '✅ Ativo' : '❌ Inativo'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button className="btn btn-fantasma btn-icone" onClick={() => abrirEdicao(u)} title="Editar">
                        ✏️
                      </button>
                      <button className="btn btn-fantasma btn-icone" onClick={() => toggleAtivo(u)} title={u.ativo ? 'Desativar' : 'Reativar'}>
                        {u.ativo ? '🚫' : '✅'}
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
              <span>{editando ? '✏️ Editar Usuário' : '➕ Novo Usuário'}</span>
              <button className="btn btn-fantasma btn-icone" onClick={() => setMostrarForm(false)}>✕</button>
            </div>

            <div className="flex-col gap-lg">
              <div className="campo">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  className="input"
                  value={form.nome}
                  onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do usuário"
                  autoFocus
                />
              </div>

              <div className="form-grid">
                <div className="campo">
                  <label>Login *</label>
                  <input
                    type="text"
                    className="input"
                    value={form.login}
                    onChange={(e) => setForm(prev => ({ ...prev, login: e.target.value }))}
                    placeholder="login"
                  />
                </div>
                <div className="campo">
                  <label>Perfil *</label>
                  <select className="input" value={form.perfil} onChange={(e) => setForm(prev => ({ ...prev, perfil: e.target.value }))}>
                    <option value="operador">👤 Operador</option>
                    <option value="gerente">👑 Gerente</option>
                  </select>
                </div>
              </div>

              <div className="campo">
                <label>{editando ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                <input
                  type="password"
                  className="input"
                  value={form.senha}
                  onChange={(e) => setForm(prev => ({ ...prev, senha: e.target.value }))}
                  placeholder={editando ? 'Deixe vazio para manter a senha atual' : 'Mínimo 4 caracteres'}
                />
              </div>
            </div>

            <div className="modal-acoes">
              <button className="btn btn-secundario" onClick={() => setMostrarForm(false)}>Cancelar</button>
              <button className="btn btn-primario" onClick={salvar}>
                {editando ? 'Salvar Alterações' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
