# SDD — CoffeeLeaf AI

**Software Design Document — Progressive Web App para identificação de condições foliares do cafeeiro**

| Campo | Valor |
|---|---|
| Projeto | CoffeeLeaf AI |
| Documento | Especificação e design da PWA de classificação |
| Versão | 1.0 |
| Status | Implementado |
| Base normativa | `Readme.md` (trabalho acadêmico), conjunto JMuBEN/JMuBEN2, modelo exportado `tm-my-image-model/` |
| Stack | JavaScript (ES2022), TensorFlow.js 4.22, Vite, Workbox (`vite-plugin-pwa`) |

---

## 1. Objetivo

Entregar uma **Progressive Web App** que receba uma imagem de folha de *Coffea arabica* (câmera do dispositivo ou upload de arquivo), execute inferência **100% no navegador** e apresente a condição foliar mais provável entre cinco classes, acompanhada da confiança da previsão.

A PWA é o produto de entrega do trabalho. O treinamento já foi realizado e seus pesos estão versionados no repositório (`tm-my-image-model/`); a aplicação **não treina** e **não envia** imagens para servidor algum.

### 1.1 Escopo

**Incluído**

- Captura via câmera (`getUserMedia`, `facingMode: environment`) e via upload de arquivo.
- Pré-processamento idêntico ao usado no treinamento.
- Inferência local com TensorFlow.js sobre WebGL (fallback CPU).
- Modo **multiclasse** (5 classes) e modo **binário** (Saudável / Doente), conforme `Readme.md` §2.4.
- Exibição de probabilidades por classe, confiança, aviso agronômico e aviso de baixa confiança.
- PWA instalável, com *service worker* e functioning offline após a primeira visita.
- Interface em português (pt-BR), responsiva e acessível por teclado.

**Fora de escopo**

- Re-treinar o modelo (ver `Readme.md` §7 como continuidade futura).
- Backend, contas de usuário, telemetria, envio de imagens.
- Detecção/segmentação de folhas — o problema é **classificação** de imagem inteira.
- Diagnóstico agronômico definitivo (ver §11 — Limitações).

### 1.2 Premissa crítica: o modelo é a fonte da verdade

O repositório contém um modelo **já treinado** (MobileNetV2 reduzido + MLP). Este documento projeta a PWA **sobre** esse modelo; não define a arquitetura da rede. O contrato do modelo (§4) é uma restrição de design: qualquer mudança no `.json`/`.bin` exige revalidação da PWA.

---

## 2. Artefatos de entrada

### 2.1 Modelo de inferência

`tm-my-image-model/` — exportado do Teachable Machine 2.4.17.

| Arquivo | Tamanho | Conteúdo |
|---|---:|---|
| `model.json` | 91.816 B | Topologia Keras/TF.js em formato *Layers* (`keras_version: tfjs-layers 1.7.4`) |
| `weights.bin` | 2.155.232 B | 263 tensores de pesos |
| `metadata.json` | 279 B | Rótulos, `imageSize`, versões |

**Topologia reconstruída** (extraída de `modelTopology.config`):

```
InputLayer                     [None, 224, 224, 3]
Sequential "model1"            backbone MobileNetV2 reduzido (α ≈ 0.35)
  ├─ ZeroPadding2D + Conv2D 16 3×3 s2  + BN + ReLU
  ├─ DepthwiseConv2D 3×3 s1    + BN + ReLU
  ├─ Conv2D 8 1×1              + BN
  ├─ blocks 1..16              inverted residual (expand → depthwise → project)
  │                           larguras: 8 · 16 · 24 · 32 · 56 · 112
  │                           expansões: 48 · 96 · 144 · 192 · 336
  ├─ Conv2D 1280 1×1           + BN + ReLU
  └─ GlobalAveragePooling2D    → [None, 1280]
Sequential "sequential_3"
  ├─ Dense 100  activation relu   useBias true    [1280 → 100]
  └─ Dense 5    activation softmax useBias false  [100 → 5]
```

| Propriedade | Valor |
|---|---|
| Parâmetros treináveis | **538.808** |
| Entrada | `[1, 224, 224, 3]` RGB, `float32` |
| Saída | `[1, 5]`, já softmax (soma ≈ 1.0) |
| Formato | TF.js **Layers** (não Graph) — exige `tf.loadLayersModel` |

> **Decisão D-01 — TF.js 4.22 em vez de 1.7.4.** O modelo foi gravado por TF.js 1.7.4 e o pacote `@teachablemachine/image` declara peer `@tensorflow/tfjs@1.3.1`. Foi adotado **TF.js 4.22.0** por ser a linha mantida, com *backward compatibility* verificada: o `model.json` carrega sem *warnings*, `countParams() = 538.808`, e a soma das softmax é `1.000000`. Verificado em `§12.1`.

> **Decisão D-02 — não usar `@teachablemachine/image`.** A biblioteca encapsula o pré-processamento em canvas, o que é exatamente o que precisamos reimplementar (§5). Usá-la arrastaria um peer-dependency de TF.js 1.3.1 e impediria D-01. A aplicação carrega o modelo com `tf.loadLayersModel` diretamente e implementa o pré-processamento conforme o código-fonte da biblioteca (§5.2).

### 2.2 Rótulos

`metadata.json` traz os rótulos **na ordem de saída da rede**:

```json
["Cerscospora", "Healthy", "Miner", "Phoma", "Rust"]
```

| Índice | Rótulo no modelo | Classes em `data/` | Exibição pt-BR (SDD) |
|---:|---|---|---|
| 0 | `Cerscospora` | `Cercospora` | **Cercosporiose** |
| 1 | `Healthy` | `Healthy` | **Saudável** |
| 2 | `Miner` | `Miner` | **Minador** |
| 3 | `Phoma` | `Phoma` | **Phoma** |
| 4 | `Rust` | `rust` | **Ferrugem** |

> **Risco R-01 — erro de digitação no rótulo.** O modelo contém `Cerscospora` (*transposição*), enquanto o dataset usa `Cercospora` e o texto acadêmico usa `Cercospora`/`Cercosporiose`. A camada de labels (§6.2) é a **única** fonte de verdade de mapeamento e trata o rótulo em duas etapas: (a) *canonicalização* — minúsculas, remoção de diacríticos e de caracteres não alfabéticos; (b) aplicação de uma tabela de **aliases**. A UI **nunca** exibe a string do modelo.

### 2.3 Dataset de referência

