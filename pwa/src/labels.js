/**
 * Traducao de rotulos do modelo para pt-BR, e agregacao binaria.
 *
 * Modulo puro: sem DOM, sem TF.js, sem I/O (sdd.md §6.2).
 *
 * O rotulo exportado pelo Teachable Machine contem um erro de digitacao
 * ("Cerscospora") enquanto o dataset usa "Cercospora" (sdd.md R-01). Em vez de
 * indexar posicionalmente por um indice fixo, comparamos a chave canonica.
 */

/**
 * Alias de rotulos do modelo -> chave canonica.
 *
 * `canon()` normaliza caixa e acentos, mas nao conserta transposicao de letras:
 * 'Cerscospora'.toLowerCase() = 'cerscospora' != 'cercospora'. Por isso o erro de
 * digitacao exportado pelo Teachable Machine (sdd.md R-01) precisa de um alias
 * explicito.
 *
 * Ao reexportar o modelo, confira metadata.json e acrescente a entrada aqui.
 */
const ALIASES = Object.freeze({
  cerscospora: 'cercospora',
});

/**
 * Normaliza um rotulo para comparacao: minusculas, sem acentos, apenas letras,
 * e por fim aplica os aliases conhecidos.
 * @param {string} label
 * @returns {string}
 */
export function canon(label) {
  const base = String(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacriticos
    .replace(/[^a-z]/g, '');
  return ALIASES[base] ?? base;
}

/** Chave canonica -> rotulo exibido em pt-BR (sdd.md §2.2). */
export const GLOSSARIO = Object.freeze({
  cercospora: 'Cercosporiose',
  healthy: 'Saudável',
  miner: 'Minador',
  phoma: 'Phoma',
  rust: 'Ferrugem',
});

/** Chaves canonicas da categoria binaria "Doente" (Readme.md §2.4). */
const DOENTES = new Set(['miner', 'rust', 'phoma', 'cercospora']);

/**
 * Converte um rotulo do modelo no rotulo de exibicao.
 * Fallback deliberado (sdd.md R-05): rotulo desconhecido e exibido como veio,
 * nunca como "undefined".
 * @param {string} label
 * @returns {string}
 */
export function exibir(label) {
  const chave = canon(label);
  const pt = GLOSSARIO[chave];
  if (pt) return pt;
  console.warn(`[labels] Rotulo desconhecido no modelo: "${label}" (chave "${chave}")`);
  return String(label);
}

/**
 * Categoria binaria de um rotulo do modelo.
 * @param {string} label
 * @returns {'saudavel'|'doente'}
 */
export function categoriaBinaria(label) {
  return DOENTES.has(canon(label)) ? 'doente' : 'saudavel';
}

/** Rotulos de exibicao das duas categorias binarias. */
export const ROTULO_BINARIO = Object.freeze({
  saudavel: 'Saudável',
  doente: 'Doente',
});

/**
 * Monta as duas visoes de um resultado a partir das probabilidades multiclasse.
 *
 * @param {string[]} labels  rotulos do modelo, na ordem de saida da rede
 * @param {Float32Array|number[]} probs  probabilidade por classe
 * @param {'multiclass'|'binary'} mode
 * @returns {{
 *   mode: 'multiclass'|'binary',
 *   principal: { chave: string, rotulo: string, prob: number, indice: number },
 *   barras: Array<{ chave: string, rotulo: string, prob: number }>,
 *   detalhe: string|null
 * }}
 */
export function montarResultado(labels, probs, mode) {
  const multiclasse = labels.map((label, i) => ({
    chave: canon(label),
    rotulo: exibir(label),
    prob: Number(probs[i]) || 0,
    indice: i,
  }));

  // Empate e resolvido pelo indice da rede: determinismo entre execucoes.
  let vencedora = multiclasse[0];
  for (const p of multiclasse) if (p.prob > vencedora.prob) vencedora = p;

  if (mode !== 'binary') {
    return { mode, principal: vencedora, barras: multiclasse, detalhe: null };
  }

  const saudavel = multiclasse
    .filter((p) => categoriaBinaria(labels[p.indice]) === 'saudavel')
    .reduce((acc, p) => acc + p.prob, 0);
  const doente = Math.max(0, 1 - saudavel);
  // Empate vai para "Doente". Em triagem, um falso negativo (chamar de saudavel
  // uma folha doente) custa mais caro que um falso positivo (encaminhar para
  // inspecao sem necessidade). A faixa de confianca baixa dispara de todo modo,
  // ja que 0.5 < LOW_CONFIDENCE_THRESHOLD.
  const saudavelVence = saudavel > doente;

  return {
    mode,
    principal: {
      chave: saudavelVence ? 'saudavel' : 'doente',
      rotulo: saudavelVence ? ROTULO_BINARIO.saudavel : ROTULO_BINARIO.doente,
      prob: saudavelVence ? saudavel : doente,
      indice: -1,
    },
    barras: [
      { chave: 'saudavel', rotulo: ROTULO_BINARIO.saudavel, prob: saudavel },
      { chave: 'doente', rotulo: ROTULO_BINARIO.doente, prob: doente },
    ],
    // A classe multiclasse vencedora e sempre o melhor diagnostico disponivel,
    // mesmo quando a resposta principal e apenas "Saudavel"/"Doente".
    detalhe: vencedora.rotulo,
  };
}

/** Probabilidade como percentual com uma casa decimal. */
export function pct(prob) {
  return (Math.max(0, Math.min(1, Number(prob) || 0)) * 100).toFixed(1);
}
