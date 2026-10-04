/**
 * Carregamento e inferencia do modelo (sdd.md §3.2, §4, §10).
 *
 * Singleton: o modelo e baixado uma unica vez por sessao e reutilizado em todas
 * as analises. `predict` nao altera estado.
 */

import * as tf from '@tensorflow/tfjs';
import { MODEL_URL, METADATA_URL, IMAGE_SIZE } from './config.js';
import { blobParaTensor, desenharRecortado, canvasParaTensor, descartar } from './preprocess.js';

/** @type {tf.LayersModel|null} */
let modelo = null;
/** @type {string[]} */
let rotulos = [];
let carregando = null;

/**
 * Seleciona o melhor backend disponivel. WebGL e ~10x mais rapido que CPU e e
 * o caminho esperado em dispositivos moveis (sdd.md §10).
 * @returns {string} nome do backend ativo
 */
export function configurarBackend() {
  try {
    tf.setBackend('webgl');
  } catch {
    /* webgl indisponivel: mantem o padrao (cpu) */
  }
  if (!tf.getBackend()) tf.setBackend('cpu');
  return tf.getBackend();
}

/** @returns {boolean} */
export function pronto() {
  return modelo !== null;
}

/** @returns {string[]} rotulos do modelo, na ordem de saida da rede */
export function rotulosDoModelo() {
  return rotulos;
}

/** @returns {string} backend ativo, para diagnostico na UI */
export function backend() {
  return tf.getBackend();
}

/**
 * Le metadata.json e valida o contrato declarado do modelo.
 * @returns {Promise<{labels: string[], imageSize: number}>}
 */
async function carregarMetadata() {
  const resposta = await fetch(METADATA_URL);
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar metadata.json (HTTP ${resposta.status})`);
  }
  const meta = await resposta.json();
  if (!Array.isArray(meta.labels) || meta.labels.length === 0) {
    throw new Error('metadata.json sem a lista de rotulos');
  }
  if (meta.imageSize && meta.imageSize !== IMAGE_SIZE) {
    console.warn(
      `[classifier] metadata.imageSize=${meta.imageSize} difere de IMAGE_SIZE=${IMAGE_SIZE}`
    );
  }
  return meta;
}

/**
 * Baixa e carrega o modelo. Chamadas concorrentes compartilham a mesma Promise;
 * o progresso e reportado apenas a primeira.
 *
 * @param {(fracao: number) => void} [onProgress]  fracao 0..1
 * @returns {Promise<tf.LayersModel>}
 */
export function carregar(onProgress) {
  if (modelo) return Promise.resolve(modelo);
  if (carregando) return carregando;

  carregando = (async () => {
    const meta = await carregarMetadata();
    const net = await tf.loadLayersModel(MODEL_URL, { onProgress });

    // Validacao do contrato (sdd.md §4). Falhar aqui e melhor que
    // devolver previsoes silenciosamente invalidas.
    const esperado = [null, IMAGE_SIZE, IMAGE_SIZE, 3];
    const entrada = net.inputs[0];
    if (!entrada || entrada.shape.length !== 4) {
      throw new Error(`Entrada do modelo inesperada: ${JSON.stringify(entrada?.shape)}`);
    }
    for (let i = 1; i < 4; i++) {
      if (entrada.shape[i] !== esperado[i]) {
        throw new Error(
          `Entrada do modelo ${JSON.stringify(entrada.shape)} != [1,${IMAGE_SIZE},${IMAGE_SIZE},3]. ` +
            'O pre-processamento e a constante IMAGE_SIZE precisam ser revistos.'
        );
      }
    }
    const saida = net.outputs[0];
    if (!saida || saida.shape[saida.shape.length - 1] !== meta.labels.length) {
      throw new Error(
        `Saida do modelo com ${saida?.shape?.at(-1)} neuronios, mas metadata declara ` +
          `${meta.labels.length} rotulos.`
      );
    }

    modelo = net;
    rotulos = meta.labels;
    // Aquece o backend: a primeira inferencia paga o custo de compilacao do shader.
    await tf.tidy(async () => {
      await net.predict(tf.zeros([1, IMAGE_SIZE, IMAGE_SIZE, 3])).data();
    });
    return net;
  })();

  carregando.catch(() => {
    carregando = null;
  });
  return carregando;
}

/**
 * Executa a inferencia sobre um tensor ja pre-processado.
 * Libera entrada e saida ao final (sdd.md §5.4 / R-04).
 *
 * @param {tf.Tensor4D} entrada
 * @returns {Promise<{labels: string[], probs: Float32Array, ms: number}>}
 */
export async function classificarTensor(entrada) {
  if (!modelo) throw new Error('Modelo nao carregado');
  const t0 = performance.now();
  try {
    const saida = tf.tidy(() => modelo.predict(entrada));
    const probs = await saida.data();
    return {
      labels: rotulos,
      probs: new Float32Array(probs),
      ms: performance.now() - t0,
    };
  } finally {
    descartar(entrada);
  }
}

/**
 * Pipeline completo a partir de um Blob/File.
 * @param {Blob} blob
 * @returns {Promise<{labels: string[], probs: Float32Array, ms: number}>}
 */
export async function classificarBlob(blob) {
  if (!modelo) throw new Error('Modelo nao carregado');
  const entrada = await blobParaTensor(blob);
  return classificarTensor(entrada);
}

/**
 * Pipeline completo a partir de um frame de video ja posicionado.
 * @param {HTMLVideoElement} video
 * @returns {Promise<{labels: string[], probs: Float32Array, ms: number}>}
 */
export async function classificarVideo(video) {
  if (!modelo) throw new Error('Modelo nao carregado');
  const entrada = canvasParaTensor(
    desenharRecortado(video, video.videoWidth, video.videoHeight)
  );
  return classificarTensor(entrada);
}

/**
 * Libera o modelo e os tensores de backend. Usado em `beforeunload` e em HMR.
 */
export function dispose() {
  if (modelo) {
    modelo.dispose();
    modelo = null;
    rotulos = [];
    carregando = null;
  }
}