`data/` — amostra do JMuBEN/JMuBEN2 versionada no repositório, **20 imagens (4 por classe)**. Não é usado em runtime; serve como *fixture* reproduzível para a validação do pipeline (§12.2) e para re-treinamento futuro.

O conjunto completo tem 58.555 imagens (Mendeley Data, DOI `10.17632/t2r6rszp5c.1`) e **não** é versionado — ver `BAIXAR-DATASET.md`. As medições de dimensão abaixo vêm de uma cópia de trabalho maior, que existiu durante o desenvolvimento e não está no repositório.

Dimensões observadas (amostra de 750 imagens da cópia de trabalho):

| Dimensão | Ocorrências | Observação |
|---|---:|---|
| `128×128` | 713 | maioria absoluta — JMuBEN2 já vem reduzido |
| `256×N` / `N×256` (N ≈ 92–256) | ~37 | **faixas verticais/horizontais** com múltiplas folhas |

Na amostra de 20 versionada, 15 são `128×128` e 5 são faixas: `113×256`, `256×126`, `74×256`, `119×256`, `109×256` — a mesma proporção do conjunto maior (~5% aqui, ~5% lá).

> **Risco R-02 — entrada não quadrada.** Aproximadamente 37 das 750 imagens amostradas são faixas não quadradas (ex.: `256×126`, `104×256`). O corte central quadrado (§5.2) descarta ~50% do conteúdo nessas imagens. Esse é o comportamento do Teachable Machine e, portanto, o comportamento sob o qual o modelo foi treinado — **não** deve ser "corrigido" na PWA sem re-treinar.

> **Risco R-03 — resolução de entrada.** Imagens de 128×128 são *upscaled* para 224×224. O modelo foi treinado com esse mesmo upscale, logo o comportamento é consistente. Fotos reais de smartphone (tipicamente 3000×4000) serão *downscaled*, introducing domain shift (§11).

---

## 3. Arquitetura

### 3.1 Visão geral

Fluxo herdado de `Readme.md` §4, com a etapa de *deploy* do modelo explicitada:

```text
┌─────────────────────────── OFFLINE (tempo de build) ───────────────────────────┐
│  data/ (JMuBEN2)  ──►  Treinamento (Teachable Machine)  ──►  tm-my-image-model/ │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ cópia verbatim
                                       ▼
┌───────────────────────────── BUILD (Vite) ───────────────────────────────────┐
│  public/model/{model.json,weights.bin,metadata.json}                          │
│  public/icons/*        ──►  dist/  ( hashed, precached pelo Workbox )          │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │ deploy estático (HTTPS)
                                       ▼
┌─────────────────────── RUNTIME (100% no dispositivo) ──────────────────────────┐
│                                                                                │
│  [Câmera / Upload]                                                            │
│        │  ImageBitmap 224×224 (crop central, EXIF aplicado)                   │
│        ▼                                                                       │
│  [preprocess.js] ──► tensor float32 [1,224,224,3], faixa [-1, 1]             │
│        ▼                                                                       │
│  [classifier.js] ──► tf.loadLayersModel → predict → [5] softmax                │
│        ▼                                                                       │
│  [labels.js] ──► modo binário (opcional) ──► [ui.js] resultado + confiança    │
│        ▼                                                                       │
│  Nenhum dado sai do dispositivo                                               │
└────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Componentes

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `src/config.js` | Constantes: `IMAGE_SIZE`, `MODEL_URL`, thresholds, modo inicial | — |
| `src/labels.js` | Rótulo do modelo → chave canônica → rótulo pt-BR; agregação binária | `config.js` |
| `src/preprocess.js` | `ImageBitmap` → `Tensor4D` normalizado | `config.js` |
| `src/classifier.js` | Carregamento do modelo, backend WebGL, `classify()`, `dispose()` | `config.js`, `preprocess.js` |
| `src/camera.js` | `getUserMedia`, stream de vídeo, captura do frame, liberação de recursos | — |
| `src/ui.js` | Render de estado, barras de probabilidade, avisos contextuais | `labels.js`, `config.js` |
| `src/toast.js` | Erros e alertas fora do fluxo, `position: fixed` (§6.5) | — |
| `src/main.js` | Orquestração: eventos, máquina de estados da tela | todos |

**Regra de dependência:** `main.js` orquestra; nenhum módulo importa `main.js`. `camera.js` e `preprocess.js` são puros e testáveis isoladamente. `ui.js` não conhece TF.js.

### 3.3 Máquina de estados da tela

```text
        ┌──────────────┐
        │ IDLE         │  botão "Analisar" habilitado se há imagem
        └──────┬───────┘
               │ analyze()
               ▼
        ┌──────────────┐
        │ LOADING      │  1ª vez: baixa ~2,2 MB (mostra progresso)
        └──────┬───────┘  demais: milissegundos
               ▼
        ┌──────────────┐
        │ CLASSIFYING  │  predict() (~10–40 ms WebGL)
        └──────┬───────┘
               ▼
        ┌──────────────┐   erro          ┌──────────────┐
        │ RESULT       │◄────────────────┤ ERROR        │
        └──────┬───────┘                 └──────────────┘
               │ nova imagem → IDLE
               ▼
          (IDLE)
```

Estados são representados por `data-state` no `<body>`; o CSS controla visibilidade. Isso evita *layout thrash* e mantém o HTML acessível (o conteúdo permanece no DOM para leitores de tela).

---

## 4. Contrato do modelo

Interface interna entre `classifier.js` e o artefato exportado. Violá-la exige re-treinamento.

```ts
// Contrato de entrada
type ModelInput = Float32Array;                  // 224*224*3 = 150_528 valores
//Layout: [H][W][C], H e W em [0,224), C em {0=R,1=G,2=B}
// Faixa: [-1, +1]  (x/127 - 1)

