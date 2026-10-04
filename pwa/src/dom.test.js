/**
 * Verificacao de integridade entre o HTML e os seletores usados por ui.js.
 *
 * Um `#id` renomeado no HTML e um `document.querySelector` que devolve null:
 * o moduloLan\u00e7aria no import de ui.js, antes de qualquer render. Este teste
 * cobre a classe de erro sem precisar de navegador.
 *
 * Execucao: node --test src/dom.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (...p) => readFileSync(join(RAIZ, ...p), 'utf8');
const html = ler('index.html');
const ui = ler('src', 'ui.js');
const toast = ler('src', 'toast.js');
const main = ler('src', 'main.js');
const css = ler('src', 'styles.css');
const sw = ler('vite.config.js');

/** IDs declarados no HTML. */
const idsNoHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

/** IDs requeridos por ui.js via $('#...'). */
const idsNoUi = [...ui.matchAll(/\$\('#([a-z-]+)'\)/g)].map((m) => m[1]);

test('todo seletor #id de ui.js existe no index.html', () => {
  const faltando = idsNoUi.filter((id) => !idsNoHtml.has(id));
  assert.deepEqual(faltando, [], `IDs ausentes no HTML: ${faltando.join(', ')}`);
});

test('ui.js requer pelo menos os IDs criticos', () => {
  for (const id of [
    'video',
    'imagem',
    'btn-camera',
    'btn-enviar',
    'arquivo',
    'btn-analisar',
    'btn-reiniciar',
    'resultado',
    'barras',
    'status',
  ]) {
    assert.ok(idsNoUi.includes(id), `ui.js deveria requerer #${id}`);
    assert.ok(idsNoHtml.has(id), `index.html deveria ter #${id}`);
  }
});

test('erros e alertas sao toast, nao bloco inline (sdd.md §6.5)', () => {
  // O bloco inline ficava abaixo da dobra em celular: o usuario tocava em
  // "Usar camera" e nao entendia o que acontecia.
  assert.ok(idsNoHtml.has('toasts'), 'container #toasts deve existir');
  assert.match(html, /id="toasts"/);
  // a classe e montada por template literal em toast.js; o papel vive no mapa
  assert.match(toast, /erro:\s*\{\s*role:\s*'alert'/, 'toast.js precisa do papel erro/assertivo');
  assert.match(css, /\.toast-erro/, 'o estilo do toast de erro precisa existir');

  // Nenhum bloco de erro inline remanescente
  assert.doesNotMatch(html, /id="erro"/, 'bloco #erro inline deve ter sido removido');
  assert.doesNotMatch(ui, /mostrarErro|esconderErro/, 'ui.js nao deve renderizar erros');
  assert.match(css, /\.toasts\s*\{[^}]*position:\s*fixed/, 'toast precisa ser fixo');

  // main.js precisa efetivamente usar o toast
  assert.match(main, /import \* as toast from '\.\/toast\.js'/);
  assert.match(main, /toast\.erro\(/, 'erros de camera/analise devem virar toast');
});

test('erros e avisos do toast sao acessiveis', () => {
  assert.match(toast, /role:\s*'alert'/, 'erro usa role=alert (assertivo)');
  assert.match(toast, /role:\s*'status'/, 'aviso/info usam role=status');
  assert.match(toast, /aria-label/, 'o botao de fechar precisa de nome acessivel');
  // S-2: apenas atribuicao real de innerHTML e proibida (comentarios ok)
  assert.doesNotMatch(
    toast,
    /\.innerHTML\s*(\+)?=/,
    'S-2: nunca atribuir innerHTML; use textContent'
  );
  assert.match(toast, /\.textContent\s*=/, 'as mensagens devem usar textContent');
});

test('o aviso de nova versao foi removido', () => {
  assert.doesNotMatch(html, /aviso-atualizacao/, 'bloco de update deve ter sido removido');
  assert.doesNotMatch(html, /nova versão do aplicativo/i);
  assert.doesNotMatch(ui, /oferecerAtualizacao/);
  assert.doesNotMatch(main, /oferecerAtualizacao|updatefound/);
});

test('o reset de [hidden] existe no CSS (bug das faixas sempre visiveis)', () => {
  assert.match(
    css,
    /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/,
    'sem o reset, .faixa{display:flex} vence o [hidden] do user-agent'
  );
});

test('o link do dataset aponta para o PMC', () => {
  assert.match(html, /https:\/\/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC8165403\//);
  assert.doesNotMatch(html, /sciencedirect\.com/);
});

test('o aviso agronomico exigido pelo Readme.md §3 esta no HTML', () => {
  assert.match(html, /não\s* substitui/i, 'falta o aviso de que nao substitui profissional');
  assert.match(html, /Confiança do modelo/);
});

test('os radios de modo existem e o primeiro vem checked', () => {
  const radios = [...html.matchAll(/<input[^>]*name="modo"[^>]*>/g)].map((m) => m[0]);
  assert.equal(radios.length, 2, 'esperados 2 radios de modo');
  assert.match(radios[0], /value="multiclass"/);
  assert.match(radios[0], /checked/, 'multiclass deve ser o modo inicial');
  assert.match(radios[1], /value="binary"/);
});

test('o video tem playsinline e muted (sdd.md C-2, iOS Safari)', () => {
  const tag = html.match(/<video[^>]*>/)[0];
  assert.match(tag, /playsinline/);
  assert.match(tag, /muted/);
});

test('CSP presente e sem CDN (sdd.md §9)', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([\s\S]*?)"/);
  assert.ok(csp, 'meta CSP ausente');
  const politica = csp[1].replace(/\s+/g, ' ').trim();
  assert.match(politica, /default-src 'self'/);
  assert.match(politica, /connect-src 'self'/);
  assert.match(politica, /img-src 'self' data: blob:/);
  assert.match(politica, /object-src 'none'/);
  assert.doesNotMatch(politica, /unsafe-eval/, 'unsafe-eval nao deve ser permitido');
  assert.doesNotMatch(html, /https?:\/\/(cdn|unpkg|jsdelivr)/, 'nenhum CDN externo');
});

test('o service worker nao forca skipWaiting automatico (sdd.md P-1)', () => {
  assert.match(sw, /skipWaiting:\s*false/);
  assert.match(sw, /cleanupOutdatedCaches:\s*true/);
  assert.match(sw, /purpose:\s*'maskable'/, 'icone maskable obrigatorio');
});

test('o modelo esta no precache do workbox', () => {
  assert.match(sw, /bin/);
  assert.match(
    sw,
    /maximumFileSizeToCacheInBytes:\s*6 \* 1024 \* 1024/,
    'o limite deve comportar o weights.bin (2,2 MB)'
  );
});
