/**
 * Toasts: mensagens transitorias de erro, aviso e informacao (sdd.md §6.5).
 *
 * Motivo: o bloco de erro ficava no rodape da segunda section, abaixo da dobra
 * em telas de celular. O usuario via um botao que nao fez nada e nao sabia
 * porque. Toast e posicionado fixo no topo e nao depende de rolagem.
 *
 * Acessibilidade (sdd.md §6.4):
 *   - `role="alert"` (assertivo) para erro; `role="status"` para os demais;
 *   - botao de fechar focusavel, para nao depender do auto-dismiss;
 *   - `prefers-reduced-motion` desliga a animacao (via CSS).
 */

/** @type {'erro'|'aviso'|'info'} */
const PAPEIS = {
  erro: { role: 'alert', duracao: 9000, prefixo: 'Erro' },
  aviso: { role: 'status', duracao: 7000, prefixo: 'Atenção' },
  info: { role: 'status', duracao: 4500, prefixo: '' },
};

let pilha = null;

/**
 * @returns {HTMLElement} container de toasts, criado sob demanda
 */
function container() {
  if (!pilha) {
    pilha = document.getElementById('toasts');
    if (!pilha) throw new Error('Elemento ausente no HTML: #toasts');
  }
  return pilha;
}

/**
 * Exibe um toast.
 *
 * @param {object} opts
 * @param {'erro'|'aviso'|'info'} [opts.tipo]
 * @param {string} opts.titulo   linha principal
 * @param {string} [opts.texto]  linha de detalhe
 * @param {number} [opts.duracao] ms; 0 mantém até o usuário fechar
 * @returns {{fechar: () => void}}
 */
export function mostrar({ tipo = 'info', titulo, texto = '', duracao } = {}) {
  const papel = PAPEIS[tipo] ?? PAPEIS.info;
  const vida = duracao ?? papel.duracao;

  const item = document.createElement('div');
  item.className = `toast toast-${tipo}`;
  item.setAttribute('role', papel.role);

  const conteudo = document.createElement('div');
  conteudo.className = 'toast-conteudo';

  if (papel.prefixo) {
    const marca = document.createElement('span');
    marca.className = 'toast-prefixo';
    marca.textContent = papel.prefixo;
    conteudo.append(marca);
  }

  // S-2: rotulos e mensagens via textContent, nunca innerHTML.
  const forte = document.createElement('strong');
  forte.textContent = titulo;
  conteudo.append(forte);

  if (texto) {
    const paragrafo = document.createElement('span');
    paragrafo.textContent = texto;
    conteudo.append(paragrafo);
  }

  const fechar = () => {
    clearTimeout(timer);
    item.classList.add('toast-saindo');
    item.addEventListener('animationend', () => item.remove(), { once: true });
    // Rede de seguranca caso animationend nao dispare (reduced motion).
    setTimeout(() => item.remove(), 400);
  };

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'toast-fechar';
  botao.setAttribute('aria-label', 'Fechar mensagem');
  botao.textContent = '×';
  botao.addEventListener('click', fechar);

  item.append(conteudo, botao);
  container().append(item);

  // Erros nunca somem sozinhos se o usuario estiver lendo devagar? Nao: 9s com
  // botao de fechar e o meio-termo. `titulo` vazio nunca acontece.
  const timer = vida > 0 ? setTimeout(fechar, vida) : null;

  return { fechar };
}

/**
 * @param {string} titulo
 * @param {string} [texto]
 * @returns {{fechar: () => void}}
 */
export const erro = (titulo, texto) => mostrar({ tipo: 'erro', titulo, texto });

/**
 * @param {string} titulo
 * @param {string} [texto]
 * @returns {{fechar: () => void}}
 */
export const aviso = (titulo, texto) => mostrar({ tipo: 'aviso', titulo, texto });

/**
 * @param {string} titulo
 * @param {string} [texto]
 * @returns {{fechar: () => void}}
 */
export const info = (titulo, texto) => mostrar({ tipo: 'info', titulo, texto });

/**
 * Evita empilhar o mesmo aviso repetidamente (o usuario pode tocar em "Usar
 * camera" varias vezes seguidas).
 * @returns {void}
 */
export function limparTodos() {
  if (pilha) pilha.replaceChildren();
}