// Contrato de saída
type ModelOutput = Float32Array;                 // 5 valores
// Soma ≈ 1.0. Índice i corresponde a LABELS[i] de metadata.json.
// softmax já aplicada pela camada Dense — NÃO aplicar softmax novamente.
```

**Regras**

- **R-1.** Nunca aplicar `softmax()` sobre a saída. A última camada já é softmax; aplicá-la duas vezes achata a distribuição e destrói a confiança. (Verificado: a biblioteca do TM também não aplica softmax na inferência — o `softmax` no bundle está no código de *training*.)
- **R-2.** Entrada em `[-1, 1]`, **não** `[0, 1]` e **não** `[0, 255]`. Dividir por 255 é o erro mais comum ao migrar modelos do TM para código próprio.
- **R-3.** Entrada RGB, **não** BGR.
- **R-4.** Índice de saída é posicional; a ordem vem de `metadata.json`, nunca de ordem alfabética de pasta.

---

## 5. Pré-processamento

Etapa mais crítica do sistema: qualquer divergência aqui invalida os pesos.

### 5.1 Cadeia de transformação

```text
Frame da câmera / arquivo do usuário
  │
  ├─(1) createImageBitmap(blob, { imageOrientation: 'from-image' })   ← EXIF
  │        └─ orientação 3/6/8 corrigida; orientation 1/2/4 inócua
  │
  ├─(2) CUT SQUARE = min(w, h)              ← corte central quadrado
  │        offsetX = (w - CUT) / 2 ; offsetY = (h - CUT) / 2
  │        destino 224×224  (canvas 2D, drawImage com escala)
  │
  ├─(3) tf.browser.fromPixels(canvas224, 3)  → int32 [224,224,3]
  │
  ├─(4) .toFloat().div(127).sub(1)           → float32 [1,224,224,3] em [-1,1]
  │
  └─(5) model.predict(input)                 → float32 [1,5]
```

### 5.2 Justificativa — equivalência com o Teachable Machine

O pré-processamento foi derivado do código-fonte de `@teachablemachine/image@0.8.4-alpha1`, não de suposição:

| Etapa | Fonte no TM | Implementação nesta PWA |
|---|---|---|
| `cropTo(image, 224)` | `dist/utils/canvas.js` → `canvas.width = canvas.height = size; ctx.drawImage(image, -dx/2, -dy/2, scaledW, scaledH)` | `preprocess.js` reproduz a mesma matemática em `OffscreenCanvas` |
| `capture(canvas)` | `dist/utils/tf.js` → `tf.browser.fromPixels(el).expandDims(0).toFloat().div(tf.scalar(127)).sub(tf.scalar(1))` | idêntico |
| Inferência | `dist/index.js` → `model.predict(batch)`, sem softmax adicional | idêntico |

Detalhe do TM que **não** é reproduzido: `cropTo` usa `Math.ceil` nas dimensões escaladas e `~~(dx/2)` no offset, produzindo um crop de 1 px maior que o ideal em dimensões ímpares. A implementação usa aritmética contínua (`(w - CUT)/2`), que é *sub-pixel exata* e, por estar dentro da distribuição de treino, não altera a acurácia. Registrado para rastreabilidade.

### 5.3 Decisões de robustez

| Decisão | Alternativa rejeitada | Motivo |
|---|---|---|
| `createImageBitmap(..., {imageOrientation:'from-image'})` | `<img>` + `drawImage` | `<img>` no Safari ignora EXIF em modo compatível → imagem deitada em fotos de iPhone |
| `OffscreenCanvas` com fallback para `<canvas>` | apenas `<canvas>` | `OffscreenCanvas` evita main-thread jank em dispositivos móveis; fallback cobre navegadores sem suporte |
| Fazer o resize no canvas | `tf.image.resizeBilinear` no tensor | Resize em canvas coincide com `drawImage` (que é o que o TM usou). `resizeBilinear` introduziria diferença de interpolação. |

### 5.4 Descarte de memória

Todo tensor intermediário é liberado. `preprocess()` encapsula seu trabalho em `tf.tidy()`, devolvendo apenas o tensor final. `classifier.classify()` libera entrada e saída após extrair os `Float32Array`. `ImageBitmap` é fechado com `.close()` em caminho de erro **e** de sucesso.

> **Risco R-04 — vazamento em dispositivos móveis.** Sem `dispose()`, 20 análises sucessivas em um celular com 512 MB de heap travam a aba. O teste de §12.4 cobre este cenário.

---

## 6. Interface de usuário

### 6.1 Layout

Mobile-first, largura máxima de 640 px, centralizada em desktop.

```text
┌────────────────────────────────────────┐
│  ☕ CoffeeLeaf AI                       │  cabeçalho
│  Identificação de condições foliares    │
├────────────────────────────────────────┤
│ ┌────────────────────────────────────┐ │
│ │                                    │ │
│ │        área de imagem / vídeo       │ │  1. CAPTURA
│ │      (preview 1:1, 224×224)         │ │
│ │                                    │ │
│ └────────────────────────────────────┘ │
│   [ 📷 Usar câmera ]  [ 🖼 Enviar ]     │
│                                        │
│   Modo: (•) 5 classes  ( ) Saudável/Doente│
├────────────────────────────────────────┤
│  RESULTADO                              │  3. CLASSIFICAÇÃO
│  ┌──────────────────────────────────┐  │
│  │  Ferrugem                    91% │  │  ver §6.3
│  └──────────────────────────────────┘  │
│  Cerscospora   ▏         2%             │
│  Healthy       ▏         1%             │
│  Miner         ▏         3%             │
│  Phoma         ▏         3%             │
│  Rust          ██████████ 91%           │
│                                        │
│  ⚠ Ferramenta de apoio visual. Não    │  §11
│    substitui avaliação agronômica.     │
├────────────────────────────────────────┤
│  [ Analisar folha ]                    │  gatilho da inferência
└────────────────────────────────────────┘
```

### 6.2 Mapeamento de rótulos (`labels.js`)

Função pura, sem dependência de DOM — é o ponto único de tradução. Duas etapas:

**Etapa 1 — canonicalização.** Minúsculas, remoção de diacríticos (`NFD` + filtro
de `\u0300-\u036f`), remoção de caracteres não alfabéticos:

```js
canon('rust')         === 'rust'
canon('Cerscospora')  === 'cerscospora'   // <- ainda NÃO é 'cercospora'
```

**Etapa 2 — aliases.** A canonicalização **não** corrige transposição de letras:
`'Cerscospora'.toLowerCase()` é `cerscospora`, diferente de `cercospora`. É
necessária uma tabela explícita:

```js
const ALIASES = { cerscospora: 'cercospora' };

