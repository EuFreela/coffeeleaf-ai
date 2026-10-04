# Dataset JMuBEN/JMuBEN2 — como obter

O conjunto de imagens **não** é versionado neste repositório. São ~219 MB de
dados de terceiros, obtidos publicamente no Mendeley Data e citados no
trabalho acadêmico (`Readme.md` §2.1, referência 3).

## Fonte

| | |
|---|---|
| Repositório | Mendeley Data |
| Nome | *Arabica coffee leaf disease classification dataset* (JMuBEN / JMuBEN2) |
| DOI | [`10.17632/t2r6rszp5c.1`](https://doi.org/10.17632/t2r6rszp5c.1) |
| Landing page | <https://data.mendeley.com/datasets/t2r6rszp5c/1> |
| Artigo | Jepkoech et al. (2021), *Data in Brief* 36:107142 — <https://pmc.ncbi.nlm.nih.gov/articles/PMC8165403/> |
| Licença | Consultar o Mendeley Data antes de redistribuir |

Imagens coletadas em plantação de *Coffea arabica* em Mutira, condado de
Kirinyaga, Quênia, com câmera Fujifilm X-T4 e identificação por patologista.

## Classes e volumes

O conjunto completo tem 58.555 imagens:

| Classe | Significado | Total no JMuBEN2 |
|---|---|---:|
| `Healthy` | Saudável | 18.985 |
| `Miner` | Minador | 16.979 |
| `Rust` | Ferrugem | 8.337 |
| `Phoma` | Phoma | 6.572 |
| `Cercospora` | Cercosporiose | 7.682 |

## Estrutura esperada neste repositório

O subconjunto usado para treino fica na raiz do projeto, com este layout:

```text
CoffeeLeaf AI/
└── data/
    ├── Healthy/     Healthy_0001.jpg …
    ├── Miner/       Miner_0001.jpg …
    ├── rust/        rust_0001.jpg …
    ├── Phoma/       Phoma_0001.jpg …
    └── Cercospora/  Cercospora_0001.jpg …
```

Atenção a dois detalhes que já quebraram código:

1. **`rust` em minúsculo.** O nome da pasta é `rust`, não `Rust` — igual ao
   arquivo exportado pelo Teachable Machine. Em Windows não há diferença; em
   Linux, sim.
2. **Sem separador `train`/`val`/`test`.** O split é feito no script de treino,
   não na estrutura de pastas.

## Colocando o dataset no lugar

1. Baixe o arquivo do Mendeley Data (link acima).
2. Extraia para a raiz do projeto, renomeando a pasta para `data/`.
3. Confira a contagem:

   ```bash
   # Windows (PowerShell)
   Get-ChildItem data -Directory | ForEach-Object { "$($_.Name): $((Get-ChildItem $_.FullName).Count)" }
   ```

   ```bash
   # Linux / macOS
   for d in data/*/; do printf "%s: %s\n" "$d" "$(ls "$d" | wc -l)"; done
   ```

## Para que serve no workflow

- **Validar o modelo exportado** (`sdd.md` §12.2): a avaliação de 500 imagens
  usada para conferir o pipeline de inferência.
- **Re-treinar** com arquitetura mais robusta (continuidade prevista em
  `Readme.md` §7).

O modelo que a PWA carrega **já está versionado**, em `tm-my-image-model/` e na
cópia de build `pwa/public/model/`. O dataset não é necessário para rodar o
aplicativo — só para re-treinar ou reavaliar.
