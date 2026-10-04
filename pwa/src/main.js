/**
 * Orquestracao da aplicacao (sdd.md §3.2, §3.3).
 *
 * Une os modulos e detem o controle do fluxo: midia -> analise -> resultado.
 * Nenhum outro modulo importa este arquivo.
 */

import './styles.css';
import { DEFAULT_MODE, ACCEPTED_IMAGE_TYPES } from './config.js';
import { montarResultado } from './labels.js';
import * as camera from './camera.js';
import * as classificador from './classifier.js';
import * as toast from './toast.js';
import * as ui from './ui.js';

/** @type {Blob|null} imagem pronta para analise */
let imagemAtual = null;
/** @type {string|null} URL de preview, revogada ao trocar de imagem (R-04) */
let previewUrl = null;
/** @type {'multiclass'|'binary'} */
let modo = DEFAULT_MODE;
/** Impede cliques duplicados em "Analisar". */
let analisando = false;
/** Ultimo resultado cru, para re-renderizar ao trocar de modo sem inferir de novo. */
let ultimoResultado = null;
/** Evento de instalacao retido pelo navegador. */
let eventoPrompt = null;

/** @returns {boolean} existe material para analisar */
function temImagem() {
  return Boolean(imagemAtual) || camera.ativa();
}

// ---------------------------------------------------------------------------
// Midia
// ---------------------------------------------------------------------------

/** Revoga a URL de preview anterior para nao vazar Blob. */
function limparPreview() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

/**
 * Decodifica a imagem visivel, resolvendo quando ela esta pronta para o frame.
 * @param {HTMLImageElement} img
 * @returns {Promise<void>}
 */
function decodeImage(img) {
  return img.decode ? img.decode() : new Promise((r) => { img.onload = r; });
}

/**
 * Adota um Blob como imagem corrente e mostra o preview.
 * @param {Blob} blob
 * @returns {Promise<void>}
 */
async function adotarImagem(blob) {
  const tipo = blob.type || '';
  if (tipo && !ACCEPTED_IMAGE_TYPES.includes(tipo)) {
    throw new Error(`Formato de imagem nao suportado: ${tipo}`);
  }

  limparPreview();
  previewUrl = URL.createObjectURL(blob);

  ui.els.imagem.src = previewUrl;
  ui.definirMidia('imagem');

  // `decode()` valida a imagem antes de a exibir: um arquivo corrompido falharia
  // depois, no meio da inferencia.
  try {
    await decodeImage(ui.els.imagem);
  } catch {
    limparPreview();
    ui.els.imagem.removeAttribute('src');
    throw new Error('O arquivo selecionado nao e uma imagem valida.');
  }

  imagemAtual = blob;
  ui.resultado.hidden = true;
  ui.definirEstado('idle', { temImagem: true });
}

// ---------------------------------------------------------------------------
// Analise
// ---------------------------------------------------------------------------

/**
 * Garante o modelo carregado, reportando progresso. `loadLayersModel` expoe
 * `onProgress` (sdd.md §10), evitando um download paralelo so para a barra.
 */
