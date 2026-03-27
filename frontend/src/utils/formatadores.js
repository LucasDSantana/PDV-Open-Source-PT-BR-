/**
 * Formata número como moeda brasileira (R$)
 */
export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

/**
 * Formata data/hora para exibição
 */
export function formatarDataHora(dataStr) {
  if (!dataStr) return '-';
  const data = new Date(dataStr);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

/**
 * Formata data para input date
 */
export function formatarDataInput(data) {
  if (!data) return '';
  const d = new Date(data);
  return d.toISOString().split('T')[0];
}

/**
 * Mapa de formas de pagamento para exibição
 */
export const FORMAS_PAGAMENTO = {
  dinheiro: { nome: 'Dinheiro', icone: '💵' },
  cartao_debito: { nome: 'Cartão Débito', icone: '💳' },
  cartao_credito: { nome: 'Cartão Crédito', icone: '💳' },
  pix: { nome: 'PIX', icone: '📱' },
};

/**
 * Retorna data de hoje no formato ISO (YYYY-MM-DD)
 */
export function hojeISO() {
  return new Date().toISOString().split('T')[0];
}
