/**
 * Captura de imagem via camera do dispositivo (sdd.md §7).
 *
 * Contrato:
 *   start(video) -> MediaStream
 *   capture(video) -> Blob
 *   stop() -> void
 */

const ERROS = {
  NotAllowedError: {
    titulo: 'Permissão de câmera negada',
    texto:
      'O acesso à câmera foi bloqueado. Você pode liberar a permissão nas configurações ' +
      'do site, ou enviar uma foto pela opção "Enviar imagem".',
  },
  NotFoundError: {
    titulo: 'Nenhuma câmera encontrada',
    texto: 'Este dispositivo não expõe uma câmera. Use a opção "Enviar imagem".',
  },
  NotReadableError: {
    titulo: 'Câmera ocupada',
    texto:
      'Outro aplicativo está usando a câmera. Feche os demais aplicativos e tente de novo.',
  },
  OverconstrainedError: {
    titulo: 'Câmera incompatível',
    texto: 'Nenhuma câmera deste dispositivo atende aos requisitos. Use "Enviar imagem".',
  },
  SecurityError: {
    titulo: 'Contexto não seguro',
    texto:
      'O acesso à câmera exige HTTPS (ou localhost). Abra a aplicação por um endereço seguro.',
  },
};

/**
 * Traduz uma exceção de getUserMedia em mensagem acionavel.
 * @param {unknown} erro
 * @returns {{titulo: string, texto: string}}
 */
export function explicarErro(erro) {
  const nome = erro?.name || '';
  if (ERROS[nome]) return ERROS[nome];
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
    return {
      titulo: 'Câmera não suportada',
      texto:
        'Este navegador não expõe a API de câmera. Use a opção "Enviar imagem" ou ' +
        'acesse por um navegador compatível.',
    };
  }
  return {
    titulo: 'Falha ao acessar a câmera',
    texto: erro?.message || 'Erro desconhecido ao iniciar a câmera.',
  };
}

/** @type {MediaStream|null} */
let stream = null;

/** @returns {boolean} */
export function ativa() {
  return stream !== null;
}

/**
 * Liga a camera e vincula o stream ao elemento de video.
 *
 * `facingMode: 'environment'` e 'ideal', nao 'exact': desktops sem camera
 * traseira devem degradar para a frontal em vez de falhar (sdd.md C-3).
 *
 * @param {HTMLVideoElement} video
 * @returns {Promise<MediaStream>}
 */
export async function start(video) {
  // C-1: nunca acumular streams.
  stop();

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const erro = new Error('getUserMedia indisponível');
    erro.name = 'NotSupportedError';
    throw erro;
  }

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 1280 },
    },
    audio: false,
  });

  video.srcObject = stream;
  // C-2: sem estes atributos o iOS Safari nao reproduz o stream.
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => {
    /* autoplay bloqueado pelo navegador: o usuario interage antes disso */
  });
  return stream;
}

/**
 * Captura o frame atual do video como Blob JPEG.
 *
 * O recorte central quadrado e aplicado em `preprocess.desenharRecortado`,
 * usando videoWidth/videoHeight (C-4) e nao as dimensoes de layout.
 *
 * @param {HTMLVideoElement} video
 * @returns {Promise<Blob>}
 */
export async function capture(video) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) {
    const erro = new Error('Video sem dimensoes');
    erro.name = 'InvalidStateError';
    throw erro;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao codificar o frame'))),
      'image/jpeg',
      0.92
    );
  });
}

/**
 * Desliga a camera e libera todas as tracks (C-1).
 * @returns {void}
 */
export function stop() {
  if (!stream) return;
  for (const track of stream.getTracks()) track.stop();
  stream = null;
}