async function garantirModelo() {
  if (classificador.pronto()) return;
  ui.definirEstado('loading', { temImagem: temImagem(), mensagem: 'Carregando modelo…' });
  await classificador.carregar((fracao) => ui.progresso(fracao));
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function aoUsarCamera() {
  if (ui.contextoInseguro()) {
    // Toast, e nao texto no rodape: o usuario precisa ver sem rolar a pagina.
    toast.erro(
      'Conexão não segura',
      'A câmera exige HTTPS (ou localhost). Abra a aplicação por um endereço seguro, ' +
        'ou envie uma imagem pelo botão "Enviar imagem".'
    );
    ui.definirEstado('error', { temImagem: temImagem() });
    return;
  }

  try {
    ui.definirEstado('loading', { temImagem: temImagem(), mensagem: 'Abrindo a câmera…' });
    await camera.start(ui.els.video);
    ui.definirMidia('camera');
    ui.definirEstado('idle', { temImagem: true });
    ui.els.status.textContent =
      'Câmera ativa. Enquadre a folha e toque em "Analisar folha".';
  } catch (erro) {
    const { titulo, texto } = camera.explicarErro(erro);
    toast.erro(titulo, texto);
    ui.definirMidia(imagemAtual ? 'imagem' : 'vazio');
    ui.definirEstado('error', { temImagem: temImagem() });
  }
}

async function aoEnviarArquivo(evento) {
  const arquivo = evento.target.files?.[0];
  evento.target.value = ''; // permite reenviar o mesmo arquivo
  if (!arquivo) return;

  try {
    camera.stop();
    await adotarImagem(arquivo);
    ui.els.status.textContent = 'Imagem carregada. Toque em "Analisar folha".';
  } catch (erro) {
    toast.erro('Não foi possível carregar a imagem', erro.message);
    ui.definirEstado('error', { temImagem: false });
  }
}

async function aoAnalisar() {
  if (analisando || !temImagem()) return;
  analisando = true;

  try {
    await garantirModelo();

    ui.definirEstado('classifying', { temImagem: true });

    // Imagem enviada tem precedencia: e uma foto ja enquadrada pelo usuario.
    const saida = imagemAtual
      ? await classificador.classificarBlob(imagemAtual)
      : await classificador.classificarVideo(ui.els.video);

    ultimoResultado = saida;

    // O resultado e apenas exibido; nenhum pixel sai do dispositivo (S-1).
    ui.mostrarResultado(montarResultado(saida.labels, saida.probs, modo), saida.ms);
    ui.definirEstado('result', { temImagem: true });
  } catch (erro) {
    console.error('[main] Falha na analise', erro);
    toast.erro('Falha na análise', erro.message || 'Erro desconhecido.');
    ui.definirEstado('error', { temImagem: temImagem() });
  } finally {
    analisando = false;
  }
}

function aoReiniciar() {
  camera.stop();
  imagemAtual = null;
  ultimoResultado = null;
  limparPreview();
  ui.els.imagem.removeAttribute('src');
  ui.resultado.hidden = true;
  ui.definirMidia('vazio');
  ui.definirEstado('idle', { temImagem: false });
  ui.els.status.textContent = 'Pronto para uma nova análise.';
}

function aoMudarModo(evento) {
  modo = evento.target.value === 'binary' ? 'binary' : 'multiclass';
  // T-27: re-renderiza sem nova inferencia.
  if (ui.els.body.dataset.state === 'result' && ultimoResultado) {
    ui.mostrarResultado(
      montarResultado(ultimoResultado.labels, ultimoResultado.probs, modo),
      ultimoResultado.ms
    );
  }
}

// ---------------------------------------------------------------------------
// Service worker / instalacao
// ---------------------------------------------------------------------------

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) {
    console.info('[main] Modo dev: service worker gerado apenas no build.');
    return;
  }
  navigator.serviceWorker.register('sw.js').catch((erro) => {
    console.warn('[main] Service worker nao registrado', erro);
  });
}

function observarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (evento) => {
    if (evento.data?.type === 'SKIP_WAITING') window.location.reload();
  });
}

function observarInstalacao() {
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    eventoPrompt = evento;
    ui.oferecerInstalacao(async () => {
      await eventoPrompt.prompt();
      await eventoPrompt.userChoice;
      eventoPrompt = null;
      ui.els.installBtn.hidden = true;
    });
  });

  window.addEventListener('appinstalled', () => {
    eventoPrompt = null;
    ui.els.installBtn.hidden = true;
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function iniciar() {
  ui.els.btnCamera.addEventListener('click', aoUsarCamera);
  ui.els.btnEnviar.addEventListener('click', () => ui.els.inputArquivo.click());
  ui.els.inputArquivo.addEventListener('change', aoEnviarArquivo);
  ui.els.btnAnalisar.addEventListener('click', aoAnalisar);
  ui.els.btnReiniciar.addEventListener('click', aoReiniciar);
  ui.els.radiosModo.forEach((r) => r.addEventListener('change', aoMudarModo));

  // C-1: libera a camera ao sair da aba, para nao deixar o indicador aceso.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) camera.stop();
  });
  window.addEventListener('pagehide', () => {
    camera.stop();
    limparPreview();
  });

  ui.definirEstado('idle', { temImagem: false });
  ui.definirMidia('vazio');

  if (ui.contextoInseguro()) {
    // Aviso logo no boot: em acesso por IP LAN o usuario precisa saber disso
    // antes de tocar em "Usar camera" e receber um botao que nao faz nada.
    toast.aviso(
      'Conexão não segura',
      'A câmera e a instalação do aplicativo exigem HTTPS. Você pode usar ' +
        '"Enviar imagem" normalmente — a análise continua funcionando.'
    );
    ui.els.status.textContent =
      'Aviso: contexto não seguro. A câmera e a instalação exigem HTTPS.';
  } else {
    // Prefetch do modelo em segundo plano: nao bloqueia a interface e faz a
    // primeira analise parecer instantanea.
    classificador.carregar().then(
      () => {
        ui.els.diag.textContent = `Modelo pronto · backend ${classificador.backend()}`;
      },
      (erro) => console.warn('[main] Prefetch do modelo falhou', erro)
    );
  }

  registrarServiceWorker();
  observarServiceWorker();
  observarInstalacao();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar, { once: true });
} else {
  iniciar();
}
