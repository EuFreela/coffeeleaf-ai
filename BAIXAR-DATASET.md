# Dataset JMuBEN/JMuBEN2 — como obter

O conjunto completo de imagens **não** é versionado neste repositório. São
~219 MB de dados de terceiros, obtidos publicamente no Mendeley Data e citados
no trabalho acadêmico (`Readme.md` §2.1, referência 3).

O que **está** versionado é `data/`: uma amostra de **20 imagens, 4 por classe**,
suficiente para conferir que o pipeline de inferência funciona e para servir de
guarda de regressão (`sdd.md` §12.2b). Para re-treinar com folga, baixe o
conjunto completo abaixo.

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

O layout é o mesmo da amostra versionada, com mais imagens por pasta:

```text
CoffeeLeaf AI/
└── data/
    ├── Healthy/     Healthy_0001.jpg …
    ├── Miner/       Miner_0001.jpg …
    ├── Rust/        rust_0001.jpg …
    ├── Phoma/       Phoma_0001.jpg …
    └── Cercospora/  Cercospora_0001.jpg …
```

Atenção a dois detalhes que já enganaram:

1. **Pasta `Rust` capitalizada, arquivo `rust_*.jpg` em minúsculo.** A
   discrepância vem da origem — o Teachable Machine exporta o rótulo `Rust`, o
   Mendeley distribui os arquivos em minúsculo. Em Windows não há diferença; em
   Linux, um `case` estrito quebra. Confirme os dois lados antes de assumir.
2. **Sem separador `train`/`val`/`test`.** O split é feito no script de treino,
   não na estrutura de pastas.

## Colocando o dataset no lugar

1. Baixe o arquivo do Mendeley Data (link acima).
2. Extraia para a raiz do projeto, renomeando a pasta para `data/`. Se já
   existir uma `data/` com a amostra de 20 imagens, faça merge em vez de
   sobrescrever.
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

- **Validar o modelo exportado** (`sdd.md` §12.2): a amostra de 20 já versionada
  é suficiente para isso — 20/20 com matriz de confusão diagonal. Uma cópia de
  trabalho maior, com 5.000 imagens, produziu 500/500 na mesma bateria, mas não
  está no repositório.
- **Re-treinar** com arquitetura mais robusta (continuidade prevista em
  `Readme.md` §7). É este uso que exige o conjunto completo.

O modelo que a PWA carrega **já está versionado**, em `tm-my-image-model/` e na
cópia de build `pwa/public/model/`. O dataset não é necessário para rodar o
aplicativo — só para re-treinar ou reavaliar.
