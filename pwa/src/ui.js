/**
 * Render da interface (sdd.md §3.3, §6.3, §6.4).
 *
 * Este modulo nao conhece TF.js: recebe apenas descricoes de estado ja
 * calculadas por `main.js`.
 *
 * Mensagens de erro e alerta NAO sao renderizadas aqui: vao para `toast.js`,
 * porque o bloco inline ficava abaixo da dobra em telas de celular.
 */

import { pct } from './labels.js';
import { LOW_CONFIDENCE_THRESHOLD } from './config.js';

/**
 * @param {string} seletor
 * @returns {HTMLElement}
 */
function $(seletor) {
  const el = document.querySelector(seletor);
  if (!el) throw new Error(`Elemento ausente no HTML: ${seletor}`);
  return el;
}

/** Cache dos elementos referenciados pela UI. */
export const els = {
  body: document.body,
  video: $('#video'),
  imagem: $('#imagem'),
  guia: $('#guia'),
  areaMidia: $('#area-midia'),
  btnCamera: $('#btn-camera'),
  btnEnviar: $('#btn-enviar'),
  inputArquivo: $('#arquivo'),
  btnAnalisar: $('#btn-analisar'),
  btnReiniciar: $('#btn-reiniciar'),
  radiosModo: /** @type {NodeListOf<HTMLInputElement>} */ (
    document.querySelectorAll('input[name="modo"]')
  ),
  resultado: $('#resultado'),
  resultadoRotulo: $('#resultado-rotulo'),
  resultadoConfianca: $('#resultado-confianca'),
  resultadoDetalhe: $('#resultado-detalhe'),
  barras: $('#barras'),
  avisoConfianca: $('#aviso-confianca'),
  status: $('#status'),
  installBtn: $('#btn-instalar'),
  diag: $('#diag'),
};

/**
 * Regiao de resultado, exposta para `main.js` limpar entre analises.
 * @type {HTMLElement}
 */
export const resultado = els.resultado;

/**
 * Define a maquina de estados da tela (sdd.md §3.3).
 * @param {'idle'|'loading'|'classifying'|'result'|'error'} estado
 * @param {{temImagem?: boolean, progresso?: number|null, mensagem?: string}} opcoes
 */
export function definirEstado(estado, opcoes = {}) {
  els.body.dataset.state = estado;
  const ocupado = estado === 'loading' || estado === 'classifying';
  els.body.setAttribute('aria-busy', ocupado ? 'true' : 'false');

  const podeAnalisar = estado === 'idle' || estado === 'result' || estado === 'error';
  els.btnAnalisar.disabled = !podeAnalisar || !opcoes.temImagem;
  els.btnReiniciar.hidden = estado === 'idle';
  els.btnCamera.disabled = ocupado;
  els.btnEnviar.disabled = ocupado;

  // `loading` e compartilhado entre o download do modelo e a abertura da camera:
  // a mensagem precisa vir de quem chamou.
  if (opcoes.mensagem) {
    els.status.textContent = opcoes.mensagem;
  } else if (estado === 'loading') {
    els.status.textContent = 'Carregando…';
  } else if (estado === 'classifying') {
    els.status.textContent = 'Analisando a folha…';
  } else if (estado === 'result') {
    els.status.textContent = 'Análise concluída.';
  }
}

/**
 * Alterna entre preview de video e imagem ainda capturada.
 * @param {'camera'|'imagem'|'vazio'} origem
 */
export function definirMidia(origem) {
  els.body.dataset.midia = origem;
}

/**
 * Atualiza a barra de status de download do modelo.
 * @param {number} fracao  0..1
 */
export function progresso(fracao) {
  els.status.textContent = `Carregando modelo… ${Math.round(fracao * 100)}%`;
}

/**
 * Renderiza o resultado de uma classificacao.
 * @param {{principal: {rotulo: string, prob: number},
 *          barras: Array<{rotulo: string, prob: number}>,
 *          detalhe: string|null}} resultado
 * @param {number} ms  tempo de inferencia, exibido no diagnostico
 */
export function mostrarResultado(resultado, ms) {
  const { principal, barras, detalhe } = resultado;

  els.resultadoRotulo.textContent = principal.rotulo;
  els.resultadoConfianca.textContent = pct(principal.prob);

  els.resultadoDetalhe.hidden = !detalhe;
  if (detalhe) els.resultadoDetalhe.textContent = `Classe específica: ${detalhe}`;

  // S-2: rotulos do modelo nunca via innerHTML.
  els.barras.replaceChildren(
    ...barras.map((b) => {
      const item = document.createElement('li');
      item.className = 'barra';

      const nome = document.createElement('span');
      nome.className = 'barra-rotulo';
      nome.textContent = b.rotulo;

      const trilho = document.createElement('span');
      trilho.className = 'barra-trilho';
      const preenchimento = document.createElement('span');
      preenchimento.className = 'barra-preenchimento';
      preenchimento.style.width = `${pct(b.prob)}%`;
      trilho.append(preenchimento);

      const valor = document.createElement('span');
      valor.className = 'barra-valor';
      valor.textContent = pct(b.prob);

      item.append(nome, trilho, valor);
      return item;
    })
  );

  const baixa = principal.prob < LOW_CONFIDENCE_THRESHOLD;
  els.avisoConfianca.hidden = !baixa;
  els.avisoConfianca.textContent =
    'Confiança baixa — considere nova foto, com mais luz e a folha centralizada no quadro.';

  els.diag.textContent = `Inferência em ${ms.toFixed(0)} ms`;
  els.resultado.hidden = false;
}

/**
 * Mostra o botao de instalar quando o navegador oferece (sdd.md §8.3).
 * @param {() => void} aoInstalar
 */
export function oferecerInstalacao(aoInstalar) {
  els.installBtn.hidden = false;
  els.installBtn.addEventListener('click', aoInstalar, { once: true });
}

/**
 * Detecta contexto nao seguro, onde camera e service worker nao funcionam
 * (sdd.md P-4).
 * @returns {boolean}
 */
export function contextoInseguro() {
  return !window.isSecureContext;
}