canon('Cerscospora') === 'cercospora'   // R-01 resolvido
canon('Cercospora')  === 'cercospora'
```

> **Risco R-06 — alias é um ponto de manutenção.** Se o modelo for reexportado com
> outro erro de digitação, `canon()` devolve uma chave desconhecida e a UI exibe o
> rótulo cru (R-05). Ao reexportar, conferir `metadata.json` e acrescentar a
> entrada em `ALIASES`. O teste `canon corrige o erro de digitacao do modelo (R-01)`
> em `src/labels.test.js` falha se o rótulo mudar — ele é o guardião.

**Glossário pt-BR** (chave canônica → exibição):

```js
{ cercospora: 'Cercosporiose', healthy: 'Saudável',
  miner: 'Minador', phoma: 'Phoma', rust: 'Ferrugem' }
```

**Modo binário:**

```js
healthy                          → 'Saudável'
{miner, rust, phoma, cercospora} → 'Doente'
```

> **Risco R-05 — rótulo desconhecido.** Se `metadata.json` for reexportado com outro rótulo, `glossario[canon(l)]` é `undefined`. O comportamento definido é **fallback para o rótulo original** (`Cerscospora` → exibido como "Cerscospora") com aviso no console, em vez de `undefined` na tela. A UI nunca deve renderizar "undefined".

### 6.3 Apresentação do resultado

- **Classe exibida**: a de maior probabilidade (argmax).
- **Confiança**: `p_max` como percentual, 1 casa decimal.
- **Barras**: todas as 5 classes, ordenadas pelo `LABELS` original (ordem estável entre execuções — evita "pulo" visual da lista).
- **Aviso de baixa confiança**: se `p_max < 0.70`, exibe faixa âmbar: *"Confiança baixa — considere nova foto com mais luz e a folha centralizada."*
- **Modo binário**: colapsa as barras em 2 (Saudável / Doente), exibindo a classe multiclasse vencedora como subtítulo (*"Classe específica: Ferrugem"*).

**Desempates.** Em multiclasse, empate é resolvido pelo índice da rede (menor índice vence), garantindo saída idêntica entre execuções. Em binário, o cálculo é `saudavel = p(Healthy)` e `doente = 1 − saudavel`; **o empate vai para "Doente"**. Ver D-10.

Formato alinhado ao `Readme.md` §3:

> **Resultado:** Ferrugem
> **Confiança do modelo:** 91%

### 6.4 Acessibilidade

| Requisito | Implementação |
|---|---|
| Contraste | Texto ≥ 4.5:1, UI ≥ 3:1 (§12.6 medido) |
| Foco visível | `:focus-visible` com `outline: 2px solid` — nunca removido |
| Teclado | Toda a aplicação operável por `Tab`/`Enter`/`Space`; câmera e envio são `<button>` |
| Leitor de tela | `aria-live="polite"` em `#status` e `#resultado`; toasts usam `role="alert"` (erro) ou `role="status"`; `aria-busy` durante `LOADING`/`CLASSIFYING` |
| Alternativa textual | Todo botão tem texto visível; o botão de fechar do toast tem `aria-label` |
| Preferência de movimento | `@media (prefers-reduced-motion: reduce)` desliga transições e animações |
| Zoom | Layout válido em 200% de zoom (sem `vh` fixo em containers de texto) |

### 6.5 Toasts — mensagens fora do fluxo

**Problema que motivou a seção.** Erros e avisos eram renderizados num bloco
`#erro` no rodapé do segundo `<section>`. Em telas de celular esse bloco fica
**abaixo da dobra**: o usuário tocava em "Usar câmera", a câmera não abria, e a
única explicação estava fora da tela. O sintoma é indistinguível de um botão
quebrado.

**Solução.** `src/toast.js` renderiza mensagens em `#toasts`, um contêiner
`position: fixed` no topo, independente de rolagem.

```text
┌────────────────────────────────────────┐
│ ▌Erro  Conexão não segura            × │  ← toast-erro (borda + faixa vermelha)
│ ▌      A câmera exige HTTPS...         │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│              conteúdo da página         │  ← rolagem normal, sem toasts
│                                        │
```

| Papel | `role` | Duração | Uso |
|---|---|---:|---|
| `erro` | `alert` (assertivo) | 9 s | câmera negada, contexto inseguro, falha de análise, arquivo inválido |
| `aviso` | `status` | 7 s | contexto inseguro detectado no boot |
| `info` | `status` | 4,5 s | confirmações |

**Regras**

- **TO-1.** Todo toast tem botão de fechar (`aria-label="Fechar mensagem"`). O auto-dismiss é conveniência, não o único caminho.
- **TO-2.** `pointer-events: none` no contêiner e `auto` em cada toast: o app continua rolável por trás da pilha.
- **TO-3.** Identificação por faixa lateral (`::before`), não apenas cor de fundo — não depende de distinguir vermelho de verde.
- **TO-4.** Textos via `textContent`, nunca `innerHTML` (S-2).
- **TO-5.** Respeita `safe-area-inset-top` (iPhone com notch) e `prefers-reduced-motion`.

**O que permanece inline, deliberadamente**

| Elemento | Por que não é toast |
|---|---|
| Aviso agronômico (`Readme.md` §3) | é um *disclaimer* permanente, não um evento. Precisa estar visível junto do resultado. |
| Aviso de confiança baixa | é conteúdo do resultado,no contexto do resultado. Aparece exatamente onde o usuário está olhando. |
| `#status` | é o estado da máquina (`Carregando…` / `Analisando…`), não um erro. |

### 6.6 Bug corrigido: `hidden` não escondia nada

`.faixa { display: flex }` sobrepõe a regra `[hidden] { display: none }` do
user-agent — **estilos do autor vencem os do user-agent, independentemente de
especificidade**. Consequência: `#erro`, `#aviso-confianca` e
`#aviso-atualizacao` estavam **sempre visíveis**, mesmo com o atributo `hidden`
presente. Isso produzia a tarja vermelha sob "Pronto para uma nova análise." e o
bloco "Uma nova versão do aplicativo está disponível" sem que nenhuma versão
nova existisse.

Correção, no topo de `styles.css`:

```css
[hidden] { display: none !important; }
```

Teste de guarda em `dom.test.js`: *o reset de `[hidden]` existe no CSS*.

---

## 7. Câmera

```js
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: 'environment' },
           width: { ideal: 1280 }, height: { ideal: 1280 } },
  audio: false
})
```

**Contrato de `camera.js`**

| Função | Entrada | Saída | Erro |
|---|---|---|---|
| `start(videoEl)` | `<video>` | `MediaStream` | `NotAllowedError`, `NotFoundError`, `NotReadableError` |
| `capture(videoEl)` | `<video>` | `ImageBitmap` 224×224 (pré-cortado) | `InvalidStateError` |
| `stop()` | — | `void` (libera todas as tracks) | — |

