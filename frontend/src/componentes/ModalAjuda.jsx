/**
 * ModalAjuda - Exibe a lista de atalhos de teclado do PDV
 */
export default function ModalAjuda({ aberto, aoFechar }) {
  if (!aberto) return null;

  const atalhos = [
    { tecla: 'F1', descricao: 'Abrir esta ajuda' },
    { tecla: 'F2', descricao: 'Focar na busca de produtos' },
    { tecla: 'F3', descricao: 'Adicionar produto manualmente' },
    { tecla: 'F4', descricao: 'Ir para pagamento' },
    { tecla: 'F5', descricao: 'Atualizar tela' },
    { tecla: 'F6', descricao: 'Aplicar desconto' },
    { tecla: 'F7', descricao: 'Remover item selecionado' },
    { tecla: 'F8', descricao: 'Cancelar venda' },
    { tecla: 'F9', descricao: 'Finalizar venda' },
    { tecla: 'ESC', descricao: 'Voltar / Fechar modal' },
    { tecla: 'ENTER', descricao: 'Confirmar ação' },
    { tecla: '↑ / ↓', descricao: 'Navegar nos resultados' },
  ];

  return (
    <div className="modal-overlay" onClick={aoFechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-titulo">
          <span>⌨️ Atalhos de Teclado</span>
          <button className="btn btn-fantasma btn-icone" onClick={aoFechar}>✕</button>
        </div>
        <div className="ajuda-grid">
          {atalhos.map(({ tecla, descricao }) => (
            <div key={tecla} style={{ display: 'contents' }}>
              <span className="tecla" style={{ justifySelf: 'end' }}>{tecla}</span>
              <span>{descricao}</span>
            </div>
          ))}
        </div>
        <div className="modal-acoes">
          <button className="btn btn-secundario" onClick={aoFechar}>
            Fechar <span className="tecla" style={{ marginLeft: '4px' }}>ESC</span>
          </button>
        </div>
      </div>
    </div>
  );
}
