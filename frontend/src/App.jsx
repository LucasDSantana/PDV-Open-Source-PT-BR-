import { useState, useEffect, useCallback } from 'react';
import Login from './paginas/Login';
import PDV from './paginas/PDV';
import Produtos from './paginas/Produtos';
import Relatorios from './paginas/Relatorios';
import Caixas from './paginas/Caixas';
import Usuarios from './paginas/Usuarios';
import { caixasAPI } from './servicos/api';
import './index.css';

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [pagina, setPagina] = useState('pdv');
  const [caixaAtivo, setCaixaAtivo] = useState(null);
  const [carregandoAuth, setCarregandoAuth] = useState(true);

  // ── Verificar sessão ao carregar ──
  useEffect(() => {
    const token = localStorage.getItem('pdv_token');
    const usuarioSalvo = localStorage.getItem('pdv_usuario');

    if (token && usuarioSalvo) {
      try {
        const u = JSON.parse(usuarioSalvo);
        setUsuario(u);
      } catch {
        localStorage.removeItem('pdv_token');
        localStorage.removeItem('pdv_usuario');
      }
    }
    setCarregandoAuth(false);
  }, []);

  // ── Carregar caixa ativo do operador ──
  const carregarCaixa = useCallback(async () => {
    if (!usuario) return;
    try {
      const caixa = await caixasAPI.meu();
      setCaixaAtivo(caixa);
    } catch (erro) {
      console.error('Erro ao buscar caixa:', erro);
    }
  }, [usuario]);

  useEffect(() => { carregarCaixa(); }, [carregarCaixa]);

  const aoLogar = (u) => {
    setUsuario(u);
    setPagina('pdv');
  };

  const logout = () => {
    localStorage.removeItem('pdv_token');
    localStorage.removeItem('pdv_usuario');
    setUsuario(null);
    setCaixaAtivo(null);
    setPagina('pdv');
  };

  const aoAtualizarCaixa = (caixa) => {
    setCaixaAtivo(caixa);
  };

  // ── Loading ──
  if (carregandoAuth) return null;

  // ── Login ──
  if (!usuario) return <Login aoLogar={aoLogar} />;

  // ── Definir páginas baseado no perfil ──
  const eGerente = usuario.perfil === 'gerente';

  const PAGINAS = {
    pdv: { nome: '🛒 PDV', componente: PDV },
    caixas: { nome: '💼 Caixas', componente: Caixas },
    produtos: { nome: '📦 Produtos', componente: Produtos },
    relatorios: { nome: '📊 Relatórios', componente: Relatorios },
    ...(eGerente ? { usuarios: { nome: '👥 Usuários', componente: Usuarios } } : {}),
  };

  const PaginaAtual = PAGINAS[pagina]?.componente || PDV;

  // ── Props para o PDV ──
  const propsExtras = {};
  if (pagina === 'pdv') {
    propsExtras.usuario = usuario;
    propsExtras.caixaAtivo = caixaAtivo;
  }
  if (pagina === 'caixas') {
    propsExtras.usuario = usuario;
    propsExtras.caixaAtivo = caixaAtivo;
    propsExtras.aoAtualizarCaixa = aoAtualizarCaixa;
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">⚡ PDV</div>

        <nav className="sidebar-nav">
          {Object.entries(PAGINAS).map(([chave, info]) => (
            <button
              key={chave}
              className={`sidebar-link ${pagina === chave ? 'ativo' : ''}`}
              onClick={() => setPagina(chave)}
            >
              {info.nome}
            </button>
          ))}
        </nav>

        {/* Caixa ativo */}
        {caixaAtivo && (
          <div className="sidebar-caixa">
            <span className="sidebar-caixa-status">🟢</span>
            <span>{caixaAtivo.nome}</span>
          </div>
        )}

        {/* Usuário logado */}
        <div className="sidebar-usuario">
          <div className="sidebar-usuario-info">
            <span className="sidebar-usuario-nome">{usuario.nome}</span>
            <span className="sidebar-usuario-perfil">
              {usuario.perfil === 'gerente' ? '👑 Gerente' : '👤 Operador'}
            </span>
          </div>
          <button className="btn btn-fantasma btn-icone" onClick={logout} title="Sair">
            🚪
          </button>
        </div>

        <div className="sidebar-info">
          PDV Open Source v2.0
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="conteudo">
        <PaginaAtual {...propsExtras} />
      </main>
    </div>
  );
}