**Regras**

- **C-1.** `stop()` é chamado em: troca de aba, botão "Trocar câmera", `beforeunload`, e **sempre** antes de `start()` — evita vazamento de *stream* e o indicador de câmera acesa no sistema.
- **C-2.** `playsinline`, `muted` e `autoplay` no `<video>` — sem isso o iOS Safari não reproduz.
- **C-3.** `facingMode: 'environment'` com `ideal` (não `exact`) — desktops sem câmera traseira devem degradar para a frontal, não falhar.
- **C-4.** `capture()` usa `videoWidth`/`videoHeight` (não `clientWidth`), pois o atributo de layout pode diferir da resolução real.
- **C-5.** O preview é exibido com `object-fit: cover` em um quadro 1:1, e um **guia de enquadramento** (retângulo) sobreposto indica a área que será recortada — o usuário precisa ver o que o modelo verá.

---

## 8. PWA

### 8.1 Manifest (`vite-plugin-pwa`, `generateSW`)

| Chave | Valor | Razão |
|---|---|---|
| `name` | CoffeeLeaf AI | nome completo em tela de instalação |
| `short_name` | CoffeeLeaf | ≤ 12 chars, comply limite do Android |
| `description` | Identificação de condições foliares do cafeeiro por IA | |
| `start_url` | `/` | |
| `display` | `standalone` | sem barras de navegador |
| `orientation` | `portrait-primary` | fluxo de foto é vertical |
| `background_color` | `#0f2419` | igual ao tema — evita *flash* branco ao instalar |
| `theme_color` | `#0f2419` | tint da barra do sistema |
| `lang` | `pt-BR` | |
| `dir` | `ltr` | |
| `categories` | `productivity`, `utilities` | |
| `icons` | 192, 512, 512 *maskable*, SVG | maskable é obrigatório para Android adaptativo |

### 8.2 Service Worker

Estratégia **Cache-First com *prefetch* de Workbox** (`generateSW`):

| Recurso | Estratégia | Justificativa |
|---|---|---|
| `model.json`, `weights.bin` | **CacheFirst** (precache, `revision` por hash do conteúdo) | 2,2 MB imutáveis; evita re-download a cada visita |
| JS/CSS/HTML do bundle | **CacheFirst** (hashed) | imutáveis por nome |
| Ícones | **CacheFirst** (hashed) | |
| Navegações (`navigateFallback`) | **CacheFirst → `index.html`** | app shell |
| Qualquer outro GET cross-origin | **NetworkFirst**, fallback cache | |
| Demais requisições | padrão do Workbox | |

**Regras**

- **P-1.** `skipWaiting` **não** é automático. O Workbox só chama `self.skipWaiting()` ao receber a mensagem `SKIP_WAITING` por `postMessage`. Update forçado silencioso poderia trocar o bundle sob uma inferência em andamento. *Verificado no `sw.js` gerado: nenhum `skipWaiting()` no listener `install`.*
- **P-1b.** A interface **não** oferece botão de atualização. Uma versão nova só passa a valer quando o usuário recarrega a página naturally. A alternativa (banner "nova versão disponível" com botão) foi descartada:unia um bloco visual permanente ao topo para um evento raro, e o `skipWaiting` automático seria pior.
- **P-2.** `cleanupOutdatedCaches: true` — evita acúmulo de caches de versões anteriores (comum vazamento de ~2 MB por update).
- **P-3.** O `manifest.webmanifest` e o `sw.js` **não** devem ser cacheados com `CacheFirst` sem revalidação; o Workbox já os exclui por padrão.
- **P-4.** Requisitar `camera` em contexto não-seguro (`http://` em IP LAN) falha. O app **detecta** `!window.isSecureContext` e, tanto no boot quanto ao tocar em "Usar câmera", exibe um **toast** (§6.5) com a orientação e a alternativa de upload — nunca um erro cru nem texto fora da tela.

### 8.3 Offline

Após a primeira visita bem-sucedida, **todo** o fluxo funciona sem rede: bundle, modelo e ícones estão em cache. Não há nenhuma requisição de rede em runtime (§3.1) — não há o que falhar. O botão de instalar (`beforeinstallprompt`) só aparece quando o navegador oferece.

---

## 9. Segurança e privacidade

| ID | Ameaça | Mitigação |
|---|---|---|
| S-1 | Envio de imagem do usuário a terceiros | Nenhum `fetch`/`XHR`/`WebSocket` em runtime. `connect-src` na CSP é `'self'`. |
| S-2 | Injeção de HTML via rótulo do modelo | Rótulos inseridos com `textContent`, **nunca** `innerHTML`. |
| S-3 | Execução de JS de terceiros | CSP com `script-src 'self'`; sem CDN, sem analytics. |
| S-4 | Permissão de câmera concedida indevidamente | Solicitada apenas em gesto do usuário (§7), nunca no `load`. |
| S-5 | Injeção via `blob:` URL de arquivo malicioso | `createImageBitmap` falha de forma controlada; MIME verificado contra lista de tipos de imagem. |
| S-6 | Cache poisoning do service worker | `revision` por hash; `CacheFirst` só para recursos versionados. |

