import { useEffect, useCallback } from 'react';

/**
 * Hook de atalhos de teclado para o PDV.
 * Recebe um mapa de ações e registra listeners globais.
 * Previne o comportamento padrão das teclas de função.
 */
export function useAtalhos(acoes, dependencias = []) {
  const handler = useCallback((evento) => {
    const tecla = evento.key;

    // Ignora se estiver em um input/textarea (exceto teclas de função e ESC)
    const emInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(evento.target.tagName);
    const teclaDeFuncao = tecla.startsWith('F') && tecla.length <= 3;
    const teclaEspecial = tecla === 'Escape';

    if (emInput && !teclaDeFuncao && !teclaEspecial) {
      return;
    }

    const acao = acoes[tecla];
    if (acao) {
      evento.preventDefault();
      evento.stopPropagation();
      acao(evento);
    }
  }, dependencias);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
