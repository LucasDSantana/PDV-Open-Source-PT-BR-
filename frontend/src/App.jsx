import { useState } from 'react';
import PDV from './paginas/PDV';
import Produtos from './paginas/Produtos';
import Relatorios from './paginas/Relatorios';
import './index.css';

const PAGINAS = {
  pdv: { nome: '🛒 PDV', componente: PDV },
  produtos: { nome: '📦 Produtos', componente: Produtos },
  relatorios: { nome: '📊 Relatórios', componente: Relatorios },
};

export default function App() {
  const [pagina, setPagina] = useState('pdv');
  const PaginaAtual = PAGINAS[pagina].componente;

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
        <div className="sidebar-info">
          PDV Open Source v1.0
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="conteudo">
        <PaginaAtual />
      </main>
    </div>
  );
}