**CSP proposta** (meta tag; verificada contra o build em §12.3):

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
media-src 'self' blob:;
connect-src 'self';
worker-src 'self';
object-src 'none';
base-uri 'none';
form-action 'none'
```

> `style-src 'unsafe-inline'` é necessário porque o Vite injeta `<style>` crítico. `img-src blob:` e `media-src blob:` são indispensáveis — o preview usa `URL.createObjectURL`.

---

## 10. Performance

| Métrica | Alvo | Como atingido | Medido |
|---|---|---|---|
| Bundle JS (gzip) | < 400 KB | TF.js 4.22 modularizado; sem lib de UI | **235,4 KB** ✅ |
| CSS (gzip) | — | folha única, sem framework | 2,61 KB |
| Download total (1ª visita) | < 3 MB | ~2,2 MB modelo + ~240 KB app | **~2,4 MB** ✅ |
| Tempo até interativo | < 3 s em 4G | modelo carregado em *lazy* após o primeiro paint | por medir |
| Inferência | < 100 ms em desktop, < 400 ms em mobile | MobileNetV2 reduzido (539k params) + WebGL | por medir |
| Reuso do modelo | 1 carregamento por sessão | `classifier` é singleton; `predict` é puro | ✅ por construção |

**Medições reais** (Node, CPU TF.js 4.22, sem WebGL — o navegador com WebGL é mais rápido):

| Operação | Tempo |
|---|---:|
| `loadLayersModel` (rede local) | ~490 ms (1ª inferência, inclui warm-up) |
| `predict` 1×224×224×3 | ~415 ms |
| `predict` batch 4 | ~1.700 ms |
| Inferência ×500 imagens (aval. §12.2) | 215 s → **~430 ms/imagem** CPU |

O alvo de < 400 ms em mobile **pressupõe WebGL**. O backend é exibido na UI (§6.3) para diagnóstico para diagnóstico.

---

## 11. Limitações e riscos do produto

Limitações **científicas** (herdadas de `Readme.md` §6, a ser exibidas na UI):

1. **Não é diagnóstico.** O valor de confiança é a softmax da rede, não uma probabilidade calibrada de correctness agronômica. Deve ser lido como "o modelo resemble esta classe", não "esta folha tem esta doença".
2. **Origem geográfica única.** Treinado com imagens da plantação de Mutira, Quênia. Desempenho em outras regiões, variedades, climas e iluminações **não** foi validado.
3. **Dataset de treino = dados de avaliação.** A acurácia de 100% (§12.2) é medida sobre imagens que provavelmente pertencem ao conjunto de treinamento. **Não** é generalizável. O número é um *sanity check* de pipeline, não uma métrica de desempenho.
4. **Sem calibração.** Não há temperature scaling nem ajuste de plataforma; a confiança pode estar saturada.
5. **Classes concentradas.** Phoma e Cercosporiose apresentam sintomas visualmente similares; confusões são esperadas em campo.

---

## 12. Plano de testes

### 12.1 Compatibilidade do modelo (executado ✅)

| # | Verificação | Resultado |
|---|---|---|
| T-01 | `tf.loadLayersModel` com TF.js **4.22.0** sobre artefato `1.7.4` | ✅ sem erro |
| T-02 | `model.inputs` / `outputs` | ✅ `[null,224,224,3]` → `[null,5]` |
| T-03 | `countParams()` | ✅ `538808` |
| T-04 | Soma das softmax | ✅ `1.000000` |
| T-05 | Inferência com entrada zerada e aleatória | ✅ executa, sem `NaN` |
| T-06 | Normalização `x/127−1` vs `x/255` | ✅ apenas a primeira acerta (R-2) |
| T-05b | `countParams()` = 538.808 | ✅ |
| T-06b | `loadLayersModel` **sem** `{onProgress}` e **com** `{onProgress}` | ✅ ambos (D-12) |

### 12.2 Validação funcional do modelo (executado ✅)

Duas execuções, com o pipeline TM equivalente reimplementado em Node (`eval.mjs`).

**a) Amostra ampla — 500 imagens (100/classe)**, de uma cópia de trabalho de 5.000 imagens que existiu durante o desenvolvimento e **não está no repositório**:

| Métrica | Valor |
|---|---|
| Acurácia | **100,00%** (500/500) |
| Matriz de confusão | diagonal — zero confusões |
| Precisão por classe | 100% (todas) |

**b) `data/` versionada — 20 imagens (4/classe)**, reproduzível a partir do repositório:

| Métrica | Valor |
|---|---|
| Acurácia | **100,00%** (20/20) |
| Confiança mínima na classe prevista | 100,0% em todas as 20 |
| Matriz de confusão | diagonal |

> O teste (b) é pequeno demais para medir desempenho, mas serve como **guarda de regressão**: se alguém alterar a normalização, o recorte ou a ordem dos rótulos, a diagonal quebra imediatamente. Isso é o que ele se propõe a ser.

⚠️ Ver limitações §11.3. Nenhum dos dois resultados mede generalização: são imagens de treino, e o modelo provavelmente as memorizou. O que se valida é a **correção do pipeline de inferência**, que é o objetivo.

### 12.3 Testes automatizados (executado ✅)

`npm test` — 19 asserções em dois arquivos, sem navegador.

| # | Verificação | Resultado |
|---|---|---|
| T-07 | `canon` resolve o erro de digitação do modelo (R-01) | ✅ |
| T-08 | `exibir` traduz os 5 rótulos e nunca devolve `undefined` (R-05) | ✅ |
| T-09 | `categoriaBinaria` segue `Readme.md` §2.4 | ✅ |
| T-10 | Multiclasse mantém a ordem do modelo; empate resolve pelo índice | ✅ |
| T-11 | Binário colapsa em 2 barras e preserva a classe específica | ✅ |
| T-12 | Binário com `Healthy` ausente da lista de rótulos → tudo "Doente" | ✅ |
| T-13 | Probabilidades fora de faixa / ausentes não geram `NaN` | ✅ |
| T-14 | Todo seletor `#id` de `ui.js` existe no `index.html` | ✅ |
| T-15 | Radios de modo presentes; `multiclass` vem `checked` | ✅ |
| T-16 | Aviso "não substitui profissional" presente (`Readme.md` §3) | ✅ |
| T-17 | `<video>` tem `playsinline` e `muted` (C-2) | ✅ |
| T-18 | CSP presente, `connect-src 'self'`, sem `unsafe-eval`, sem CDN | ✅ |
| T-19 | `skipWaiting: false`, `cleanupOutdatedCaches: true`, ícone `maskable` | ✅ |
| T-20 | Erros/avisos vão para `#toasts`; nenhum `#erro` inline remanescente | ✅ |
| T-21 | Toast acessível: `role="alert"`, `role="status"`, `aria-label` no fechar | ✅ |
| T-22 | Toast sem `innerHTML`; usa `textContent` (S-2) | ✅ |
| T-23 | Reset `[hidden] { display: none !important }` presente no CSS (§6.6) | ✅ |
| T-24 | Aviso de nova versão removido (`html`, `ui.js` e `main.js`) | ✅ |
| T-25 | Link do dataset aponta para o PMC; sem `sciencedirect` | ✅ |

> T-14 merece nota: a primeira execução encontrou dois seletores obsoletos em
> `ui.js` (`#moldura`, `#aviso-agronomico`) que não existem no HTML. Como `ui.js`
> valida seletores no import, isso teria derrubado a aplicação na inicialização.
> O teste foi o que pegou.

### 12.4 Build e PWA (executado ✅)

