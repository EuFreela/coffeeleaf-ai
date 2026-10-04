/**
 * Testes da logica pura de rotulos (sdd.md §6.2, R-01, R-05, T-27).
 * Execucao: node --test src/labels.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canon, exibir, categoriaBinaria, montarResultado, pct } from './labels.js';

// ordem real de metadata.json
const LABELS = ['Cerscospora', 'Healthy', 'Miner', 'Phoma', 'Rust'];

test('canon corrige o erro de digitacao do modelo (R-01)', () => {
  assert.equal(canon('Cerscospora'), 'cercospora');
  assert.equal(canon('Cercospora'), 'cercospora');
  assert.equal(canon('rust'), 'rust');
  assert.equal(canon('Healthy'), 'healthy');
});

test('exibir traduz para pt-BR e nunca devolve undefined (R-05)', () => {
  assert.equal(exibir('Cerscospora'), 'Cercosporiose');
  assert.equal(exibir('Healthy'), 'Saudável');
  assert.equal(exibir('Miner'), 'Minador');
  assert.equal(exibir('Phoma'), 'Phoma');
  assert.equal(exibir('Rust'), 'Ferrugem');
  // rotulo desconhecido: fallback para o original, nao undefined
  assert.equal(exibir('Mancha'), 'Mancha');
});

test('categoriaBinaria segue Readme.md §2.4', () => {
  assert.equal(categoriaBinaria('Healthy'), 'saudavel');
  assert.equal(categoriaBinaria('Cerscospora'), 'doente');
  assert.equal(categoriaBinaria('Miner'), 'doente');
  assert.equal(categoriaBinaria('Phoma'), 'doente');
  assert.equal(categoriaBinaria('Rust'), 'doente');
});

test('modo multiclasse: bars mantem a ordem do modelo (T-27)', () => {
  const probs = new Float32Array([0.02, 0.01, 0.03, 0.03, 0.91]);
  const r = montarResultado(LABELS, probs, 'multiclass');
  assert.equal(r.principal.rotulo, 'Ferrugem');
  assert.equal(r.principal.indice, 4);
  assert.equal(r.barras.length, 5);
  assert.deepEqual(
    r.barras.map((b) => b.rotulo),
    ['Cercosporiose', 'Saudável', 'Minador', 'Phoma', 'Ferrugem']
  );
  assert.equal(r.detalhe, null);
});

test('modo multiclasse: empate resolve pelo indice da rede (determinismo)', () => {
  const r = montarResultado(LABELS, new Float32Array([0.2, 0.2, 0.2, 0.2, 0.2]), 'multiclass');
  assert.equal(r.principal.rotulo, 'Cercosporiose');
});

test('modo binario: colapsa em Saudavel/Doente e preserva o detalhe', () => {
  const r = montarResultado(LABELS, new Float32Array([0.02, 0.01, 0.03, 0.03, 0.91]), 'binary');
  assert.equal(r.principal.rotulo, 'Doente');
  assert.ok(Math.abs(r.principal.prob - 0.99) < 1e-6);
  assert.equal(r.barras.length, 2);
  assert.deepEqual(r.barras.map((b) => b.rotulo), ['Saudável', 'Doente']);
  assert.equal(r.detalhe, 'Ferrugem');
});

test('modo binario: folha saudavel vence', () => {
  const r = montarResultado(LABELS, new Float32Array([0.01, 0.96, 0.01, 0.01, 0.01]), 'binary');
  assert.equal(r.principal.rotulo, 'Saudável');
  assert.ok(Math.abs(r.principal.prob - 0.96) < 1e-6);
  assert.equal(r.detalhe, 'Saudável');
});

test('modo binario: impasse 50/50 vai para "Doente" (default seguro)', () => {
  // Em triagem, falso negativo custa mais caro que falso positivo.
  const r = montarResultado(LABELS, new Float32Array([0.1, 0.5, 0.2, 0.1, 0.1]), 'binary');
  assert.equal(r.principal.rotulo, 'Doente');
  assert.ok(Math.abs(r.principal.prob - 0.5) < 1e-6);
});

test('modo binario com Healthy ausente da lista de rotulos', () => {
  // modelo sem a classe saudavel: tudo deve cair em "Doente"
  const r = montarResultado(['Cerscospora', 'Rust'], new Float32Array([0.3, 0.7]), 'binary');
  assert.equal(r.principal.rotulo, 'Doente');
  assert.ok(Math.abs(r.principal.prob - 1) < 1e-6);
});

test('probabilidades fora de faixa sao tratadas', () => {
  assert.equal(pct(0), '0.0');
  assert.equal(pct(1), '100.0');
  assert.equal(pct(-0.5), '0.0');
  assert.equal(pct(1.5), '100.0');
  assert.equal(pct(NaN), '0.0');
});

test('probabilidades ausentes viram zero, sem NaN na saida', () => {
  const r = montarResultado(LABELS, [], 'multiclass');
  assert.ok(Number.isFinite(r.principal.prob));
  assert.equal(r.principal.rotulo, 'Cercosporiose');
});
