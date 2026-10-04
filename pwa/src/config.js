/**
 * Constantes da aplicacao.
 * Fonte unica de verdade para tudo que deriva do contrato do modelo (sdd.md §4).
 */

/** Entrada do modelo: [1, 224, 224, 3]. Vem de metadata.json.imageSize. */
export const IMAGE_SIZE = 224;

/** Caminho dos artefatos exportados do Teachable Machine (copiados para public/). */
export const MODEL_URL = 'model/model.json';
export const METADATA_URL = 'model/metadata.json';

/**
 * Abaixo deste valor a previsao e marcada como pouco confiavel (sdd.md §6.3).
 * A rede nao e calibrada, entao o corte e apenas uma heuristica de UX.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Modo inicial: 'multiclass' | 'binary' (sdd.md §2.2). */
export const DEFAULT_MODE = 'multiclass';

/** Tipos aceitos no upload (sdd.md S-5). */
export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
  'image/heic',
  'image/heif',
];