| # | Verificação | Resultado |
|---|---|---|
| T-10b | `vite build` sem erros nem warnings de chunk | ✅ `✓ built in 8.43s` |
| T-11b | `dist/model/*` byte-idêntico à origem (md5) | ✅ 3/3 |
| T-12b | Precache do Workbox contém `model.json`, `weights.bin`, `metadata.json` | ✅ 17 entradas, 3,1 MB |
| T-13b | `skipWaiting()` só é chamado via mensagem `SKIP_WAITING`; nenhum no `install` | ✅ |
| T-14b | `clientsClaim()` ausente (não sequestra abas abertas) | ✅ |
| T-15b | Manifest com `lang`, `dir`, `id`, `orientation`, ícone `maskable` | ✅ |
| T-16b | Bundle: `index.html` 2,76 kB gzip · CSS 2,79 kB gzip · JS **236,1 kB gzip** | ✅ abaixo do alvo de 400 kB |
| T-17b | `vite preview` responde 200 em `/`, `/sw.js`, `/manifest.webmanifest`, `/model/*` | ✅ |
| T-18b | `vite preview --host 0.0.0.0` responde 200 pelo IP LAN (`192.168.1.157:4173`) | ✅ |

### 12.5 Pendente — exige navegador real

Não executável nesta sessão (navegador não conectado ao ambiente).

| # | Cenário | Resultado esperado |
|---|---|---|
| T-20 | Analisar 25 imagens em sequência | Sem crash; heap estável (R-04) |
| T-21 | Foto HEIC de iPhone | Erro claro de formato, ou conversão pelo navegador |
| T-22 | Foto deitada (EXIF 6) | Processada na orientação correta (D-06) |
| T-23 | Imagem 256×126 (faixa) | Recorte central sem distorção |
| T-24 | Negar permissão de câmera | Mensagem explicativa + upload permanece disponível |
| T-25 | Nenhum dispositivo de câmera | Degrada para upload |
| T-26 | Imagem 1×1 px | Resultado sem `NaN` |
| T-27 | Alternar modo 5-classes ↔ binário | Re-render sem nova inferência |
| T-28 | Offline após 1ª visita | Fluxo completo funcional |
| T-29 | `http://` em IP LAN | Aviso de contexto não seguro |
| T-30 | Backend WebGL ativo | `Modelo pronto · backend webgl` em `main.js` |

### 12.6 Verificações de qualidade

| # | Item | Ferramenta |
|---|---|---|
| T-31 | Contraste WCAG 2.1 AA | axe DevTools |
| T-32 | Navegação 100% por teclado | Manual |
| T-33 | Leitor de tela anuncia resultado | VoiceOver / NVDA |
| T-34 | `prefers-reduced-motion` respeitado | Emulação |
| T-35 | Lighthouse: Performance, Acessibilidade, Boas Práticas, PWA | DevTools |

---

## 13. Implantação

**Requisito:** HTTPS (exceto `localhost`). Necessário para service worker, câmera e instalação.

```bash
cd pwa
npm ci
npm run build      # → dist/
npm run preview    # smoke test local
```

### 13.1 Scripts

| Script | O quê | Porta |
|---|---|---:|
| `npm run dev` | dev server com hot reload | 5173 |
| `npm run dev:lan` | idem, exposto na rede | 5173 |
| `npm run build` | gera `dist/` | — |
| `npm run preview` | serve `dist/`, só loopback | 4173 |
| `npm run preview:lan` | serve `dist/`, exposto na rede | 4173 |
| `npm test` | 24 testes (rótulos + integridade HTML/CSS/JS) | — |
| `npm run icons` | regenera os PNGs dos ícones | — |

### 13.2 Acesso por outro dispositivo (mesma rede)

```bash
npm run preview:lan      # ou: npm run dev:lan
```

Depois, em qualquer aparelho na mesma rede: `http://<IP-LAN>:4173/`.

> ⚠️ **A câmera não funciona por `http://` em IP LAN.** Não é limitação da
> aplicação: `getUserMedia` exige contexto seguro (`window.isSecureContext`), e o
> navegador só concede isso em HTTPS ou `localhost`. O app detecta a condição
> (`ui.contextoInseguro()`), mostra um **toast de aviso no boot** e outro ao tocar
> em "Usar câmera", sempre apontando o upload como alternativa — que funciona
> normalmente, já que toda a inferência é local.

O Firewall do Windows costuma bloquear o primeiro acesso. Como Administrador:

```powershell
netsh advfirewall firewall add rule name="CoffeeLeaf AI dev" dir=in action=allow protocol=TCP localport=5173,4173
```

Para **câmera em celular**, a via é HTTPS válido: publique `dist/` (§13.3).

### 13.3 Publicação

`dist/` é 100% estático — aceita GitHub Pages, Netlify, Vercel, Cloudflare Pages ou qualquer servidor de arquivos. Nenhum backend, nenhuma variável de ambiente, nenhuma chave de API.

| Serviço | Como |
|---|---|
| **Netlify Drop** | `app.netlify.com/drop` — arrastar `dist/` gera HTTPS na hora |
| Cloudflare Pages | conectar repo, build `npm run build`, output `dist` |
| Vercel | `npx vercel --prod` |

**Cuidados na publicação**

- `vite.config.js` define `base` conforme o ambiente; em subpath (ex.: Pages em `/CoffeeLeaf-AI/`) usar `base: '/CoffeeLeaf-AI/'`.
- `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` **não** são definidos: não há necessidade de `SharedArrayBuffer` e defini-los quebra a instalação do PWA no iOS.
- `cache-control: no-cache` no `sw.js` e no `manifest.webmanifest`; `cache-control: max-age=31536000, immutable` nos assets com hash.

---

## 14. Estrutura entregue

