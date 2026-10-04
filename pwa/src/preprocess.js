/**
 * Pre-processamento de imagem, equivalente ao do Teachable Machine (sdd.md §5).
 *
 * Contrato de entrada (sdd.md §4):
 *   Float32Array [224*224*3], layout [H][W][C], faixa [-1, +1] via x/127 - 1.
 *
 * A normalizacao e x/127 - 1, e nao x/255 (regra R-2). A ultima camada da rede
 * ja e softmax, portanto a saida nao recebe softmax novamente (regra R-1).
 */

import * as tf from '@tensorflow/tfjs';
import { IMAGE_SIZE } from './config.js';

/**
 * Cria um canvas 2D de 224x224, preferindo OffscreenCanvas quando disponivel
 * (evita main-thread jank em dispositivos moveis, sdd.md §5.3).
 * @returns {OffscreenCanvas|HTMLCanvasElement}
 */
function criarCanvas() {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(IMAGE_SIZE, IMAGE_SIZE);
  }
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  return canvas;
}

/**
 * Desenha a fonte em um canvas 224x224 aplicando o corte central quadrado.
 *
 * Equivale a `cropTo(image, 224)` de @teachablemachine/image:
 * a menor dimensao vira o quadrado, centralizado, escalado para 224.
 *
 * @param {CanvasImageSource} fonte  video, img, ImageBitmap ou canvas
 * @param {number} largura  largura real da fonte (videoWidth, não clientWidth)
 * @param {number} altura   altura real da fonte
 * @returns {OffscreenCanvas|HTMLCanvasElement}
 */
export function desenharRecortado(fonte, largura, altura) {
  const canvas = criarCanvas();
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  // Sem isso, areas transparentes do arquivo seriam lidas como preto.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);

  const corte = Math.min(largura, altura);
  const escala = IMAGE_SIZE / corte;
  const destinoW = largura * escala;
  const destinoH = altura * escala;
  const dx = (destinoW - IMAGE_SIZE) / 2;
  const dy = (destinoH - IMAGE_SIZE) / 2;

  ctx.drawImage(fonte, -dx, -dy, destinoW, destinoH);
  return canvas;
}

/**
 * Converte um canvas 224x224 ja recortado no tensor de entrada do modelo.
 * @param {OffscreenCanvas|HTMLCanvasElement} canvas
 * @returns {tf.Tensor4D} [1, 224, 224, 3] float32 em [-1, 1]
 */
export function canvasParaTensor(canvas) {
  return tf.tidy(() =>
    tf.browser
      .fromPixels(canvas, 3)
      .toFloat()
      .div(127)
      .sub(1)
      .expandDims(0)
  );
}

/**
 * Pipeline completo a partir de um Blob/File: corrige orientacao EXIF,
 * aplica o corte central e devolve o tensor do modelo.
 *
 * `imageOrientation: 'from-image'` e obrigatorio: sem isso o Safari iOS ignora
 * a orientacao EXIF e fotos deitadas sao processadas deitadas (sdd.md D-06).
 *
 * @param {Blob} blob
 * @returns {Promise<tf.Tensor4D>}
 */
export async function blobParaTensor(blob) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (erro) {
    // Safari antigo e alguns navegadores Android lancam em createImageBitmap
    // com opcoes; tentamos o caminho sem opcoes antes de desistir.
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      throw new Error(`Nao foi possivel decodificar a imagem: ${erro.message}`);
    }
  }

  try {
    const canvas = desenharRecortado(bitmap, bitmap.width, bitmap.height);
    return canvasParaTensor(canvas);
  } finally {
    bitmap.close?.();
  }
}

/**
 * Libera um tensor de entrada com seguranca.
 * @param {tf.Tensor|null|undefined} tensor
 */
export function descartar(tensor) {
  if (tensor && !tensor.isDisposed) tensor.dispose();
}
