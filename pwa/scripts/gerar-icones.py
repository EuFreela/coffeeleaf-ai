"""
Gera os icones PNG da PWA a partir da mesma geometria do icons/icon.svg.

Renderiza direto com Pillow (bezier amostrado), sem depender de um renderizador
SVG externo. Executar: python scripts/gerar-icones.py
"""

import math
import os

from PIL import Image, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "public", "icons")

VERDE_TOPO = (22, 163, 74)
VERDE_BASE = (11, 61, 31)
FOLHA_TOPO = (220, 252, 231)
FOLHA_BASE = (134, 239, 172)
TINTA = (5, 46, 22)


def bezier(p0, p1, p2, p3, passos=64):
    """Bezier cubica de grau 3, amostrada em `passos` pontos."""
    pts = []
    for i in range(passos + 1):
        t = i / passos
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def misturar(c1, c2, t):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def fundo_degradado(tam, raio, c_topo, c_base):
    """Fundo com gradiente vertical e cantos arredondados."""
    img = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    px = img.load()
    for y in range(tam):
        cor = misturar(c_topo, c_base, y / max(1, tam - 1))
        for x in range(tam):
            px[x, y] = (*cor, 255)
    mascara = Image.new("L", (tam, tam), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, tam - 1, tam - 1], radius=raio, fill=255)
    img.putalpha(mascara)
    return img


def desenhar_folha(img, escala, deslocamento):
    """Desenha nervura, duas metades de folha e nervuras secundarias."""
    camada = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)

    def pt(p):
        return (p[0] * escala + deslocamento[0], p[1] * escala + deslocamento[1])

    # metade direita
    d1 = bezier((256, 268), (316, 258), (358, 214), (372, 132))
    d2 = bezier((372, 132), (292, 136), (240, 176), (256, 268))
    folha_dir = [pt(p) for p in d1 + d2]
    d.polygon(folha_dir, fill=(*FOLHA_TOPO, 235))

    # realce degradado na metade direita
    folha_dir_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(folha_dir_img).polygon(folha_dir, fill=(*FOLHA_TOPO, 255))
    grad = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gpx = grad.load()
    for y in range(img.size[1]):
        cor = misturar(FOLHA_TOPO, FOLHA_BASE, y / max(1, img.size[1] - 1))
        for x in range(img.size[0]):
            gpx[x, y] = (*cor, 255)
    folha_dir_img.putalpha(Image.composite(
        grad.split()[3], Image.new("L", img.size, 0), folha_dir_img.split()[3]
    ))
    camada = Image.alpha_composite(camada, folha_dir_img)

    # metade esquerda
    d = ImageDraw.Draw(camada)
    e1 = bezier((256, 300), (200, 292), (162, 252), (150, 176))
    e2 = bezier((150, 176), (224, 180), (272, 216), (256, 300))
    folha_esq = [pt(p) for p in e1 + e2]
    d.polygon(folha_esq, fill=(*FOLHA_BASE, 185))

    # nervura central
    d.line([pt((256, 400)), pt((256, 236))], fill=(*FOLHA_TOPO, 255), width=max(2, round(20 * escala)))

    # nervuras secundarias
    w = max(1, round(7 * escala))
    for a, b in [
        ((262, 250), (330, 208)),
        ((262, 226), (336, 176)),
        ((250, 282), (190, 246)),
        ((250, 258), (186, 216)),
    ]:
        d.line([pt(a), pt(b)], fill=(*TINTA, 72), width=w)

    return Image.alpha_composite(img, camada)


def render(tam, raio_canto, escala, deslocamento, maskable=False):
    img = fundo_degradado(tam, raio_canto, VERDE_TOPO, VERDE_BASE)
    if maskable:
        # conteudo dentro da safe zone central (80%)
        escala *= 0.72
        deslocamento = ((tam - 512 * escala) / 2, (tam - 512 * escala) / 2)
    return desenhar_folha(img, escala, deslocamento)


def principal():
    os.makedirs(DESTINO, exist_ok=True)

    # icones "any": cantos arredondados, Conteudo em ~78% da tela
    for tam, nome in [(512, "icon-512.png"), (192, "icon-192.png")]:
        escala = tam / 512 * 0.86
        desl = ((tam - 512 * escala) / 2, (tam - 512 * escala) / 2)
        img = render(tam, round(tam * 0.22), escala, desl)
        img.save(os.path.join(DESTINO, nome))
        print(f"  {nome}  {tam}x{tam}")

    # apple-touch-icon: o iOS aplica a propria mascara, entao o fundo e opaco
    tam = 180
    escala = tam / 512 * 0.86
    desl = ((tam - 512 * escala) / 2, (tam - 512 * escala) / 2)
    render(tam, 0, escala, desl).save(os.path.join(DESTINO, "apple-touch-icon.png"))
    print("  apple-touch-icon.png  180x180 (opaco)")

    # icone maskable: fundo sangrando, conteudo na safe zone
    img = render(512, 0, 1.0, (0, 0), maskable=True)
    img.save(os.path.join(DESTINO, "icon-maskable-512.png"))
    print("  icon-maskable-512.png  512x512 (maskable)")

    # favicon rasterizado para navegadores que ignoram SVG
    escala = 64 / 512 * 0.9
    desl = ((64 - 512 * escala) / 2, (64 - 512 * escala) / 2)
    render(64, 14, escala, desl).save(os.path.join(DESTINO, "favicon-64.png"))
    print("  favicon-64.png  64x64")


if __name__ == "__main__":
    principal()