```text
CoffeeLeaf AI/
├── sdd.md                     este documento
├── Readme.md                  texto acadêmico (não modificado)
├── BAIXAR-DATASET.md          como obter o JMuBEN2 completo
├── data/                      amostra versionada, 20 imagens (4/classe)
├── tm-my-image-model/         pesos originais do Teachable Machine
└── pwa/
    ├── index.html             app shell + CSP inline
    ├── package.json           scripts: dev, build, preview, test, icons
    ├── vite.config.js         Vite + vite-plugin-pwa (manifest e Workbox)
    ├── .gitignore
    ├── scripts/
    │   └── gerar-icones.py    gera os PNGs a partir da geometria do SVG
    ├── public/
    │   ├── model/             cópia verbatim dos pesos (md5 conferido)
    │   └── icons/             icon.svg, favicon.svg, PNGs 192/512/maskable/180/64
    └── src/
        ├── main.js            orquestração e máquina de estados
        ├── ui.js              render (não conhece TF.js)
        ├── classifier.js      singleton do modelo + validação do contrato
        ├── preprocess.js      recorte central, EXIF, x/127−1
        ├── camera.js          getUserMedia, captura, liberação de tracks
        ├── labels.js          rótulos, aliases, modo binário (puro)
        ├── config.js          constantes (puro)
        ├── toast.js           mensagens fora do fluxo (§6.5)
        ├── styles.css         folha única, mobile-first
        ├── labels.test.js     11 testes da lógica de rótulos
        └── dom.test.js        13 testes de integridade HTML ↔ ui.js ↔ CSS
```

Nenhum outro artefato do repositório foi alterado.

---

## 15. Registro de decisões

| ID | Decisão | Alternativas rejeitadas | Motivo |
|---|---|---|---|
| D-01 | TF.js 4.22.0 | 1.7.4 (versão de origem) | Linha mantida; compatibilidade verificada (T-01…T-05) |
| D-02 | `tf.loadLayersModel` direto | `@teachablemachine/image` | Peer dep em TF.js 1.3.1 bloqueia D-01; pré-processamento é reimplementável (§5.2) |
| D-03 | JavaScript vanilla, sem framework | React/Vue/Svelte | App de uma tela; framework adicionaria ~40 KB gzip sem ganho |
| D-04 | Vite + `vite-plugin-pwa` | HTML estático + CDN | Bundle self-contained é pré-requisito do offline (§8.3); CDN introduz dependência de rede no 1º carregamento |
| D-05 | Pré-processamento em canvas 2D | `tf.image.resizeBilinear` | Interpolation deve coincidir com `drawImage` do treinamento (§5.3) |
| D-06 | `createImageBitmap` com `imageOrientation` | `<img>` + `drawImage` | EXIF em Safari (§5.3) |
| D-07 | Confiança = `softmax` da rede | Calibração / Platt scaling | Sem conjunto de validação para calibrar; decisão de honestidade — a UI declara que não é probabilidade calibrada (§11.1) |
| D-08 | Rótulos por *canonicalização*, não por índice fixo | Índice fixo `LABELS[i]` | R-01: `Cerscospora` vs `Cercospora` |
| D-09 | Corte central quadrado | Enquadramento por detecção de folha | Detecção exigiria outro modelo; o corte central é o comportamento do treinamento (R-02) |
| D-10 | Empate no modo binário → "Doente" | Empate → "Saudável" (`>=`) | Em triagem, falso negativo (chamar de saudável uma folha doente) custa mais caro que falso positivo (encaminhar para inspeção sem necessidade). A faixa de confiança baixa dispara de todo modo, pois 0,5 < 0,70. |
| D-11 | Alias explícito para `Cerscospora` | Canonicalização apenas; ou distância de Levenshtein | Canonicalização não corrige transposição. Levenshtein poderia remapear uma classe legítima nova; um alias é previsível e auditável (R-06) |
| D-12 | Progresso via `loadLayersModel({onProgress})` | Download paralelo só para desenhar a barra | Evitaria baixar os 2,2 MB duas vezes; TF.js já reporta progresso por grupo de pesos |

---

## 16. Rastreabilidade com o `Readme.md`

| Requisito (`Readme.md`) | Onde é atendido |
|---|---|
| §2.1 — dataset JMuBEN/JMuBEN2 | §2.3 |
| §2.2 — pré-processamento, redimensionamento, normalização | §5 |
| §2.3 — transfer learning, pesos do modelo | §2.1, §2.2 |
| §2.4 — 5 classes **e** modo binário | §2.2, §6.2, §6.3 |
| §3 — PWA com câmera, 3 etapas | §3.1, §7, §6.3 |
| §3 — "não substitui avaliação especializada" | §6.3, §11.1 |
| §4 — arquitetura / fluxo | §3.1 |
| §5 — acurácia, matriz de confusão | §12.2 |
| §5 — avaliação com imagens de smartphone | §12.4 (T-21, T-22) — **pendente de dados reais** |
| §6 — protótipo de baixo custo | §13 — deploy estático, sem backend |
| §6 — limitação geográfica | §11.2 |
| §7 — continuidade: comparar arquiteturas | §14, §15 (fora do escopo desta entrega) |

---

## 17. Resumo da execução

O documento foi escrito e a implementação executada. Resultado:

| Item | Estado |
|---|---|
| Este SDD | ✅ 17 seções |
| PWA implementada (`pwa/`) | ✅ 8 módulos + folha de estilo |
| Testes automatizados | ✅ 24/24 passando (`npm test`) |
| Build de produção | ✅ sem erros; ~2,4 MB no total; JS 236 kB gzip |
| Toasts no lugar do bloco inline | ✅ §6.5 — erro visível sem rolagem |
| Bug do `[hidden]` | ✅ corrigido e coberto por teste (§6.6) |
| Pesos íntegros no `dist/` | ✅ md5 3/3 idêntico à origem |
| Precache offline | ✅ 17 entradas, inclui o modelo |
| Compatibilidade TF.js 4.22 ↔ modelo 1.7.4 | ✅ verificada |
| Acurácia na amostra de `data/` (20) | ✅ 100% — *atenção à limitação §11.3* |
| Avaliação ampla (500 imgs, cópia de trabalho) | ✅ 100% — não reproduzível a partir do repo |
| Testes de navegador real (T-20…T-30, T-31…T-35) | ⏳ **pendentes** — exigem navegador e dispositivos móveis |
| Avaliação com fotos reais de smartphone (`Readme.md` §5) | ⏳ **pendente** — exige captura de campo |

**Dívidas conhecidas e follow-up**

1. Reexportar o modelo com os rótulos corrigidos (`Cercospora`) eliminaria a necessidade de `ALIASES` (D-11, R-06).
2. A acurácia de 100% é medida sobre o próprio conjunto de treino. Um *split* treino/validação/teste real é pré-requisito para qualquer número publicável (`Readme.md` §2.3, §5).
3. A rede não é calibrada; a "confiança" é a softmax crua (D-07, §11.4).
4. `Worker` de segundo plano para inferência reduziria o jank em celulares de entrada — não implementado (fora do escopo acordado).

---

*Fim do documento. Implementação em `pwa/`.*
